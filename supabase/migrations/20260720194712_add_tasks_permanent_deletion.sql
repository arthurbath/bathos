-- Connected, owner-authorized permanent deletion for recoverably deleted
-- to-do and project roots. Content-free duplicate-suppression receipts remain.

CREATE TABLE tasks_private.permanent_deletion_receipts (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  root_type text NOT NULL CHECK (root_type IN ('todo', 'project')),
  root_id uuid NOT NULL,
  scope_digest text NOT NULL CHECK (scope_digest ~ '^[a-f0-9]{64}$'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (owner_id, id)
);

ALTER TABLE tasks_private.permanent_deletion_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tasks_private.permanent_deletion_receipts
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.permanent_deletion_scope(
  _owner_id uuid,
  _root_type text,
  _root_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _root_title text;
  _area_ids uuid[] := ARRAY[]::uuid[];
  _project_ids uuid[] := ARRAY[]::uuid[];
  _heading_ids uuid[] := ARRAY[]::uuid[];
  _todo_ids uuid[] := ARRAY[]::uuid[];
  _checklist_ids uuid[] := ARRAY[]::uuid[];
  _task_history_ids uuid[] := ARRAY[]::uuid[];
  _hierarchy_history_ids uuid[] := ARRAY[]::uuid[];
  _mail_source_ids uuid[] := ARRAY[]::uuid[];
  _mail_event_ids uuid[] := ARRAY[]::uuid[];
  _reminder_ids uuid[] := ARRAY[]::uuid[];
  _reminder_occurrence_ids uuid[] := ARRAY[]::uuid[];
  _reminder_delivery_ids uuid[] := ARRAY[]::uuid[];
  _operation_ids uuid[] := ARRAY[]::uuid[];
  _template_instantiation_ids uuid[] := ARRAY[]::uuid[];
  _recurrence_occurrence_ids uuid[] := ARRAY[]::uuid[];
  _hierarchy_ids uuid[] := ARRAY[]::uuid[];
  _scope jsonb;
BEGIN
  IF _root_type = 'todo' THEN
    SELECT task.title
    INTO _root_title
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id
      AND task.id = _root_id
      AND task.disposition = 'deleted'
      AND task.deletion_root_id = task.id;
  ELSIF _root_type = 'project' THEN
    SELECT project.title
    INTO _root_title
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id
      AND project.id = _root_id
      AND project.disposition = 'deleted'
      AND project.deletion_root_id = project.id;
  ELSE
    RAISE EXCEPTION 'Permanent deletion supports deleted to-do and project roots only'
      USING ERRCODE = '22023';
  END IF;

  IF _root_title IS NULL THEN
    RAISE EXCEPTION 'The deleted task root is unavailable'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(area.id ORDER BY area.id), ARRAY[]::uuid[])
  INTO _area_ids
  FROM public.tasks_areas AS area
  WHERE area.owner_id = _owner_id AND area.deletion_root_id = _root_id;

  IF cardinality(_area_ids) > 0 THEN
    RAISE EXCEPTION 'The deletion root contains an unsupported area record'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(project.id ORDER BY project.id), ARRAY[]::uuid[])
  INTO _project_ids
  FROM public.tasks_projects AS project
  WHERE project.owner_id = _owner_id AND project.deletion_root_id = _root_id;

  SELECT COALESCE(array_agg(heading.id ORDER BY heading.id), ARRAY[]::uuid[])
  INTO _heading_ids
  FROM public.tasks_headings AS heading
  WHERE heading.owner_id = _owner_id AND heading.deletion_root_id = _root_id;

  SELECT COALESCE(array_agg(task.id ORDER BY task.id), ARRAY[]::uuid[])
  INTO _todo_ids
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id AND task.deletion_root_id = _root_id;

  SELECT COALESCE(array_agg(item.id ORDER BY item.id), ARRAY[]::uuid[])
  INTO _checklist_ids
  FROM public.tasks_checklist_items AS item
  WHERE item.owner_id = _owner_id AND item.deletion_root_id = _root_id;

  _hierarchy_ids := _project_ids || _heading_ids || _todo_ids || _checklist_ids;

  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _task_history_ids
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id AND event.task_id = ANY(_todo_ids);

  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _hierarchy_history_ids
  FROM public.tasks_hierarchy_history_events AS event
  WHERE event.owner_id = _owner_id
    AND event.entity_id = ANY(_hierarchy_ids);

  SELECT COALESCE(array_agg(source.task_id ORDER BY source.task_id), ARRAY[]::uuid[])
  INTO _mail_source_ids
  FROM public.tasks_mail_sources AS source
  WHERE source.owner_id = _owner_id AND source.task_id = ANY(_todo_ids);

  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _mail_event_ids
  FROM public.tasks_mail_source_events AS event
  WHERE event.owner_id = _owner_id AND event.task_id = ANY(_todo_ids);

  SELECT COALESCE(array_agg(reminder.id ORDER BY reminder.id), ARRAY[]::uuid[])
  INTO _reminder_ids
  FROM public.tasks_reminders AS reminder
  WHERE reminder.owner_id = _owner_id
    AND (
      reminder.task_id = ANY(_todo_ids)
      OR reminder.project_id = ANY(_project_ids)
    );

  SELECT COALESCE(array_agg(occurrence.id ORDER BY occurrence.id), ARRAY[]::uuid[])
  INTO _reminder_occurrence_ids
  FROM public.tasks_reminder_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.reminder_id = ANY(_reminder_ids);

  SELECT COALESCE(array_agg(delivery.id ORDER BY delivery.id), ARRAY[]::uuid[])
  INTO _reminder_delivery_ids
  FROM public.tasks_reminder_deliveries AS delivery
  WHERE delivery.owner_id = _owner_id
    AND delivery.occurrence_id = ANY(_reminder_occurrence_ids);

  SELECT COALESCE(array_agg(operation.id ORDER BY operation.id), ARRAY[]::uuid[])
  INTO _operation_ids
  FROM public.tasks_hierarchy_operations AS operation
  WHERE operation.owner_id = _owner_id
    AND (
      operation.root_id = ANY(_hierarchy_ids)
      OR operation.affected_ids && _hierarchy_ids
    );

  SELECT COALESCE(array_agg(instantiation.id ORDER BY instantiation.id), ARRAY[]::uuid[])
  INTO _template_instantiation_ids
  FROM public.tasks_template_instantiations AS instantiation
  WHERE instantiation.owner_id = _owner_id
    AND (
      (instantiation.root_type = 'todo' AND instantiation.root_id = ANY(_todo_ids))
      OR (instantiation.root_type = 'project' AND instantiation.root_id = ANY(_project_ids))
    );

  SELECT COALESCE(array_agg(occurrence.id ORDER BY occurrence.id), ARRAY[]::uuid[])
  INTO _recurrence_occurrence_ids
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND (
      (occurrence.root_type = 'todo' AND occurrence.root_id = ANY(_todo_ids))
      OR (occurrence.root_type = 'project' AND occurrence.root_id = ANY(_project_ids))
    );

  SELECT jsonb_build_object(
    'root', jsonb_build_object(
      'type', _root_type,
      'id', _root_id,
      'title', _root_title
    ),
    'hierarchy', jsonb_build_object(
      'projects', to_jsonb(_project_ids),
      'headings', to_jsonb(_heading_ids),
      'todos', to_jsonb(_todo_ids),
      'checklist_items', to_jsonb(_checklist_ids)
    ),
    'hierarchy_revisions', jsonb_build_object(
      'projects', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', project.id, 'revision', project.revision)
          ORDER BY project.id)
        FROM public.tasks_projects AS project
        WHERE project.owner_id = _owner_id AND project.id = ANY(_project_ids)
      ), '[]'::jsonb),
      'headings', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', heading.id, 'revision', heading.revision)
          ORDER BY heading.id)
        FROM public.tasks_headings AS heading
        WHERE heading.owner_id = _owner_id AND heading.id = ANY(_heading_ids)
      ), '[]'::jsonb),
      'todos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', task.id, 'revision', task.revision)
          ORDER BY task.id)
        FROM public.tasks_todos AS task
        WHERE task.owner_id = _owner_id AND task.id = ANY(_todo_ids)
      ), '[]'::jsonb),
      'checklist_items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', item.id, 'revision', item.revision)
          ORDER BY item.id)
        FROM public.tasks_checklist_items AS item
        WHERE item.owner_id = _owner_id AND item.id = ANY(_checklist_ids)
      ), '[]'::jsonb)
    ),
    'related', jsonb_build_object(
      'task_history_events', to_jsonb(_task_history_ids),
      'hierarchy_history_events', to_jsonb(_hierarchy_history_ids),
      'mail_sources', to_jsonb(_mail_source_ids),
      'mail_source_events', to_jsonb(_mail_event_ids),
      'reminders', to_jsonb(_reminder_ids),
      'reminder_occurrences', to_jsonb(_reminder_occurrence_ids),
      'reminder_deliveries', to_jsonb(_reminder_delivery_ids)
    ),
    'preserved_receipts', jsonb_build_object(
      'hierarchy_operations', to_jsonb(_operation_ids),
      'template_instantiations', to_jsonb(_template_instantiation_ids),
      'recurrence_occurrences', to_jsonb(_recurrence_occurrence_ids)
    ),
    'erased_record_count',
      cardinality(_hierarchy_ids)
      + cardinality(_task_history_ids)
      + cardinality(_hierarchy_history_ids)
      + cardinality(_mail_source_ids)
      + cardinality(_mail_event_ids)
      + cardinality(_reminder_ids)
      + cardinality(_reminder_occurrence_ids)
      + cardinality(_reminder_delivery_ids)
  ) INTO _scope;

  RETURN _scope;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.permanent_deletion_scope(uuid, text, uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_preview_permanent_deletion(
  _root_type text,
  _root_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _scope jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  _scope := tasks_private.permanent_deletion_scope(_owner_id, _root_type, _root_id);
  RETURN _scope || jsonb_build_object(
    'scope_digest', tasks_private.export_checksum(_scope)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_preview_permanent_deletion(text, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_preview_permanent_deletion(text, uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_permanently_delete(
  _root_type text,
  _root_id uuid,
  _scope_digest text,
  _request_id uuid,
  _confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _existing tasks_private.permanent_deletion_receipts;
  _scope jsonb;
  _current_digest text;
  _result jsonb;
  _project_ids uuid[];
  _heading_ids uuid[];
  _todo_ids uuid[];
  _checklist_ids uuid[];
  _hierarchy_history_ids uuid[];
  _reminder_ids uuid[];
  _reminder_occurrence_ids uuid[];
  _reminder_delivery_ids uuid[];
  _completed_at timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF _confirmation <> 'PERMANENTLY DELETE' THEN
    RAISE EXCEPTION 'Permanent deletion requires explicit confirmation'
      USING ERRCODE = '22023';
  END IF;
  IF _scope_digest IS NULL OR _scope_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Permanent deletion requires a valid preview digest'
      USING ERRCODE = '22023';
  END IF;

  SELECT receipt.*
  INTO _existing
  FROM tasks_private.permanent_deletion_receipts AS receipt
  WHERE receipt.owner_id = _owner_id AND receipt.id = _request_id;

  IF FOUND THEN
    IF _existing.root_type <> _root_type
      OR _existing.root_id <> _root_id
      OR _existing.scope_digest <> _scope_digest THEN
      RAISE EXCEPTION 'Permanent-deletion request identifier was reused with changed input'
        USING ERRCODE = '22023';
    END IF;
    RETURN _existing.result;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_owner_id::text || ':' || _root_type || ':' || _root_id::text, 0)
  );

  -- A matching request may have completed while this transaction waited for
  -- the root lock. Recheck before looking up hierarchy rows that are now gone.
  SELECT receipt.*
  INTO _existing
  FROM tasks_private.permanent_deletion_receipts AS receipt
  WHERE receipt.owner_id = _owner_id AND receipt.id = _request_id;

  IF FOUND THEN
    IF _existing.root_type <> _root_type
      OR _existing.root_id <> _root_id
      OR _existing.scope_digest <> _scope_digest THEN
      RAISE EXCEPTION 'Permanent-deletion request identifier was reused with changed input'
        USING ERRCODE = '22023';
    END IF;
    RETURN _existing.result;
  END IF;

  LOCK TABLE
    public.tasks_projects,
    public.tasks_headings,
    public.tasks_todos,
    public.tasks_checklist_items,
    public.tasks_history_events,
    public.tasks_hierarchy_history_events,
    public.tasks_hierarchy_operations,
    public.tasks_mail_sources,
    public.tasks_mail_source_events,
    public.tasks_reminders,
    public.tasks_reminder_occurrences,
    public.tasks_reminder_deliveries,
    public.tasks_template_instantiations,
    public.tasks_recurrence_occurrences
  IN SHARE ROW EXCLUSIVE MODE;

  _scope := tasks_private.permanent_deletion_scope(_owner_id, _root_type, _root_id);
  _current_digest := tasks_private.export_checksum(_scope);
  IF _current_digest <> _scope_digest THEN
    RAISE EXCEPTION 'Permanent-deletion preview is stale'
      USING ERRCODE = '40001';
  END IF;

  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _project_ids
  FROM jsonb_array_elements_text(_scope #> '{hierarchy,projects}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _heading_ids
  FROM jsonb_array_elements_text(_scope #> '{hierarchy,headings}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _todo_ids
  FROM jsonb_array_elements_text(_scope #> '{hierarchy,todos}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _checklist_ids
  FROM jsonb_array_elements_text(_scope #> '{hierarchy,checklist_items}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _hierarchy_history_ids
  FROM jsonb_array_elements_text(_scope #> '{related,hierarchy_history_events}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _reminder_ids
  FROM jsonb_array_elements_text(_scope #> '{related,reminders}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _reminder_occurrence_ids
  FROM jsonb_array_elements_text(_scope #> '{related,reminder_occurrences}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _reminder_delivery_ids
  FROM jsonb_array_elements_text(_scope #> '{related,reminder_deliveries}') AS value;

  DELETE FROM public.tasks_reminder_deliveries
  WHERE owner_id = _owner_id AND id = ANY(_reminder_delivery_ids);
  DELETE FROM public.tasks_reminder_occurrences
  WHERE owner_id = _owner_id AND id = ANY(_reminder_occurrence_ids);
  DELETE FROM public.tasks_reminders
  WHERE owner_id = _owner_id AND id = ANY(_reminder_ids);
  DELETE FROM public.tasks_hierarchy_history_events
  WHERE owner_id = _owner_id AND id = ANY(_hierarchy_history_ids);
  DELETE FROM public.tasks_checklist_items
  WHERE owner_id = _owner_id AND id = ANY(_checklist_ids);
  DELETE FROM public.tasks_todos
  WHERE owner_id = _owner_id AND id = ANY(_todo_ids);
  DELETE FROM public.tasks_headings
  WHERE owner_id = _owner_id AND id = ANY(_heading_ids);
  DELETE FROM public.tasks_projects
  WHERE owner_id = _owner_id AND id = ANY(_project_ids);

  _result := (
    (_scope #- ARRAY['root', 'title']::text[])
    - 'hierarchy_revisions'::text
  ) || jsonb_build_object(
    'outcome', 'accepted',
    'request_id', _request_id,
    'scope_digest', _scope_digest,
    'completed_at', _completed_at
  );

  INSERT INTO tasks_private.permanent_deletion_receipts (
    owner_id, id, root_type, root_id, scope_digest, result, completed_at
  ) VALUES (
    _owner_id, _request_id, _root_type, _root_id, _scope_digest, _result, _completed_at
  );

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_permanently_delete(
  text, uuid, text, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_permanently_delete(
  text, uuid, text, uuid, text
) TO authenticated;
