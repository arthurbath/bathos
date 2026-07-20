-- Atomic hierarchy lifecycle and recovery operations, root-scoped deletion,
-- hierarchy history, and durable operation receipts.

ALTER TABLE public.tasks_areas
  ADD COLUMN deletion_root_id uuid;
ALTER TABLE public.tasks_areas DISABLE TRIGGER USER;
UPDATE public.tasks_areas SET deletion_root_id = id WHERE disposition = 'deleted';
ALTER TABLE public.tasks_areas ENABLE TRIGGER USER;
ALTER TABLE public.tasks_areas
  ADD CONSTRAINT tasks_areas_deletion_root_valid CHECK (
    (disposition = 'present' AND deletion_root_id IS NULL)
    OR (disposition = 'deleted' AND deletion_root_id IS NOT NULL)
  );

ALTER TABLE public.tasks_projects
  ADD COLUMN deletion_root_id uuid;
ALTER TABLE public.tasks_projects DISABLE TRIGGER USER;
UPDATE public.tasks_projects SET deletion_root_id = id WHERE disposition = 'deleted';
ALTER TABLE public.tasks_projects ENABLE TRIGGER USER;
ALTER TABLE public.tasks_projects
  ADD CONSTRAINT tasks_projects_deletion_root_valid CHECK (
    (disposition = 'present' AND deletion_root_id IS NULL)
    OR (disposition = 'deleted' AND deletion_root_id IS NOT NULL)
  );

ALTER TABLE public.tasks_headings
  ADD COLUMN deletion_root_id uuid;
ALTER TABLE public.tasks_headings DISABLE TRIGGER USER;
UPDATE public.tasks_headings SET deletion_root_id = id WHERE disposition = 'deleted';
ALTER TABLE public.tasks_headings ENABLE TRIGGER USER;
ALTER TABLE public.tasks_headings
  ADD CONSTRAINT tasks_headings_deletion_root_valid CHECK (
    (disposition = 'present' AND deletion_root_id IS NULL)
    OR (disposition = 'deleted' AND deletion_root_id IS NOT NULL)
  );

ALTER TABLE public.tasks_todos
  ADD COLUMN deletion_root_id uuid;
ALTER TABLE public.tasks_todos DISABLE TRIGGER USER;
UPDATE public.tasks_todos SET deletion_root_id = id WHERE disposition = 'deleted';
ALTER TABLE public.tasks_todos ENABLE TRIGGER USER;
ALTER TABLE public.tasks_todos
  ADD CONSTRAINT tasks_todos_deletion_root_valid CHECK (
    (disposition = 'present' AND deletion_root_id IS NULL)
    OR (disposition = 'deleted' AND deletion_root_id IS NOT NULL)
  );

ALTER TABLE public.tasks_checklist_items
  ADD COLUMN deletion_root_id uuid;
ALTER TABLE public.tasks_checklist_items DISABLE TRIGGER USER;
UPDATE public.tasks_checklist_items SET deletion_root_id = id WHERE disposition = 'deleted';
ALTER TABLE public.tasks_checklist_items ENABLE TRIGGER USER;
ALTER TABLE public.tasks_checklist_items
  ADD CONSTRAINT tasks_checklist_items_deletion_root_valid CHECK (
    (disposition = 'present' AND deletion_root_id IS NULL)
    OR (disposition = 'deleted' AND deletion_root_id IS NOT NULL)
  );

CREATE INDEX tasks_areas_owner_deletion_root_idx
ON public.tasks_areas (owner_id, deletion_root_id, id)
WHERE deletion_root_id IS NOT NULL;
CREATE INDEX tasks_projects_owner_deletion_root_idx
ON public.tasks_projects (owner_id, deletion_root_id, id)
WHERE deletion_root_id IS NOT NULL;
CREATE INDEX tasks_headings_owner_deletion_root_idx
ON public.tasks_headings (owner_id, deletion_root_id, id)
WHERE deletion_root_id IS NOT NULL;
CREATE INDEX tasks_todos_owner_deletion_root_idx
ON public.tasks_todos (owner_id, deletion_root_id, id)
WHERE deletion_root_id IS NOT NULL;
CREATE INDEX tasks_checklist_items_owner_deletion_root_idx
ON public.tasks_checklist_items (owner_id, deletion_root_id, id)
WHERE deletion_root_id IS NOT NULL;

