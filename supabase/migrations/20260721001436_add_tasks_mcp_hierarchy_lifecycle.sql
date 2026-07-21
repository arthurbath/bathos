CREATE OR REPLACE FUNCTION public.tasks_request_mcp_hierarchy_operation(
  _request_id uuid,
  _root_type text,
  _root_id uuid,
  _expected_revision bigint,
  _operation text,
  _descendant_policy text DEFAULT 'reject'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := (SELECT auth.uid());
  _existing public.tasks_hierarchy_operations%ROWTYPE;
  _receipt public.tasks_hierarchy_operations%ROWTYPE;
  _root_revision bigint;
  _root_lifecycle text;
  _existing_expected_revision bigint;
  _expected_revisions jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL OR _root_id IS NULL OR _expected_revision IS NULL
    OR _expected_revision < 1 THEN
    RAISE EXCEPTION 'A request ID, root ID, and positive expected revision are required';
  END IF;
  IF _root_type IS NULL
    OR _root_type NOT IN ('area', 'project', 'heading', 'checklist_item') THEN
    RAISE EXCEPTION 'Unsupported task hierarchy root type';
  END IF;
  IF _operation IS NULL
    OR _operation NOT IN ('complete_project', 'cancel_project', 'reopen_project', 'delete', 'restore') THEN
    RAISE EXCEPTION 'Unsupported task hierarchy operation';
  END IF;
  IF _operation IN ('complete_project', 'cancel_project', 'reopen_project')
    AND _root_type <> 'project' THEN
    RAISE EXCEPTION 'Project lifecycle operations require a project root';
  END IF;
  IF _descendant_policy IS NULL THEN
    RAISE EXCEPTION 'A hierarchy descendant policy is required';
  END IF;
  IF _operation IN ('complete_project', 'cancel_project')
    AND (_descendant_policy IS NULL OR _descendant_policy NOT IN ('reject', 'cascade')) THEN
    RAISE EXCEPTION 'Unsupported project descendant policy';
  END IF;
  IF _operation = 'reopen_project' AND _descendant_policy <> 'reject' THEN
    RAISE EXCEPTION 'Reopening a project does not accept a cascade policy';
  END IF;
  IF _operation IN ('delete', 'restore') AND _descendant_policy <> 'cascade' THEN
    RAISE EXCEPTION 'Hierarchy deletion and restoration require the cascade policy';
  END IF;

  SELECT operation.* INTO _existing
  FROM public.tasks_hierarchy_operations AS operation
  WHERE operation.id = _request_id;

  IF FOUND THEN
    IF _existing.owner_id IS DISTINCT FROM _owner_id THEN
      RAISE EXCEPTION 'The mutation identifier is unavailable. Use a new UUID for a new request.';
    END IF;
    _existing_expected_revision := CASE
      WHEN jsonb_typeof(_existing.expected_revisions -> _root_id::text) = 'number'
        AND (_existing.expected_revisions ->> _root_id::text) ~ '^[1-9][0-9]*$'
        THEN (_existing.expected_revisions ->> _root_id::text)::bigint
      ELSE NULL
    END;
    IF _existing.root_type IS DISTINCT FROM _root_type
      OR _existing.root_id IS DISTINCT FROM _root_id
      OR _existing.operation IS DISTINCT FROM _operation
      OR _existing.descendant_policy IS DISTINCT FROM _descendant_policy
      OR _existing.actor_type IS DISTINCT FROM 'automation'
      OR _existing.mutation_channel IS DISTINCT FROM 'mcp'
      OR _existing_expected_revision IS DISTINCT FROM _expected_revision THEN
      RAISE EXCEPTION 'The mutation identifier was already used for a different hierarchy operation.';
    END IF;
    RETURN to_jsonb(_existing) - 'owner_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tasks_history_events AS event
    WHERE event.owner_id = _owner_id AND event.client_mutation_id = _request_id
  ) OR EXISTS (
    SELECT 1 FROM public.tasks_hierarchy_history_events AS event
    WHERE event.owner_id = _owner_id AND event.client_mutation_id = _request_id
  ) THEN
    RAISE EXCEPTION 'The mutation identifier is unavailable. Use a new UUID for a new request.';
  END IF;

  IF _root_type = 'area' THEN
    SELECT area.revision INTO _root_revision
    FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id AND area.id = _root_id
      AND ((_operation = 'delete' AND area.disposition = 'present')
        OR (_operation = 'restore' AND area.disposition = 'deleted'
          AND area.deletion_root_id = _root_id));
  ELSIF _root_type = 'project' THEN
    SELECT project.revision, project.lifecycle INTO _root_revision, _root_lifecycle
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id AND project.id = _root_id
      AND ((_operation IN ('complete_project', 'cancel_project', 'reopen_project')
          AND project.disposition = 'present')
        OR (_operation = 'delete' AND project.disposition = 'present')
        OR (_operation = 'restore' AND project.disposition = 'deleted'
          AND project.deletion_root_id = _root_id));
  ELSIF _root_type = 'heading' THEN
    SELECT heading.revision INTO _root_revision
    FROM public.tasks_headings AS heading
    WHERE heading.owner_id = _owner_id AND heading.id = _root_id
      AND ((_operation = 'delete' AND heading.disposition = 'present')
        OR (_operation = 'restore' AND heading.disposition = 'deleted'
          AND heading.deletion_root_id = _root_id));
  ELSE
    SELECT item.revision INTO _root_revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id AND item.id = _root_id
      AND ((_operation = 'delete' AND item.disposition = 'present')
        OR (_operation = 'restore' AND item.disposition = 'deleted'
          AND item.deletion_root_id = _root_id));
  END IF;

  IF _root_revision IS NULL THEN
    RAISE EXCEPTION 'The task hierarchy root is unavailable.';
  END IF;
  IF _operation = 'complete_project'
    AND _root_lifecycle NOT IN ('open', 'completed') THEN
    RAISE EXCEPTION 'Reopen the project before completing it.';
  END IF;
  IF _operation = 'cancel_project'
    AND _root_lifecycle NOT IN ('open', 'canceled') THEN
    RAISE EXCEPTION 'Reopen the project before canceling it.';
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(candidate.entity_id::text, candidate.revision ORDER BY candidate.entity_id),
    '{}'::jsonb
  ) INTO _expected_revisions
  FROM tasks_private.hierarchy_operation_candidates(
    _owner_id, _root_type, _root_id, _operation, _descendant_policy
  ) AS candidate;

  _expected_revisions := _expected_revisions
    || jsonb_build_object(_root_id::text, _expected_revision);

  BEGIN
    INSERT INTO public.tasks_hierarchy_operations (
      id, owner_id, root_type, root_id, operation, descendant_policy,
      expected_revisions, actor_type, mutation_channel, requested_at
    ) VALUES (
      _request_id, _owner_id, _root_type, _root_id, _operation, _descendant_policy,
      _expected_revisions, 'automation', 'mcp', now()
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT operation.* INTO _existing
    FROM public.tasks_hierarchy_operations AS operation
    WHERE operation.id = _request_id;

    IF NOT FOUND OR _existing.owner_id IS DISTINCT FROM _owner_id THEN
      RAISE EXCEPTION 'The mutation identifier is unavailable. Use a new UUID for a new request.';
    END IF;
    _existing_expected_revision := CASE
      WHEN jsonb_typeof(_existing.expected_revisions -> _root_id::text) = 'number'
        AND (_existing.expected_revisions ->> _root_id::text) ~ '^[1-9][0-9]*$'
        THEN (_existing.expected_revisions ->> _root_id::text)::bigint
      ELSE NULL
    END;
    IF _existing.root_type IS DISTINCT FROM _root_type
      OR _existing.root_id IS DISTINCT FROM _root_id
      OR _existing.operation IS DISTINCT FROM _operation
      OR _existing.descendant_policy IS DISTINCT FROM _descendant_policy
      OR _existing.actor_type IS DISTINCT FROM 'automation'
      OR _existing.mutation_channel IS DISTINCT FROM 'mcp'
      OR _existing_expected_revision IS DISTINCT FROM _expected_revision THEN
      RAISE EXCEPTION 'The mutation identifier was already used for a different hierarchy operation.';
    END IF;
    RETURN to_jsonb(_existing) - 'owner_id';
  END;

  SELECT operation.* INTO STRICT _receipt
  FROM public.tasks_hierarchy_operations AS operation
  WHERE operation.id = _request_id AND operation.owner_id = _owner_id;

  RETURN to_jsonb(_receipt) - 'owner_id';
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_request_mcp_hierarchy_operation(
  uuid, text, uuid, bigint, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_request_mcp_hierarchy_operation(
  uuid, text, uuid, bigint, text, text
) TO authenticated;