CREATE TABLE public.tasks_hierarchy_operations (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  root_type text NOT NULL,
  root_id uuid NOT NULL,
  operation text NOT NULL,
  descendant_policy text NOT NULL DEFAULT 'reject',
  expected_revisions jsonb NOT NULL,
  actor_type text NOT NULL DEFAULT 'user',
  mutation_channel text NOT NULL DEFAULT 'web',
  requested_at timestamptz NOT NULL,
  outcome text NOT NULL DEFAULT 'pending',
  code text,
  affected_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  result_revisions jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  CONSTRAINT tasks_hierarchy_operations_root_type_valid CHECK (
    root_type IN ('area', 'project', 'heading', 'todo', 'checklist_item')
  ),
  CONSTRAINT tasks_hierarchy_operations_operation_valid CHECK (
    operation IN ('complete_project', 'cancel_project', 'reopen_project', 'delete', 'restore')
  ),
  CONSTRAINT tasks_hierarchy_operations_policy_valid CHECK (
    descendant_policy IN ('reject', 'cascade')
  ),
  CONSTRAINT tasks_hierarchy_operations_actor_type_valid CHECK (
    actor_type IN ('user', 'automation', 'system', 'import')
  ),
  CONSTRAINT tasks_hierarchy_operations_channel_valid CHECK (
    mutation_channel IN (
      'web', 'raycast', 'mcp', 'mail_automation', 'browser_capture', 'native', 'import'
    )
  ),
  CONSTRAINT tasks_hierarchy_operations_expected_revisions_valid CHECK (
    jsonb_typeof(expected_revisions) = 'object'
  ),
  CONSTRAINT tasks_hierarchy_operations_result_revisions_valid CHECK (
    jsonb_typeof(result_revisions) = 'object'
  ),
  CONSTRAINT tasks_hierarchy_operations_outcome_valid CHECK (
    outcome IN ('pending', 'accepted', 'noop', 'rejected', 'conflict')
  ),
  CONSTRAINT tasks_hierarchy_operations_result_valid CHECK (
    (outcome = 'pending'
      AND code IS NULL
      AND cardinality(affected_ids) = 0
      AND result_revisions = '{}'::jsonb
      AND completed_at IS NULL)
    OR (outcome IN ('accepted', 'noop')
      AND code IS NULL
      AND completed_at IS NOT NULL)
    OR (outcome IN ('rejected', 'conflict')
      AND code IS NOT NULL
      AND cardinality(affected_ids) = 0
      AND result_revisions = '{}'::jsonb
      AND completed_at IS NOT NULL)
  ),
  CONSTRAINT tasks_hierarchy_operations_kind_valid CHECK (
    (operation IN ('complete_project', 'cancel_project', 'reopen_project')
      AND root_type = 'project')
    OR operation IN ('delete', 'restore')
  )
);

ALTER TABLE public.tasks_hierarchy_operations REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_hierarchy_operations ENABLE ROW LEVEL SECURITY;

CREATE INDEX tasks_hierarchy_operations_owner_requested_idx
ON public.tasks_hierarchy_operations (owner_id, requested_at DESC, id);

CREATE POLICY "Task owners can view their hierarchy operations"
ON public.tasks_hierarchy_operations FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Task owners can request hierarchy operations"
ON public.tasks_hierarchy_operations FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = owner_id
  AND outcome = 'pending'
  AND code IS NULL
  AND cardinality(affected_ids) = 0
  AND result_revisions = '{}'::jsonb
  AND completed_at IS NULL
);

REVOKE ALL ON TABLE public.tasks_hierarchy_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.tasks_hierarchy_operations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_hierarchy_operations TO service_role;

CREATE TABLE public.tasks_hierarchy_history_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  client_mutation_id uuid NOT NULL,
  operation_id uuid REFERENCES public.tasks_hierarchy_operations(id) ON DELETE SET NULL,
  actor_type text NOT NULL,
  mutation_channel text NOT NULL,
  affected_ids uuid[] NOT NULL,
  base_revision bigint NOT NULL,
  result_revision bigint NOT NULL,
  transition text NOT NULL,
  occurred_at timestamptz NOT NULL,
  before_state jsonb,
  after_state jsonb NOT NULL,
  CONSTRAINT tasks_hierarchy_history_owner_mutation_key
    UNIQUE (owner_id, client_mutation_id),
  CONSTRAINT tasks_hierarchy_history_entity_type_valid CHECK (
    entity_type IN ('area', 'project', 'heading', 'checklist_item')
  ),
  CONSTRAINT tasks_hierarchy_history_actor_type_valid CHECK (
    actor_type IN ('user', 'automation', 'system', 'import')
  ),
  CONSTRAINT tasks_hierarchy_history_channel_valid CHECK (
    mutation_channel IN (
      'web', 'raycast', 'mcp', 'mail_automation', 'browser_capture', 'native', 'import'
    )
  ),
  CONSTRAINT tasks_hierarchy_history_affected_ids_valid CHECK (
    cardinality(affected_ids) > 0 AND entity_id = ANY(affected_ids)
  ),
  CONSTRAINT tasks_hierarchy_history_transition_valid CHECK (
    transition IN (
      'baseline', 'create', 'update', 'move', 'reorder', 'complete', 'cancel',
      'reopen', 'delete', 'restore'
    )
  ),
  CONSTRAINT tasks_hierarchy_history_revisions_valid CHECK (
    base_revision >= 0 AND result_revision > 0 AND (
      (transition = 'baseline' AND base_revision = result_revision)
      OR (transition = 'create' AND base_revision = 0 AND result_revision = 1)
      OR (transition NOT IN ('baseline', 'create') AND result_revision = base_revision + 1)
    )
  ),
  CONSTRAINT tasks_hierarchy_history_state_valid CHECK (
    (transition IN ('baseline', 'create') AND before_state IS NULL)
    OR (transition NOT IN ('baseline', 'create') AND before_state IS NOT NULL)
  )
);

ALTER TABLE public.tasks_hierarchy_history_events REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_hierarchy_history_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX tasks_hierarchy_history_owner_occurred_idx
ON public.tasks_hierarchy_history_events (owner_id, occurred_at DESC, id);
CREATE INDEX tasks_hierarchy_history_owner_entity_occurred_idx
ON public.tasks_hierarchy_history_events (owner_id, entity_type, entity_id, occurred_at DESC, id);

CREATE POLICY "Task owners can view their hierarchy history"
ON public.tasks_hierarchy_history_events FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.tasks_hierarchy_history_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tasks_hierarchy_history_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_hierarchy_history_events TO service_role;

CREATE TABLE tasks_private.hierarchy_operation_contexts (
  backend_pid integer NOT NULL,
  transaction_id bigint NOT NULL,
  owner_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  PRIMARY KEY (backend_pid, transaction_id)
);

REVOKE ALL ON TABLE tasks_private.hierarchy_operation_contexts
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.current_hierarchy_operation_id(_owner_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT context.operation_id
  FROM tasks_private.hierarchy_operation_contexts AS context
  WHERE context.backend_pid = pg_backend_pid()
    AND context.transaction_id = txid_current()
    AND context.owner_id = _owner_id;
$$;

REVOKE ALL ON FUNCTION tasks_private.current_hierarchy_operation_id(uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.append_hierarchy_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _entity_type text := CASE TG_TABLE_NAME
    WHEN 'tasks_areas' THEN 'area'
    WHEN 'tasks_projects' THEN 'project'
    WHEN 'tasks_headings' THEN 'heading'
    WHEN 'tasks_checklist_items' THEN 'checklist_item'
  END;
  _transition text;
  _before_state jsonb;
  _base_revision bigint;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Hierarchy history owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    _transition := 'create';
    _before_state := NULL;
    _base_revision := 0;
  ELSE
    _before_state := to_jsonb(OLD) - 'owner_id';
    _base_revision := OLD.revision;
    IF TG_TABLE_NAME = 'tasks_projects'
      AND to_jsonb(NEW) -> 'lifecycle' IS DISTINCT FROM to_jsonb(OLD) -> 'lifecycle' THEN
      _transition := CASE to_jsonb(NEW) ->> 'lifecycle'
        WHEN 'completed' THEN 'complete'
        WHEN 'canceled' THEN 'cancel'
        ELSE 'reopen'
      END;
    ELSIF NEW.disposition IS DISTINCT FROM OLD.disposition THEN
      _transition := CASE NEW.disposition WHEN 'deleted' THEN 'delete' ELSE 'restore' END;
    ELSIF (TG_TABLE_NAME = 'tasks_projects'
        AND to_jsonb(NEW) -> 'area_id' IS DISTINCT FROM to_jsonb(OLD) -> 'area_id')
      OR (TG_TABLE_NAME = 'tasks_headings'
        AND to_jsonb(NEW) -> 'project_id' IS DISTINCT FROM to_jsonb(OLD) -> 'project_id')
      OR (TG_TABLE_NAME = 'tasks_checklist_items'
        AND to_jsonb(NEW) -> 'task_id' IS DISTINCT FROM to_jsonb(OLD) -> 'task_id') THEN
      _transition := 'move';
    ELSIF NEW.order_key IS DISTINCT FROM OLD.order_key
      OR (TG_TABLE_NAME = 'tasks_projects'
        AND to_jsonb(NEW) -> 'planning_order_key'
          IS DISTINCT FROM to_jsonb(OLD) -> 'planning_order_key') THEN
      _transition := 'reorder';
    ELSE
      _transition := 'update';
    END IF;
  END IF;

  INSERT INTO public.tasks_hierarchy_history_events (
    owner_id, entity_type, entity_id, client_mutation_id, operation_id,
    actor_type, mutation_channel, affected_ids, base_revision, result_revision,
    transition, occurred_at, before_state, after_state
  ) VALUES (
    NEW.owner_id, _entity_type, NEW.id, NEW.client_mutation_id,
    tasks_private.current_hierarchy_operation_id(NEW.owner_id),
    NEW.last_actor_type, NEW.last_mutation_channel, ARRAY[NEW.id],
    _base_revision, NEW.revision, _transition, NEW.updated_at,
    _before_state, to_jsonb(NEW) - 'owner_id'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.append_hierarchy_history()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_areas_append_history
AFTER INSERT OR UPDATE ON public.tasks_areas
FOR EACH ROW EXECUTE FUNCTION tasks_private.append_hierarchy_history();
CREATE TRIGGER tasks_projects_append_history
AFTER INSERT OR UPDATE ON public.tasks_projects
FOR EACH ROW EXECUTE FUNCTION tasks_private.append_hierarchy_history();
CREATE TRIGGER tasks_headings_append_history
AFTER INSERT OR UPDATE ON public.tasks_headings
FOR EACH ROW EXECUTE FUNCTION tasks_private.append_hierarchy_history();
CREATE TRIGGER tasks_checklist_items_append_history
AFTER INSERT OR UPDATE ON public.tasks_checklist_items
FOR EACH ROW EXECUTE FUNCTION tasks_private.append_hierarchy_history();

INSERT INTO public.tasks_hierarchy_history_events (
  owner_id, entity_type, entity_id, client_mutation_id, actor_type,
  mutation_channel, affected_ids, base_revision, result_revision,
  transition, occurred_at, before_state, after_state
)
SELECT hierarchy.owner_id, hierarchy.entity_type, hierarchy.id,
  hierarchy.client_mutation_id, 'system', 'import',
  ARRAY[id], revision, revision, 'baseline', updated_at, NULL, state
FROM (
  SELECT area.owner_id, 'area'::text AS entity_type, area.id,
    area.client_mutation_id, area.revision, area.updated_at,
    to_jsonb(area) - 'owner_id' AS state
  FROM public.tasks_areas AS area
  UNION ALL
  SELECT project.owner_id, 'project', project.id, project.client_mutation_id,
    project.revision, project.updated_at, to_jsonb(project) - 'owner_id'
  FROM public.tasks_projects AS project
  UNION ALL
  SELECT heading.owner_id, 'heading', heading.id, heading.client_mutation_id,
    heading.revision, heading.updated_at, to_jsonb(heading) - 'owner_id'
  FROM public.tasks_headings AS heading
  UNION ALL
  SELECT item.owner_id, 'checklist_item', item.id, item.client_mutation_id,
    item.revision, item.updated_at, to_jsonb(item) - 'owner_id'
  FROM public.tasks_checklist_items AS item
) AS hierarchy;

CREATE OR REPLACE FUNCTION tasks_private.hierarchy_operation_candidates(
  _owner_id uuid,
  _root_type text,
  _root_id uuid,
  _operation text,
  _descendant_policy text
)
RETURNS TABLE(entity_type text, entity_id uuid, revision bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF _operation IN ('complete_project', 'cancel_project', 'reopen_project') THEN
    RETURN QUERY
    SELECT 'project'::text, project.id, project.revision
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id
      AND project.id = _root_id
      AND project.disposition = 'present';

    IF _descendant_policy = 'cascade'
      AND _operation IN ('complete_project', 'cancel_project') THEN
      RETURN QUERY
      SELECT 'todo'::text, task.id, task.revision
      FROM public.tasks_todos AS task
      WHERE task.owner_id = _owner_id
        AND task.project_id = _root_id
        AND task.disposition = 'present'
        AND task.lifecycle = 'open';
    END IF;
    RETURN;
  END IF;

  IF _operation = 'restore' THEN
    RETURN QUERY
    SELECT 'area'::text, area.id, area.revision
    FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id AND area.deletion_root_id = _root_id
    UNION ALL
    SELECT 'project', project.id, project.revision
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id AND project.deletion_root_id = _root_id
    UNION ALL
    SELECT 'heading', heading.id, heading.revision
    FROM public.tasks_headings AS heading
    WHERE heading.owner_id = _owner_id AND heading.deletion_root_id = _root_id
    UNION ALL
    SELECT 'todo', task.id, task.revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id AND task.deletion_root_id = _root_id
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id AND item.deletion_root_id = _root_id;
    RETURN;
  END IF;

  IF _root_type = 'area' THEN
    RETURN QUERY
    SELECT 'area'::text, area.id, area.revision
    FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id AND area.id = _root_id AND area.disposition = 'present'
    UNION ALL
    SELECT 'project', project.id, project.revision
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id AND project.area_id = _root_id
      AND project.disposition = 'present'
    UNION ALL
    SELECT 'heading', heading.id, heading.revision
    FROM public.tasks_headings AS heading
    JOIN public.tasks_projects AS project
      ON project.id = heading.project_id AND project.owner_id = heading.owner_id
    WHERE heading.owner_id = _owner_id AND project.area_id = _root_id
      AND heading.disposition = 'present'
    UNION ALL
    SELECT 'todo', task.id, task.revision
    FROM public.tasks_todos AS task
    LEFT JOIN public.tasks_projects AS project
      ON project.id = task.project_id AND project.owner_id = task.owner_id
    WHERE task.owner_id = _owner_id
      AND (task.area_id = _root_id OR project.area_id = _root_id)
      AND task.disposition = 'present'
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    JOIN public.tasks_todos AS task
      ON task.id = item.task_id AND task.owner_id = item.owner_id
    LEFT JOIN public.tasks_projects AS project
      ON project.id = task.project_id AND project.owner_id = task.owner_id
    WHERE item.owner_id = _owner_id
      AND (task.area_id = _root_id OR project.area_id = _root_id)
      AND task.disposition = 'present'
      AND item.disposition = 'present';
  ELSIF _root_type = 'project' THEN
    RETURN QUERY
    SELECT 'project'::text, project.id, project.revision
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id AND project.id = _root_id
      AND project.disposition = 'present'
    UNION ALL
    SELECT 'heading', heading.id, heading.revision
    FROM public.tasks_headings AS heading
    WHERE heading.owner_id = _owner_id AND heading.project_id = _root_id
      AND heading.disposition = 'present'
    UNION ALL
    SELECT 'todo', task.id, task.revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id AND task.project_id = _root_id
      AND task.disposition = 'present'
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    JOIN public.tasks_todos AS task
      ON task.id = item.task_id AND task.owner_id = item.owner_id
    WHERE item.owner_id = _owner_id AND task.project_id = _root_id
      AND task.disposition = 'present'
      AND item.disposition = 'present';
  ELSIF _root_type = 'heading' THEN
    RETURN QUERY
    SELECT 'heading'::text, heading.id, heading.revision
    FROM public.tasks_headings AS heading
    WHERE heading.owner_id = _owner_id AND heading.id = _root_id
      AND heading.disposition = 'present'
    UNION ALL
    SELECT 'todo', task.id, task.revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id AND task.heading_id = _root_id
      AND task.disposition = 'present'
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    JOIN public.tasks_todos AS task
      ON task.id = item.task_id AND task.owner_id = item.owner_id
    WHERE item.owner_id = _owner_id AND task.heading_id = _root_id
      AND task.disposition = 'present'
      AND item.disposition = 'present';
  ELSIF _root_type = 'todo' THEN
    RETURN QUERY
    SELECT 'todo'::text, task.id, task.revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id AND task.id = _root_id
      AND task.disposition = 'present'
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id AND item.task_id = _root_id
      AND item.disposition = 'present';
  ELSE
    RETURN QUERY
    SELECT 'checklist_item'::text, item.id, item.revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id AND item.id = _root_id
      AND item.disposition = 'present';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.hierarchy_operation_candidates(uuid, text, uuid, text, text)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.apply_hierarchy_operation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _current_revisions jsonb;
  _result_revisions jsonb;
  _affected_ids uuid[];
  _target_lifecycle text;
  _open_descendants integer;
  _root_found boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Hierarchy operation owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_object_agg(candidate.entity_id::text, candidate.revision
      ORDER BY candidate.entity_id), '{}'::jsonb),
    COALESCE(array_agg(candidate.entity_id ORDER BY candidate.entity_id), ARRAY[]::uuid[])
  INTO _current_revisions, _affected_ids
  FROM tasks_private.hierarchy_operation_candidates(
    NEW.owner_id, NEW.root_type, NEW.root_id, NEW.operation, NEW.descendant_policy
  ) AS candidate;

  _root_found := NEW.root_id::text = ANY(
    ARRAY(SELECT jsonb_object_keys(_current_revisions))
  );
  IF NOT _root_found THEN
    UPDATE public.tasks_hierarchy_operations
    SET outcome = 'rejected', code = 'root_not_found', completed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.operation IN ('complete_project', 'cancel_project')
    AND NEW.descendant_policy = 'reject' THEN
    SELECT count(*) INTO _open_descendants
    FROM public.tasks_todos AS task
    WHERE task.owner_id = NEW.owner_id
      AND task.project_id = NEW.root_id
      AND task.disposition = 'present'
      AND task.lifecycle = 'open';
    IF _open_descendants > 0 THEN
      UPDATE public.tasks_hierarchy_operations
      SET outcome = 'rejected', code = 'open_descendants', completed_at = now()
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;
  END IF;

  IF _current_revisions IS DISTINCT FROM NEW.expected_revisions THEN
    UPDATE public.tasks_hierarchy_operations
    SET outcome = 'conflict', code = 'revision_set_changed', completed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.operation = 'restore' AND NEW.root_type = 'heading' AND NOT EXISTS (
    SELECT 1
    FROM public.tasks_headings AS heading
    JOIN public.tasks_projects AS project
      ON project.id = heading.project_id AND project.owner_id = heading.owner_id
    WHERE heading.owner_id = NEW.owner_id AND heading.id = NEW.root_id
      AND project.disposition = 'present'
  ) THEN
    UPDATE public.tasks_hierarchy_operations
    SET outcome = 'rejected', code = 'parent_not_present', completed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.operation = 'restore' AND NEW.root_type = 'checklist_item' AND NOT EXISTS (
    SELECT 1
    FROM public.tasks_checklist_items AS item
    JOIN public.tasks_todos AS task
      ON task.id = item.task_id AND task.owner_id = item.owner_id
    WHERE item.owner_id = NEW.owner_id AND item.id = NEW.root_id
      AND task.disposition = 'present'
  ) THEN
    UPDATE public.tasks_hierarchy_operations
    SET outcome = 'rejected', code = 'parent_not_present', completed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO tasks_private.hierarchy_operation_contexts (
    backend_pid, transaction_id, owner_id, operation_id
  ) VALUES (pg_backend_pid(), txid_current(), NEW.owner_id, NEW.id);

  IF NEW.operation IN ('complete_project', 'cancel_project', 'reopen_project') THEN
    _target_lifecycle := CASE NEW.operation
      WHEN 'complete_project' THEN 'completed'
      WHEN 'cancel_project' THEN 'canceled'
      ELSE 'open'
    END;

    IF EXISTS (
      SELECT 1 FROM public.tasks_projects AS project
      WHERE project.owner_id = NEW.owner_id AND project.id = NEW.root_id
        AND project.lifecycle = _target_lifecycle
    ) THEN
      DELETE FROM tasks_private.hierarchy_operation_contexts
      WHERE backend_pid = pg_backend_pid() AND transaction_id = txid_current();
      UPDATE public.tasks_hierarchy_operations
      SET outcome = 'noop', affected_ids = ARRAY[NEW.root_id],
        result_revisions = _current_revisions, completed_at = now()
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;

    UPDATE public.tasks_projects AS project
    SET lifecycle = _target_lifecycle,
      completed_at = CASE WHEN _target_lifecycle = 'completed' THEN NEW.requested_at ELSE NULL END,
      canceled_at = CASE WHEN _target_lifecycle = 'canceled' THEN NEW.requested_at ELSE NULL END,
      revision = project.revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE project.owner_id = NEW.owner_id AND project.id = NEW.root_id;

    IF NEW.descendant_policy = 'cascade'
      AND NEW.operation IN ('complete_project', 'cancel_project') THEN
      UPDATE public.tasks_todos AS task
      SET lifecycle = _target_lifecycle,
        completed_at = CASE WHEN _target_lifecycle = 'completed' THEN NEW.requested_at ELSE NULL END,
        canceled_at = CASE WHEN _target_lifecycle = 'canceled' THEN NEW.requested_at ELSE NULL END,
        revision = task.revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = NEW.mutation_channel,
        last_actor_type = NEW.actor_type
      WHERE task.owner_id = NEW.owner_id AND task.project_id = NEW.root_id
        AND task.disposition = 'present' AND task.lifecycle = 'open';
    END IF;
  ELSIF NEW.operation = 'delete' THEN
    UPDATE public.tasks_checklist_items AS item
    SET disposition = 'deleted', deleted_at = NEW.requested_at,
      deletion_root_id = NEW.root_id, revision = item.revision + 1,
      client_mutation_id = gen_random_uuid(), last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE item.owner_id = NEW.owner_id AND item.id = ANY(_affected_ids)
      AND item.disposition = 'present';
    UPDATE public.tasks_todos AS task
    SET disposition = 'deleted', deleted_at = NEW.requested_at,
      deletion_root_id = NEW.root_id, revision = task.revision + 1,
      client_mutation_id = gen_random_uuid(), last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE task.owner_id = NEW.owner_id AND task.id = ANY(_affected_ids)
      AND task.disposition = 'present';
    UPDATE public.tasks_headings AS heading
    SET disposition = 'deleted', deleted_at = NEW.requested_at,
      deletion_root_id = NEW.root_id, revision = heading.revision + 1,
      client_mutation_id = gen_random_uuid(), last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE heading.owner_id = NEW.owner_id AND heading.id = ANY(_affected_ids)
      AND heading.disposition = 'present';
    UPDATE public.tasks_projects AS project
    SET disposition = 'deleted', deleted_at = NEW.requested_at,
      deletion_root_id = NEW.root_id, revision = project.revision + 1,
      client_mutation_id = gen_random_uuid(), last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE project.owner_id = NEW.owner_id AND project.id = ANY(_affected_ids)
      AND project.disposition = 'present';
    UPDATE public.tasks_areas AS area
    SET disposition = 'deleted', deleted_at = NEW.requested_at,
      deletion_root_id = NEW.root_id, revision = area.revision + 1,
      client_mutation_id = gen_random_uuid(), last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE area.owner_id = NEW.owner_id AND area.id = ANY(_affected_ids)
      AND area.disposition = 'present';
  ELSE
    -- Restore parents before descendants so presentation validity can be evaluated deterministically.
    UPDATE public.tasks_areas AS area
    SET disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
      revision = area.revision + 1, client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel, last_actor_type = NEW.actor_type
    WHERE area.owner_id = NEW.owner_id AND area.deletion_root_id = NEW.root_id;
    UPDATE public.tasks_projects AS project
    SET disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
      area_id = CASE WHEN project.area_id IS NULL OR EXISTS (
        SELECT 1 FROM public.tasks_areas AS area
        WHERE area.owner_id = project.owner_id AND area.id = project.area_id
          AND area.disposition = 'present'
      ) THEN project.area_id ELSE NULL END,
      revision = project.revision + 1, client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel, last_actor_type = NEW.actor_type
    WHERE project.owner_id = NEW.owner_id AND project.deletion_root_id = NEW.root_id;
    UPDATE public.tasks_headings AS heading
    SET disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
      revision = heading.revision + 1, client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel, last_actor_type = NEW.actor_type
    WHERE heading.owner_id = NEW.owner_id AND heading.deletion_root_id = NEW.root_id
      AND EXISTS (
        SELECT 1 FROM public.tasks_projects AS project
        WHERE project.owner_id = heading.owner_id AND project.id = heading.project_id
          AND project.disposition = 'present'
      );
    UPDATE public.tasks_todos AS task
    SET disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
      area_id = CASE WHEN task.area_id IS NULL OR EXISTS (
        SELECT 1 FROM public.tasks_areas AS area
        WHERE area.owner_id = task.owner_id AND area.id = task.area_id
          AND area.disposition = 'present'
      ) THEN task.area_id ELSE NULL END,
      project_id = CASE WHEN task.project_id IS NULL OR EXISTS (
        SELECT 1 FROM public.tasks_projects AS project
        WHERE project.owner_id = task.owner_id AND project.id = task.project_id
          AND project.disposition = 'present'
      ) THEN task.project_id ELSE NULL END,
      heading_id = CASE WHEN task.heading_id IS NULL THEN NULL WHEN EXISTS (
        SELECT 1
        FROM public.tasks_headings AS heading
        JOIN public.tasks_projects AS project
          ON project.id = heading.project_id AND project.owner_id = heading.owner_id
        WHERE heading.owner_id = task.owner_id AND heading.id = task.heading_id
          AND heading.disposition = 'present' AND project.disposition = 'present'
      ) THEN task.heading_id ELSE NULL END,
      destination = CASE WHEN
        (task.area_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_areas AS area
          WHERE area.owner_id = task.owner_id AND area.id = task.area_id
            AND area.disposition = 'present'
        )) OR (task.project_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_projects AS project
          WHERE project.owner_id = task.owner_id AND project.id = task.project_id
            AND project.disposition = 'present'
        )) THEN 'inbox' ELSE task.destination END,
      today_section = CASE WHEN
        (task.area_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_areas AS area
          WHERE area.owner_id = task.owner_id AND area.id = task.area_id
            AND area.disposition = 'present'
        )) OR (task.project_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_projects AS project
          WHERE project.owner_id = task.owner_id AND project.id = task.project_id
            AND project.disposition = 'present'
        )) THEN 'daytime' ELSE task.today_section END,
      start_date = CASE WHEN
        (task.area_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_areas AS area
          WHERE area.owner_id = task.owner_id AND area.id = task.area_id
            AND area.disposition = 'present'
        )) OR (task.project_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_projects AS project
          WHERE project.owner_id = task.owner_id AND project.id = task.project_id
            AND project.disposition = 'present'
        )) THEN NULL ELSE task.start_date END,
      revision = task.revision + 1, client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel, last_actor_type = NEW.actor_type
    WHERE task.owner_id = NEW.owner_id AND task.deletion_root_id = NEW.root_id;
    UPDATE public.tasks_checklist_items AS item
    SET disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
      revision = item.revision + 1, client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel, last_actor_type = NEW.actor_type
    WHERE item.owner_id = NEW.owner_id AND item.deletion_root_id = NEW.root_id
      AND EXISTS (
        SELECT 1 FROM public.tasks_todos AS task
        WHERE task.owner_id = item.owner_id AND task.id = item.task_id
          AND task.disposition = 'present'
      );
  END IF;

  SELECT COALESCE(jsonb_object_agg(candidate.entity_id::text, candidate.revision
      ORDER BY candidate.entity_id), '{}'::jsonb)
  INTO _result_revisions
  FROM (
    SELECT area.id AS entity_id, area.revision FROM public.tasks_areas AS area
    WHERE area.owner_id = NEW.owner_id AND area.id = ANY(_affected_ids)
    UNION ALL
    SELECT project.id, project.revision FROM public.tasks_projects AS project
    WHERE project.owner_id = NEW.owner_id AND project.id = ANY(_affected_ids)
    UNION ALL
    SELECT heading.id, heading.revision FROM public.tasks_headings AS heading
    WHERE heading.owner_id = NEW.owner_id AND heading.id = ANY(_affected_ids)
    UNION ALL
    SELECT task.id, task.revision FROM public.tasks_todos AS task
    WHERE task.owner_id = NEW.owner_id AND task.id = ANY(_affected_ids)
    UNION ALL
    SELECT item.id, item.revision FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = NEW.owner_id AND item.id = ANY(_affected_ids)
  ) AS candidate;

  DELETE FROM tasks_private.hierarchy_operation_contexts
  WHERE backend_pid = pg_backend_pid() AND transaction_id = txid_current();

  UPDATE public.tasks_hierarchy_operations
  SET outcome = 'accepted', affected_ids = _affected_ids,
    result_revisions = _result_revisions, completed_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.apply_hierarchy_operation()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_hierarchy_operations_apply
AFTER INSERT ON public.tasks_hierarchy_operations
FOR EACH ROW EXECUTE FUNCTION tasks_private.apply_hierarchy_operation();

-- Extend the current task snapshot in place so existing history and schema-v3
-- restores normalize the newly required deletion marker to null.
CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_snapshot_v4(_snapshot jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN _snapshot IS NULL OR _snapshot = 'null'::jsonb THEN NULL
    ELSE tasks_private.normalize_todo_snapshot_v3(_snapshot) || jsonb_build_object(
      'area_id', _snapshot -> 'area_id',
      'project_id', _snapshot -> 'project_id',
      'heading_id', _snapshot -> 'heading_id',
      'hierarchy_order_key', _snapshot -> 'hierarchy_order_key',
      'deletion_root_id', _snapshot -> 'deletion_root_id'
    )
  END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_todo_snapshot_v4(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot_v4(_task public.tasks_todos)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT tasks_private.todo_snapshot_v3(_task) || jsonb_build_object(
    'area_id', _task.area_id,
    'project_id', _task.project_id,
    'heading_id', _task.heading_id,
    'hierarchy_order_key', _task.hierarchy_order_key,
    'deletion_root_id', _task.deletion_root_id
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_snapshot_v4(public.tasks_todos)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.guard_hierarchy_domain_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.disposition IS DISTINCT FROM OLD.disposition
    AND tasks_private.current_hierarchy_operation_id(NEW.owner_id) IS NULL THEN
    RAISE EXCEPTION 'Hierarchy disposition changes require a hierarchy operation'
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'tasks_projects'
    AND to_jsonb(NEW) -> 'lifecycle' IS DISTINCT FROM to_jsonb(OLD) -> 'lifecycle'
    AND tasks_private.current_hierarchy_operation_id(NEW.owner_id) IS NULL
    AND EXISTS (
      SELECT 1 FROM public.tasks_todos AS task
      WHERE task.owner_id = NEW.owner_id AND task.project_id = NEW.id
        AND task.disposition = 'present' AND task.lifecycle = 'open'
    ) THEN
    RAISE EXCEPTION 'Projects with open descendants require an explicit cascade policy'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.guard_hierarchy_domain_transition()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_areas_guard_domain_transition
BEFORE UPDATE ON public.tasks_areas
FOR EACH ROW EXECUTE FUNCTION tasks_private.guard_hierarchy_domain_transition();
CREATE TRIGGER tasks_projects_guard_domain_transition
BEFORE UPDATE ON public.tasks_projects
FOR EACH ROW EXECUTE FUNCTION tasks_private.guard_hierarchy_domain_transition();
CREATE TRIGGER tasks_headings_guard_domain_transition
BEFORE UPDATE ON public.tasks_headings
FOR EACH ROW EXECUTE FUNCTION tasks_private.guard_hierarchy_domain_transition();
CREATE TRIGGER tasks_checklist_items_guard_domain_transition
BEFORE UPDATE ON public.tasks_checklist_items
FOR EACH ROW EXECUTE FUNCTION tasks_private.guard_hierarchy_domain_transition();

CREATE OR REPLACE FUNCTION tasks_private.guard_todo_hierarchy_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.disposition IS DISTINCT FROM OLD.disposition
    AND tasks_private.current_hierarchy_operation_id(NEW.owner_id) IS NULL THEN
    RAISE EXCEPTION 'Task disposition changes require a hierarchy operation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.guard_todo_hierarchy_transition()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_todos_guard_hierarchy_transition
BEFORE UPDATE ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.guard_todo_hierarchy_transition();
