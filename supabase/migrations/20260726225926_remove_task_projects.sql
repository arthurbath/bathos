-- Remove the unused Project hierarchy from BathOS Tasks.
--
-- This migration is intentionally fail closed. Production was audited immediately
-- before authoring and contains one disposable Project, one Project history event,
-- and no Project-owned user work or operational receipts.

DO $$
DECLARE
  _projects bigint;
  _task_dependencies bigint;
  _reminder_dependencies bigint;
  _template_dependencies bigint;
  _recurrence_dependencies bigint;
  _operation_dependencies bigint;
  _history_dependencies bigint;
  _receipt_dependencies bigint;
  _task_history_dependencies bigint;
BEGIN
  SELECT count(*) INTO _projects FROM public.tasks_projects;
  SELECT count(*) INTO _task_dependencies
  FROM public.tasks_todos WHERE project_id IS NOT NULL;
  SELECT count(*) INTO _reminder_dependencies
  FROM public.tasks_reminders
  WHERE project_id IS NOT NULL OR root_type = 'project';
  SELECT
    (SELECT count(*) FROM public.tasks_templates WHERE kind = 'project')
    + (SELECT count(*) FROM public.tasks_template_revisions WHERE source_type = 'project')
    + (SELECT count(*) FROM public.tasks_template_instantiations WHERE root_type = 'project')
  INTO _template_dependencies;
  SELECT count(*) INTO _recurrence_dependencies
  FROM public.tasks_recurrence_occurrences WHERE root_type = 'project';
  SELECT count(*) INTO _operation_dependencies
  FROM public.tasks_hierarchy_operations
  WHERE root_type = 'project'
    OR operation IN ('complete_project', 'cancel_project', 'reopen_project');
  SELECT count(*) INTO _history_dependencies
  FROM public.tasks_hierarchy_history_events WHERE entity_type = 'project';
  SELECT
    (SELECT count(*) FROM tasks_private.permanent_deletion_receipts
      WHERE root_type = 'project')
    + (SELECT count(*) FROM tasks_private.purged_creation_receipts
      WHERE entity_type = 'project')
  INTO _receipt_dependencies;
  SELECT count(*) INTO _task_history_dependencies
  FROM public.tasks_history_events
  WHERE COALESCE(before_state ->> 'project_id', '') <> ''
    OR COALESCE(after_state ->> 'project_id', '') <> '';

  IF NOT (
    (
      _projects = 0
      AND _history_dependencies = 0
    )
    OR (
      _projects = 1
      AND _history_dependencies = 1
    )
  )
    OR _task_dependencies <> 0
    OR _reminder_dependencies <> 0
    OR _template_dependencies <> 0
    OR _recurrence_dependencies <> 0
    OR _operation_dependencies <> 0
    OR _receipt_dependencies <> 0
    OR _task_history_dependencies <> 0 THEN
    RAISE EXCEPTION
      'Project removal preflight failed (projects %, tasks %, reminders %, templates %, recurrence %, operations %, history %, receipts %, task history %)',
      _projects, _task_dependencies, _reminder_dependencies,
      _template_dependencies, _recurrence_dependencies,
      _operation_dependencies, _history_dependencies,
      _receipt_dependencies, _task_history_dependencies
      USING ERRCODE = 'P0001';
  END IF;
END
$$;

DELETE FROM public.tasks_hierarchy_history_events
WHERE entity_type = 'project';
DELETE FROM public.tasks_projects;

-- The Project delete touches deferred owner-scoped foreign keys. Flush those
-- checks before altering the referencing tables or PostgreSQL will reject the
-- contraction while their constraint-trigger events are still pending.
SET CONSTRAINTS ALL IMMEDIATE;

DROP FUNCTION IF EXISTS public.tasks_create_export_v12();
DROP FUNCTION IF EXISTS public.tasks_restore_export_v12(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tasks_prepare_replace_restore_v12(jsonb);
DROP FUNCTION IF EXISTS public.tasks_replace_restore_v12(jsonb, text, uuid, text);
DROP FUNCTION IF EXISTS tasks_private.export_v12_collection(text, uuid);
DROP FUNCTION IF EXISTS tasks_private.template_snapshot_from_project(uuid, uuid, date);

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot_v3(
  _task public.tasks_todos
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'title', _task.title,
    'notes', _task.notes,
    'lifecycle', _task.lifecycle,
    'completed_at', _task.completed_at,
    'canceled_at', _task.canceled_at,
    'disposition', _task.disposition,
    'deleted_at', _task.deleted_at,
    'destination', _task.destination,
    'today_section', _task.today_section,
    'order_key', _task.order_key,
    'area_id', _task.area_id,
    'hierarchy_order_key', _task.hierarchy_order_key,
    'start_date', _task.start_date,
    'deadline', _task.deadline,
    'source_kind', _task.source_kind,
    'source_url', _task.source_url,
    'source_title', _task.source_title,
    'source_external_id', _task.source_external_id
  );
$$;

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot_v4(
  _task public.tasks_todos
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT tasks_private.todo_snapshot_v3(_task) || jsonb_build_object(
    'area_id', _task.area_id,
    'hierarchy_order_key', _task.hierarchy_order_key,
    'deletion_root_id', _task.deletion_root_id
  );
$$;

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot_v7(
  _task public.tasks_todos
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'title', _task.title,
    'notes', _task.notes,
    'lifecycle', _task.lifecycle,
    'completed_at', _task.completed_at,
    'canceled_at', _task.canceled_at,
    'disposition', _task.disposition,
    'deleted_at', _task.deleted_at,
    'deletion_root_id', _task.deletion_root_id,
    'destination', _task.destination,
    'today_section', _task.today_section,
    'order_key', _task.order_key,
    'area_id', _task.area_id,
    'hierarchy_order_key', _task.hierarchy_order_key,
    'start_date', _task.start_date,
    'deadline', _task.deadline,
    'source_kind', _task.source_kind,
    'source_url', _task.source_url,
    'source_title', _task.source_title,
    'source_external_id', _task.source_external_id,
    'primary_link', _task.primary_link,
    'actionability', _task.actionability
  );
$$;

CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_snapshot_v7(
  _snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _destination text;
  _start_date text;
  _today_section text;
  _primary_link text;
BEGIN
  IF _snapshot IS NULL OR _snapshot = 'null'::jsonb THEN
    RETURN NULL;
  END IF;
  _destination := CASE
    WHEN _snapshot ->> 'destination' IN ('inbox', 'today') THEN 'anytime'
    ELSE COALESCE(_snapshot ->> 'destination', 'anytime')
  END;
  _start_date := _snapshot ->> 'start_date';
  _today_section := CASE _snapshot ->> 'today_section'
    WHEN 'inbox' THEN 'inbox'
    WHEN 'now' THEN 'now'
    WHEN 'next' THEN 'next'
    WHEN 'later' THEN 'later'
    WHEN 'evening' THEN 'later'
    ELSE NULL
  END;
  IF _destination = 'someday' THEN
    _start_date := NULL;
    _today_section := NULL;
  ELSIF _start_date IS NOT NULL THEN
    _today_section := NULL;
  END IF;
  _primary_link := NULLIF(btrim(_snapshot ->> 'primary_link'), '');
  RETURN jsonb_build_object(
    'title', _snapshot -> 'title',
    'notes', COALESCE(_snapshot -> 'notes', '""'::jsonb),
    'lifecycle', COALESCE(_snapshot -> 'lifecycle', '"open"'::jsonb),
    'completed_at', _snapshot -> 'completed_at',
    'canceled_at', _snapshot -> 'canceled_at',
    'disposition', COALESCE(_snapshot -> 'disposition', '"present"'::jsonb),
    'deleted_at', _snapshot -> 'deleted_at',
    'deletion_root_id', _snapshot -> 'deletion_root_id',
    'destination', to_jsonb(_destination),
    'today_section', to_jsonb(_today_section),
    'order_key', _snapshot -> 'order_key',
    'area_id', _snapshot -> 'area_id',
    'hierarchy_order_key', _snapshot -> 'hierarchy_order_key',
    'start_date', to_jsonb(_start_date),
    'deadline', _snapshot -> 'deadline',
    'source_kind', COALESCE(_snapshot -> 'source_kind', '"manual"'::jsonb),
    'source_url', _snapshot -> 'source_url',
    'source_title', _snapshot -> 'source_title',
    'source_external_id', _snapshot -> 'source_external_id',
    'primary_link', to_jsonb(_primary_link),
    'actionability', to_jsonb(
      COALESCE(_snapshot ->> 'actionability', 'actionable')
    )
  );
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.append_todo_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _base_revision bigint;
  _before_state jsonb;
  _after_state jsonb;
  _transition text;
  _history_source public.tasks_history_events;
  _source_before jsonb;
  _source_after jsonb;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tasks_private.restore_contexts AS context
    WHERE context.backend_pid = pg_backend_pid()
      AND context.transaction_id = txid_current()
      AND context.owner_id = NEW.owner_id
  ) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL
    AND auth.uid() IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Task history owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;
  _after_state := tasks_private.todo_snapshot_v7(NEW);
  IF TG_OP = 'INSERT' THEN
    IF NEW.undo_source_event_id IS NOT NULL THEN
      RAISE EXCEPTION 'A new task cannot be an undo or redo mutation'
        USING ERRCODE = '23514';
    END IF;
    _base_revision := 0;
    _before_state := NULL;
    _transition := 'create';
  ELSE
    _base_revision := OLD.revision;
    _before_state := tasks_private.todo_snapshot_v7(OLD);
    IF NEW.undo_source_event_id IS NOT NULL THEN
      SELECT event.* INTO _history_source
      FROM public.tasks_history_events AS event
      WHERE event.id = NEW.undo_source_event_id
        AND event.owner_id = NEW.owner_id
        AND event.task_id = NEW.id;
      _source_before := tasks_private.normalize_todo_snapshot_v7(
        _history_source.before_state
      );
      _source_after := tasks_private.normalize_todo_snapshot_v7(
        _history_source.after_state
      );
      IF NOT FOUND
        OR _history_source.transition IN (
          'baseline', 'create', 'undo', 'redo'
        )
        OR _source_before IS NULL THEN
        RAISE EXCEPTION 'The requested task history traversal is no longer safe'
          USING ERRCODE = '23514';
      ELSIF _before_state IS NOT DISTINCT FROM _source_after
        AND _after_state IS NOT DISTINCT FROM _source_before THEN
        _transition := 'undo';
      ELSIF _before_state IS NOT DISTINCT FROM _source_before
        AND _after_state IS NOT DISTINCT FROM _source_after THEN
        _transition := 'redo';
      ELSE
        RAISE EXCEPTION 'The requested task history traversal is no longer safe'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.lifecycle IS DISTINCT FROM OLD.lifecycle THEN
      _transition := CASE NEW.lifecycle
        WHEN 'completed' THEN 'complete'
        WHEN 'canceled' THEN 'cancel'
        ELSE 'reopen'
      END;
    ELSIF NEW.disposition IS DISTINCT FROM OLD.disposition THEN
      _transition := CASE NEW.disposition
        WHEN 'deleted' THEN 'delete'
        ELSE 'restore'
      END;
    ELSIF NEW.actionability IS DISTINCT FROM OLD.actionability THEN
      _transition := 'set_actionability';
    ELSIF NEW.destination IS DISTINCT FROM OLD.destination
      OR NEW.today_section IS DISTINCT FROM OLD.today_section
      OR NEW.area_id IS DISTINCT FROM OLD.area_id THEN
      _transition := 'move';
    ELSIF NEW.order_key IS DISTINCT FROM OLD.order_key
      OR NEW.hierarchy_order_key IS DISTINCT FROM OLD.hierarchy_order_key THEN
      _transition := 'reorder';
    ELSE
      _transition := 'update';
    END IF;
  END IF;
  INSERT INTO public.tasks_history_events (
    owner_id, task_id, client_mutation_id, actor_type, mutation_channel,
    affected_ids, base_revision, result_revision, transition, occurred_at,
    outcome, code, before_state, after_state
  ) VALUES (
    NEW.owner_id, NEW.id, NEW.client_mutation_id, NEW.last_actor_type,
    NEW.last_mutation_channel, ARRAY[NEW.id], _base_revision, NEW.revision,
    _transition, NEW.updated_at, 'accepted', NULL, _before_state, _after_state
  );
  RETURN NEW;
END;
$$;

ALTER TABLE public.tasks_todos
  DROP CONSTRAINT IF EXISTS tasks_todos_project_owner_fkey,
  DROP CONSTRAINT IF EXISTS tasks_todos_container_valid,
  DROP COLUMN project_id;

CREATE OR REPLACE FUNCTION tasks_private.anchor_reminder_to_root_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _effective_date date;
  _resolved_at timestamptz;
  _resolution_kind text;
BEGIN
  _effective_date := tasks_private.root_effective_reminder_date(
    NEW.owner_id, 'todo', NEW.task_id
  );
  IF _effective_date IS NULL AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'A reminder requires a Start date or Today horizon'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'active' THEN
    SELECT resolution.resolved_at, resolution.resolution_kind
    INTO _resolved_at, _resolution_kind
    FROM tasks_private.resolve_reminder_instant(
      _effective_date, NEW.local_time, NEW.time_zone, NEW.ambiguity_choice
    ) AS resolution;
    NEW.local_date := _effective_date;
    NEW.resolved_at := _resolved_at;
    NEW.resolution_kind := _resolution_kind;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.cancel_root_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (NEW.lifecycle <> 'open' OR NEW.disposition <> 'present')
    AND OLD.lifecycle = 'open'
    AND OLD.disposition = 'present' THEN
    WITH canceled AS (
      UPDATE public.tasks_reminders
      SET status = 'canceled',
          record_revision = record_revision + 1,
          last_mutation_channel = NEW.last_mutation_channel,
          last_actor_type = 'system',
          client_mutation_id = gen_random_uuid(),
          updated_at = clock_timestamp()
      WHERE owner_id = NEW.owner_id
        AND status = 'active'
        AND task_id = NEW.id
      RETURNING id
    ),
    canceled_occurrences AS (
      UPDATE public.tasks_reminder_occurrences AS occurrence
      SET status = 'canceled'
      FROM canceled
      WHERE occurrence.owner_id = NEW.owner_id
        AND occurrence.reminder_id = canceled.id
        AND occurrence.status = 'scheduled'
      RETURNING occurrence.id, occurrence.owner_id
    )
    UPDATE public.tasks_reminder_deliveries AS delivery
    SET status = 'canceled',
        updated_at = clock_timestamp()
    FROM canceled_occurrences
    WHERE delivery.occurrence_id = canceled_occurrences.id
      AND delivery.owner_id = canceled_occurrences.owner_id
      AND delivery.status NOT IN ('acknowledged', 'canceled');
  END IF;
  RETURN NEW;
END
$$;

ALTER TABLE public.tasks_reminders
  DROP CONSTRAINT IF EXISTS tasks_reminders_project_owner_fkey,
  DROP CONSTRAINT IF EXISTS tasks_reminders_root_shape_check,
  DROP CONSTRAINT IF EXISTS tasks_reminders_root_type_check,
  DROP COLUMN project_id,
  ADD CONSTRAINT tasks_reminders_root_type_check CHECK (root_type = 'todo'),
  ADD CONSTRAINT tasks_reminders_root_shape_check CHECK (
    root_type = 'todo' AND task_id IS NOT NULL
  );

ALTER TABLE public.tasks_templates
  DROP CONSTRAINT IF EXISTS tasks_templates_kind_valid,
  ADD CONSTRAINT tasks_templates_kind_valid CHECK (kind = 'todo');
ALTER TABLE public.tasks_template_revisions
  DROP CONSTRAINT IF EXISTS tasks_template_revisions_source_type_valid,
  ADD CONSTRAINT tasks_template_revisions_source_type_valid CHECK (source_type = 'todo');
ALTER TABLE public.tasks_template_instantiations
  DROP CONSTRAINT IF EXISTS tasks_template_instantiations_root_type_valid,
  ADD CONSTRAINT tasks_template_instantiations_root_type_valid CHECK (root_type = 'todo');
ALTER TABLE public.tasks_recurrence_occurrences
  DROP CONSTRAINT IF EXISTS tasks_recurrence_occurrences_root_type_valid,
  ADD CONSTRAINT tasks_recurrence_occurrences_root_type_valid CHECK (root_type = 'todo');
ALTER TABLE public.tasks_hierarchy_operations
  DROP CONSTRAINT IF EXISTS tasks_hierarchy_operations_kind_valid,
  DROP CONSTRAINT IF EXISTS tasks_hierarchy_operations_operation_valid,
  DROP CONSTRAINT IF EXISTS tasks_hierarchy_operations_root_type_valid,
  ADD CONSTRAINT tasks_hierarchy_operations_operation_valid CHECK (
    operation IN ('delete', 'restore')
  ),
  ADD CONSTRAINT tasks_hierarchy_operations_root_type_valid CHECK (
    root_type IN ('area', 'todo', 'checklist_item')
  ),
  ADD CONSTRAINT tasks_hierarchy_operations_kind_valid CHECK (
    operation IN ('delete', 'restore')
  );
ALTER TABLE public.tasks_hierarchy_history_events
  DROP CONSTRAINT IF EXISTS tasks_hierarchy_history_entity_type_valid,
  ADD CONSTRAINT tasks_hierarchy_history_entity_type_valid CHECK (
    entity_type IN ('area', 'todo', 'checklist_item')
  );
ALTER TABLE tasks_private.permanent_deletion_receipts
  DROP CONSTRAINT IF EXISTS permanent_deletion_receipts_root_type_check,
  ADD CONSTRAINT permanent_deletion_receipts_root_type_check CHECK (root_type = 'todo');
ALTER TABLE tasks_private.purged_creation_receipts
  DROP CONSTRAINT IF EXISTS purged_creation_receipts_entity_type_check,
  ADD CONSTRAINT purged_creation_receipts_entity_type_check CHECK (
    entity_type IN ('area', 'todo', 'checklist_item')
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'powersync'
      AND schemaname = 'public'
      AND tablename = 'tasks_projects'
  ) THEN
    ALTER PUBLICATION powersync DROP TABLE public.tasks_projects;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tasks_powersync_role') THEN
    REVOKE ALL ON TABLE public.tasks_projects FROM tasks_powersync_role;
  END IF;
END
$$;
DROP TABLE public.tasks_projects;

CREATE OR REPLACE FUNCTION tasks_private.export_v13_collection(
  _collection text,
  _owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _records jsonb;
BEGIN
  IF _collection NOT IN (
    'tasks_areas', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings',
    'tasks_mail_sources', 'tasks_mail_source_events',
    'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ) THEN
    RAISE EXCEPTION 'Unsupported task export collection' USING ERRCODE = '22023';
  END IF;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(record_json ORDER BY record_json::text), ''[]''::jsonb)
       FROM (
         SELECT to_jsonb(record) - ''owner_id'' AS record_json
         FROM public.%I AS record
         WHERE record.owner_id = $1
       ) AS exported',
    _collection
  ) INTO _records USING _owner_id;
  RETURN _records;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.export_v13_collection(text, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v13()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _collection text;
  _records jsonb;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings',
    'tasks_mail_sources', 'tasks_mail_source_events',
    'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data'
      USING ERRCODE = '42501';
  END IF;
  FOREACH _collection IN ARRAY _collections LOOP
    _records := tasks_private.export_v13_collection(_collection, _owner_id);
    _data := _data || jsonb_build_object(_collection, _records);
    _counts := _counts || jsonb_build_object(_collection, jsonb_array_length(_records));
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 13,
    'created_at', clock_timestamp(),
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections),
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v13() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v13() TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.export_v13_as_v12_for_validation(
  _envelope jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _records jsonb;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings',
    'tasks_mail_sources', 'tasks_mail_source_events',
    'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
BEGIN
  FOREACH _collection IN ARRAY _collections LOOP
    IF _collection = 'tasks_projects' THEN
      _records := '[]'::jsonb;
    ELSIF _collection = 'tasks_todos' THEN
      SELECT COALESCE(
        jsonb_agg(record || jsonb_build_object('project_id', NULL)
          ORDER BY record ->> 'id'),
        '[]'::jsonb
      )
      INTO _records
      FROM jsonb_array_elements(
        COALESCE(_envelope #> '{data,tasks_todos}', '[]'::jsonb)
      ) AS record;
    ELSIF _collection = 'tasks_reminders' THEN
      SELECT COALESCE(
        jsonb_agg(record || jsonb_build_object('project_id', NULL)
          ORDER BY record ->> 'id'),
        '[]'::jsonb
      )
      INTO _records
      FROM jsonb_array_elements(
        COALESCE(_envelope #> '{data,tasks_reminders}', '[]'::jsonb)
      ) AS record;
    ELSE
      _records := COALESCE(
        _envelope #> ARRAY['data', _collection],
        '[]'::jsonb
      );
    END IF;
    _data := _data || jsonb_build_object(_collection, _records);
    _counts := _counts
      || jsonb_build_object(_collection, jsonb_array_length(_records));
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 12,
    'created_at', _envelope -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections),
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.export_v13_as_v12_for_validation(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v13(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _records jsonb;
  _expected_collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings',
    'tasks_mail_sources', 'tasks_mail_source_events',
    'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
BEGIN
  IF jsonb_typeof(_envelope) <> 'object'
    OR _envelope ->> 'format' <> 'garden.bath.tasks.export'
    OR _envelope ->> 'schema_version' <> '13'
    OR jsonb_typeof(_envelope -> 'manifest') <> 'object'
    OR jsonb_typeof(_envelope -> 'data') <> 'object'
    OR _envelope #>> '{manifest,checksums,algorithm}' <> 'sha256'
    OR (_envelope #> '{manifest,collections}') IS DISTINCT FROM to_jsonb(_expected_collections)
    OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(_envelope -> 'data') AS key)
      IS DISTINCT FROM (SELECT array_agg(value ORDER BY value) FROM unnest(_expected_collections) value)
  THEN
    RAISE EXCEPTION 'Task export schema thirteen is invalid' USING ERRCODE = '22023';
  END IF;

  FOREACH _collection IN ARRAY _expected_collections LOOP
    _records := _envelope #> ARRAY['data', _collection];
    IF jsonb_typeof(_records) <> 'array'
      OR (_envelope #>> ARRAY['manifest', 'counts', _collection]) !~ '^[0-9]+$'
      OR (_envelope #>> ARRAY['manifest', 'counts', _collection])::bigint
        <> jsonb_array_length(_records)
      OR (_envelope #>> ARRAY['manifest', 'checksums', _collection])
        IS DISTINCT FROM tasks_private.export_checksum(_records)
    THEN
      RAISE EXCEPTION 'Task export collection % is invalid', _collection
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
  PERFORM tasks_private.validate_export_v12(
    tasks_private.export_v13_as_v12_for_validation(_envelope)
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v13(jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION tasks_private.upgrade_export_to_v13(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _v12 jsonb;
  _projects jsonb;
  _project_ids text[];
  _todo_template_ids text[];
  _todo_recurrence_ids text[];
  _collection text;
  _records jsonb;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings',
    'tasks_mail_sources', 'tasks_mail_source_events',
    'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
BEGIN
  IF (_envelope ->> 'schema_version')::integer = 13 THEN
    PERFORM tasks_private.validate_export_v13(_envelope);
    RETURN _envelope;
  END IF;

  _v12 := tasks_private.upgrade_export_to_v12(_envelope);
  _projects := COALESCE(_v12 #> '{data,tasks_projects}', '[]'::jsonb);
  SELECT COALESCE(array_agg(project ->> 'id'), ARRAY[]::text[])
  INTO _project_ids
  FROM jsonb_array_elements(_projects) AS project;
  SELECT COALESCE(array_agg(template ->> 'id'), ARRAY[]::text[])
  INTO _todo_template_ids
  FROM jsonb_array_elements(
    COALESCE(_v12 #> '{data,tasks_templates}', '[]'::jsonb)
  ) AS template
  WHERE template ->> 'kind' = 'todo';
  SELECT COALESCE(array_agg(DISTINCT revision ->> 'recurrence_id'), ARRAY[]::text[])
  INTO _todo_recurrence_ids
  FROM jsonb_array_elements(
    COALESCE(_v12 #> '{data,tasks_recurrence_revisions}', '[]'::jsonb)
  ) AS revision
  WHERE revision ->> 'template_id' = ANY(_todo_template_ids);

  FOREACH _collection IN ARRAY _collections LOOP
    IF _collection = 'tasks_todos' THEN
      SELECT COALESCE(jsonb_agg(
        (task - 'project_id') || jsonb_build_object(
          'area_id', COALESCE(
            NULLIF(task -> 'area_id', 'null'::jsonb),
            (
              SELECT project -> 'area_id'
              FROM jsonb_array_elements(_projects) AS project
              WHERE project ->> 'id' = task ->> 'project_id'
            ),
            'null'::jsonb
          )
        )
        ORDER BY task ->> 'id'
      ), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> '{data,tasks_todos}') AS task;
    ELSIF _collection = 'tasks_history_events' THEN
      SELECT COALESCE(jsonb_agg(
        event
          || jsonb_build_object(
            'before_state', CASE
              WHEN event -> 'before_state' IS NULL
                OR event -> 'before_state' = 'null'::jsonb THEN 'null'::jsonb
              ELSE ((event -> 'before_state') - 'project_id')
                || jsonb_build_object(
                  'area_id', COALESCE(
                    NULLIF(event #> '{before_state,area_id}', 'null'::jsonb),
                    (
                      SELECT project -> 'area_id'
                      FROM jsonb_array_elements(_projects) AS project
                      WHERE project ->> 'id'
                        = event #>> '{before_state,project_id}'
                    ),
                    'null'::jsonb
                  )
                )
            END,
            'after_state', ((event -> 'after_state') - 'project_id')
              || jsonb_build_object(
                'area_id', COALESCE(
                  NULLIF(event #> '{after_state,area_id}', 'null'::jsonb),
                  (
                    SELECT project -> 'area_id'
                    FROM jsonb_array_elements(_projects) AS project
                    WHERE project ->> 'id'
                      = event #>> '{after_state,project_id}'
                  ),
                  'null'::jsonb
                )
              )
          )
        ORDER BY event ->> 'id'
      ), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> '{data,tasks_history_events}') AS event;
    ELSIF _collection = 'tasks_hierarchy_operations' THEN
      SELECT COALESCE(jsonb_agg(
        operation
          || jsonb_build_object(
            'expected_revisions',
              COALESCE(operation -> 'expected_revisions', '{}'::jsonb) - _project_ids,
            'result_revisions',
              COALESCE(operation -> 'result_revisions', '{}'::jsonb) - _project_ids,
            'affected_ids', (
              SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
              FROM jsonb_array_elements(COALESCE(operation -> 'affected_ids', '[]'::jsonb)) value
              WHERE value #>> '{}' <> ALL(_project_ids)
            )
          )
        ORDER BY operation ->> 'id'
      ), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> '{data,tasks_hierarchy_operations}') AS operation
      WHERE operation ->> 'root_type' <> 'project'
        AND operation ->> 'operation' IN ('delete', 'restore');
    ELSIF _collection = 'tasks_hierarchy_history_events' THEN
      SELECT COALESCE(jsonb_agg(event ORDER BY event ->> 'id'), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> '{data,tasks_hierarchy_history_events}') AS event
      WHERE event ->> 'entity_type' <> 'project';
    ELSIF _collection = 'tasks_templates' THEN
      SELECT COALESCE(jsonb_agg(record ORDER BY record ->> 'id'), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> '{data,tasks_templates}') AS record
      WHERE record ->> 'kind' = 'todo';
    ELSIF _collection = 'tasks_template_revisions' THEN
      SELECT COALESCE(jsonb_agg(record ORDER BY record ->> 'id'), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> '{data,tasks_template_revisions}') AS record
      WHERE record ->> 'source_type' = 'todo';
    ELSIF _collection = 'tasks_template_instantiations' THEN
      SELECT COALESCE(jsonb_agg(record ORDER BY record ->> 'id'), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> '{data,tasks_template_instantiations}') AS record
      WHERE record ->> 'root_type' = 'todo';
    ELSIF _collection = 'tasks_recurrence_occurrences' THEN
      SELECT COALESCE(jsonb_agg(record ORDER BY record ->> 'id'), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> '{data,tasks_recurrence_occurrences}') AS record
      WHERE record ->> 'root_type' = 'todo'
        AND record ->> 'recurrence_id' = ANY(_todo_recurrence_ids);
    ELSIF _collection = 'tasks_recurrence_definitions' THEN
      SELECT COALESCE(jsonb_agg(record ORDER BY record ->> 'id'), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> '{data,tasks_recurrence_definitions}') AS record
      WHERE record ->> 'id' = ANY(_todo_recurrence_ids);
    ELSIF _collection = 'tasks_recurrence_revisions' THEN
      SELECT COALESCE(jsonb_agg(record ORDER BY record ->> 'id'), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> '{data,tasks_recurrence_revisions}') AS record
      WHERE record ->> 'recurrence_id' = ANY(_todo_recurrence_ids)
        AND record ->> 'template_id' = ANY(_todo_template_ids);
    ELSIF _collection IN (
      'tasks_recurrence_evaluations',
      'tasks_recurrence_status_events'
    ) THEN
      SELECT COALESCE(jsonb_agg(record ORDER BY record ->> 'id'), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> ARRAY['data', _collection]) AS record
      WHERE record ->> 'recurrence_id' = ANY(_todo_recurrence_ids);
    ELSIF _collection = 'tasks_reminders' THEN
      SELECT COALESCE(jsonb_agg(record - 'project_id' ORDER BY record ->> 'id'), '[]'::jsonb)
      INTO _records
      FROM jsonb_array_elements(_v12 #> '{data,tasks_reminders}') AS record
      WHERE record ->> 'root_type' = 'todo';
    ELSE
      _records := COALESCE(_v12 #> ARRAY['data', _collection], '[]'::jsonb);
    END IF;
    _data := _data || jsonb_build_object(_collection, _records);
    _counts := _counts || jsonb_build_object(_collection, jsonb_array_length(_records));
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 13,
    'created_at', _v12 -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections),
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.upgrade_export_to_v13(jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v13(
  _envelope jsonb,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _collection text;
  _table regclass;
  _collection_report jsonb;
  _record jsonb;
  _report jsonb := jsonb_build_object('schema_version', 13, 'dry_run', _dry_run);
  _conflicts bigint := 0;
  _inserts bigint := 0;
  _collections constant text[] := ARRAY[
    'tasks_user_settings', 'tasks_areas', 'tasks_templates',
    'tasks_template_revisions', 'tasks_template_instantiations',
    'tasks_recurrence_definitions', 'tasks_recurrence_revisions',
    'tasks_todos', 'tasks_checklist_items', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_reminders',
    'tasks_reminder_occurrences'
  ];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v13(_envelope);

  FOREACH _collection IN ARRAY _collections LOOP
    _table := ('public.' || _collection)::regclass;
    IF _collection = 'tasks_mail_sources' THEN
      _collection_report := tasks_private.classify_restore_v5_mail_sources(
        _owner_id, _envelope #> ARRAY['data', _collection]
      );
    ELSE
      _collection_report := tasks_private.classify_restore_v4_collection(
        _owner_id, _table, _envelope #> ARRAY['data', _collection],
        _collection <> 'tasks_hierarchy_operations'
      );
    END IF;
    _report := _report || jsonb_build_object(_collection, _collection_report);
    _conflicts := _conflicts + (_collection_report ->> 'conflicts')::bigint;
    _inserts := _inserts + (_collection_report ->> 'inserts')::bigint;
  END LOOP;

  IF NOT _dry_run AND _conflicts = 0 AND _inserts > 0 THEN
    SET CONSTRAINTS ALL DEFERRED;
    INSERT INTO tasks_private.restore_contexts (backend_pid, transaction_id, owner_id)
    VALUES (pg_backend_pid(), txid_current(), _owner_id);
    FOREACH _collection IN ARRAY _collections LOOP
      _table := ('public.' || _collection)::regclass;
      IF _collection = 'tasks_mail_sources' THEN
        FOR _record IN
          SELECT value
          FROM jsonb_array_elements(_envelope #> ARRAY['data', _collection])
        LOOP
          IF _report -> _collection -> 'insert_ids'
            @> jsonb_build_array(_record -> 'task_id') THEN
            INSERT INTO public.tasks_mail_sources
            SELECT (jsonb_populate_record(
              NULL::public.tasks_mail_sources,
              (_record - 'owner_id') || jsonb_build_object('owner_id', _owner_id)
            )).*;
          END IF;
        END LOOP;
      ELSE
        PERFORM tasks_private.insert_restore_v4_collection(
          _owner_id, _table, _envelope #> ARRAY['data', _collection],
          _report -> _collection
        );
      END IF;
    END LOOP;
    DELETE FROM tasks_private.restore_contexts
    WHERE backend_pid = pg_backend_pid()
      AND transaction_id = txid_current()
      AND owner_id = _owner_id;
    _report := _report || jsonb_build_object('applied', true, 'code', NULL);
  ELSIF NOT _dry_run AND _conflicts = 0 THEN
    _report := _report || jsonb_build_object(
      'applied', false, 'code', 'already_applied'
    );
  ELSE
    _report := _report || jsonb_build_object(
      'applied', false,
      'code', CASE WHEN _conflicts > 0 THEN 'restore_conflict' ELSE NULL END
    );
  END IF;
  RETURN _report;
END
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v13(jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v13(jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_current(
  _envelope jsonb,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _upgraded jsonb;
BEGIN
  _upgraded := tasks_private.upgrade_export_to_v13(_envelope);
  RETURN public.tasks_restore_export_v13(_upgraded, _dry_run);
END
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_current(jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_current(jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.lock_replace_restore_scope()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  LOCK TABLE
    public.tasks_areas, public.tasks_todos, public.tasks_checklist_items,
    public.tasks_history_events, public.tasks_hierarchy_operations,
    public.tasks_hierarchy_history_events, public.tasks_user_settings,
    public.tasks_mail_sources, public.tasks_mail_source_events,
    public.tasks_templates, public.tasks_template_revisions,
    public.tasks_template_instantiations, public.tasks_recurrence_definitions,
    public.tasks_recurrence_revisions, public.tasks_recurrence_occurrences,
    public.tasks_recurrence_evaluations, public.tasks_recurrence_status_events,
    public.tasks_reminders, public.tasks_reminder_occurrences,
    public.tasks_reminder_deliveries, public.tasks_reminder_claims,
    tasks_private.permanent_deletion_receipts,
    tasks_private.replace_restore_receipts
  IN SHARE ROW EXCLUSIVE MODE;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.lock_replace_restore_scope() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.tasks_prepare_replace_restore_v13(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _backup jsonb;
  _preview jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to prepare task replacement'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v13(_envelope);
  _backup := public.tasks_create_export_v13();
  _preview := public.tasks_restore_export_v13(_envelope, true);
  RETURN jsonb_build_object(
    'schema_version', 13,
    'backup', _backup,
    'backup_digest', tasks_private.export_checksum(_backup - 'created_at'),
    'current_counts', _backup #> '{manifest,counts}',
    'incoming_counts', _envelope #> '{manifest,counts}',
    'restore_preview', _preview
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_prepare_replace_restore_v13(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tasks_prepare_replace_restore_v13(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_replace_restore_v13(
  _envelope jsonb,
  _expected_backup_digest text,
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
  _target_digest text;
  _request_digest text;
  _receipt tasks_private.replace_restore_receipts;
  _backup jsonb;
  _backup_digest text;
  _restore_report jsonb;
  _result jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to replace task data'
      USING ERRCODE = '42501';
  END IF;
  IF _confirmation IS DISTINCT FROM 'REPLACE TASK DATA' THEN
    RAISE EXCEPTION 'Task replacement requires explicit confirmation'
      USING ERRCODE = '22023';
  END IF;
  IF _request_id IS NULL
    OR _expected_backup_digest IS NULL
    OR _expected_backup_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'The pre-restore backup input is invalid'
      USING ERRCODE = '22023';
  END IF;
  PERFORM tasks_private.validate_export_v13(_envelope);
  _target_digest := tasks_private.export_checksum(_envelope);
  _request_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'backup_digest', _expected_backup_digest,
    'target_digest', _target_digest
  )::text, 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO _receipt
  FROM tasks_private.replace_restore_receipts AS receipt
  WHERE receipt.request_id = _request_id
    AND receipt.owner_id = _owner_id;
  IF FOUND THEN
    IF _receipt.request_digest IS DISTINCT FROM _request_digest THEN
      RAISE EXCEPTION 'Task replacement request identifier was reused with different input'
        USING ERRCODE = '22023';
    END IF;
    RETURN _receipt.result;
  END IF;

  PERFORM tasks_private.lock_replace_restore_scope();
  PERFORM pg_advisory_xact_lock(
    hashtextextended('tasks-replace-restore:' || _owner_id::text, 0)
  );
  _backup := public.tasks_create_export_v13();
  _backup_digest := tasks_private.export_checksum(_backup - 'created_at');
  IF _backup_digest IS DISTINCT FROM _expected_backup_digest THEN
    RAISE EXCEPTION 'The pre-restore backup is stale' USING ERRCODE = '40001';
  END IF;

  SET CONSTRAINTS ALL DEFERRED;
  DELETE FROM public.tasks_reminder_deliveries WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminder_claims WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminder_occurrences WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminders WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_status_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_evaluations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_occurrences WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_revisions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_definitions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_template_instantiations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_template_revisions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_templates WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_mail_source_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_mail_sources WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_history_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_hierarchy_history_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_hierarchy_operations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_checklist_items WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_todos WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_areas WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_user_settings WHERE owner_id = _owner_id;
  DELETE FROM tasks_private.permanent_deletion_receipts WHERE owner_id = _owner_id;
  DELETE FROM tasks_private.purged_creation_receipts WHERE owner_id = _owner_id;

  _restore_report := public.tasks_restore_export_v13(_envelope, false);
  IF COALESCE((_restore_report ->> 'applied')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Task replacement restore was rejected'
      USING ERRCODE = '40001', DETAIL = _restore_report::text;
  END IF;
  _result := jsonb_build_object(
    'outcome', 'accepted',
    'schema_version', 13,
    'request_id', _request_id,
    'backup_digest', _expected_backup_digest,
    'target_digest', _target_digest,
    'removed_counts', _backup #> '{manifest,counts}',
    'restore_report', _restore_report
  );
  INSERT INTO tasks_private.replace_restore_receipts (
    request_id, owner_id, request_digest, result
  ) VALUES (_request_id, _owner_id, _request_digest, _result);
  RETURN _result;
END
$$;

REVOKE ALL ON FUNCTION public.tasks_replace_restore_v13(
  jsonb, text, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tasks_replace_restore_v13(
  jsonb, text, uuid, text
) TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.root_effective_reminder_date(
  _owner_id uuid,
  _root_type text,
  _root_id uuid
)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _start_date date;
  _today_section text;
  _planning_date date;
BEGIN
  IF _root_type <> 'todo' THEN
    RETURN NULL;
  END IF;
  SELECT task.start_date, task.today_section
  INTO _start_date, _today_section
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id
    AND task.id = _root_id
    AND task.disposition = 'present'
    AND task.lifecycle = 'open';
  IF _start_date IS NOT NULL THEN
    RETURN _start_date;
  END IF;
  IF _today_section IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT (
    clock_timestamp() AT TIME ZONE COALESCE(settings.planning_timezone, 'UTC')
  )::date
  INTO _planning_date
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.tasks_user_settings AS settings
    ON settings.owner_id = _owner_id;
  RETURN _planning_date;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.root_effective_reminder_date(
  uuid, text, uuid
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.rebind_root_reminder_to_start_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _reminder public.tasks_reminders;
  _effective_date date;
  _resolved_at timestamptz;
  _resolution_kind text;
  _mutation_id uuid;
  _automatic_activation boolean := COALESCE(
    current_setting('garden.bath.tasks_activation', true), ''
  ) = 'on';
BEGIN
  IF NEW.start_date IS NOT DISTINCT FROM OLD.start_date
    AND NEW.today_section IS NOT DISTINCT FROM OLD.today_section THEN
    RETURN NEW;
  END IF;
  _effective_date := tasks_private.root_effective_reminder_date(
    NEW.owner_id, 'todo', NEW.id
  );
  IF _automatic_activation
    AND OLD.start_date IS NOT NULL
    AND NEW.start_date IS NULL
    AND NEW.today_section IS NOT NULL THEN
    _effective_date := OLD.start_date;
  END IF;

  FOR _reminder IN
    SELECT reminder.*
    FROM public.tasks_reminders AS reminder
    WHERE reminder.owner_id = NEW.owner_id
      AND reminder.status = 'active'
      AND reminder.task_id = NEW.id
    FOR UPDATE
  LOOP
    IF _effective_date IS NOT NULL
      AND _effective_date = _reminder.local_date THEN
      CONTINUE;
    END IF;
    _mutation_id := gen_random_uuid();
    UPDATE public.tasks_reminder_occurrences
    SET status = 'canceled'
    WHERE owner_id = NEW.owner_id
      AND reminder_id = _reminder.id
      AND status = 'scheduled';
    UPDATE public.tasks_reminder_deliveries AS delivery
    SET status = 'canceled', updated_at = clock_timestamp()
    FROM public.tasks_reminder_occurrences AS occurrence
    WHERE occurrence.id = delivery.occurrence_id
      AND occurrence.owner_id = delivery.owner_id
      AND occurrence.owner_id = NEW.owner_id
      AND occurrence.reminder_id = _reminder.id
      AND delivery.status NOT IN ('acknowledged', 'canceled');
    IF _effective_date IS NULL THEN
      UPDATE public.tasks_reminders
      SET status = 'canceled',
          record_revision = record_revision + 1,
          last_mutation_channel = NEW.last_mutation_channel,
          last_actor_type = 'system',
          client_mutation_id = _mutation_id,
          updated_at = clock_timestamp()
      WHERE id = _reminder.id AND owner_id = NEW.owner_id;
      CONTINUE;
    END IF;
    SELECT resolution.resolved_at, resolution.resolution_kind
    INTO _resolved_at, _resolution_kind
    FROM tasks_private.resolve_reminder_instant(
      _effective_date, _reminder.local_time, _reminder.time_zone,
      _reminder.ambiguity_choice
    ) AS resolution;
    UPDATE public.tasks_reminders
    SET local_date = _effective_date,
        resolved_at = _resolved_at,
        resolution_kind = _resolution_kind,
        record_revision = record_revision + 1,
        last_mutation_channel = NEW.last_mutation_channel,
        last_actor_type = 'system',
        client_mutation_id = _mutation_id,
        updated_at = clock_timestamp()
    WHERE id = _reminder.id AND owner_id = NEW.owner_id
    RETURNING * INTO _reminder;
    INSERT INTO public.tasks_reminder_occurrences (
      owner_id, reminder_id, reminder_revision, resolved_at, client_mutation_id
    ) VALUES (
      NEW.owner_id, _reminder.id, _reminder.record_revision,
      _reminder.resolved_at, _mutation_id
    );
  END LOOP;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tasks_todos_rebind_reminder_to_start_date
ON public.tasks_todos;
CREATE TRIGGER tasks_todos_rebind_reminder_to_start_date
AFTER UPDATE OF start_date, today_section ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.rebind_root_reminder_to_start_date();

REVOKE ALL ON FUNCTION tasks_private.rebind_root_reminder_to_start_date()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.activate_due_roots(
  _now timestamptz DEFAULT clock_timestamp(),
  _owner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _settings record;
  _planning_date date;
  _planning_midnight timestamptz;
  _last_rollover_date date;
  _rollover_count integer := 0;
  _owner_rollover_count integer := 0;
  _todo_count integer := 0;
  _changed_count integer := 0;
BEGIN
  PERFORM set_config('garden.bath.tasks_activation', 'on', true);
  FOR _settings IN
    SELECT settings.owner_id, settings.planning_timezone
    FROM public.tasks_user_settings AS settings
    WHERE _owner_id IS NULL OR settings.owner_id = _owner_id
    ORDER BY settings.owner_id
  LOOP
    _planning_date := (_now AT TIME ZONE _settings.planning_timezone)::date;
    _planning_midnight := (
      _planning_date::timestamp AT TIME ZONE _settings.planning_timezone
    );
    INSERT INTO tasks_private.today_rollover_state (
      owner_id, planning_date, updated_at
    ) VALUES (
      _settings.owner_id, _planning_date, _now
    ) ON CONFLICT (owner_id) DO NOTHING;
    SELECT state.planning_date
    INTO _last_rollover_date
    FROM tasks_private.today_rollover_state AS state
    WHERE state.owner_id = _settings.owner_id
    FOR UPDATE;
    IF _planning_date > _last_rollover_date THEN
      PERFORM set_config('garden.bath.tasks_rollover', 'on', true);
      UPDATE public.tasks_todos AS task
      SET today_section = 'inbox',
          revision = task.revision + 1,
          client_mutation_id = gen_random_uuid(),
          last_mutation_channel = 'native',
          last_actor_type = 'system',
          undo_source_event_id = NULL,
          updated_at = _now
      WHERE task.owner_id = _settings.owner_id
        AND task.destination = 'anytime'
        AND task.lifecycle = 'open'
        AND task.disposition = 'present'
        AND task.start_date IS NULL
        AND task.today_section IS NOT NULL
        AND task.today_section IS DISTINCT FROM 'inbox'
        AND task.updated_at < _planning_midnight;
      GET DIAGNOSTICS _changed_count = ROW_COUNT;
      _rollover_count := _rollover_count + _changed_count;
      PERFORM set_config('garden.bath.tasks_rollover', 'off', true);
      UPDATE tasks_private.today_rollover_state
      SET planning_date = _planning_date, updated_at = _now
      WHERE owner_id = _settings.owner_id;
      _owner_rollover_count := _owner_rollover_count + 1;
    END IF;
  END LOOP;
  UPDATE public.tasks_todos AS task
  SET start_date = NULL,
      today_section = 'inbox',
      revision = task.revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = 'native',
      last_actor_type = 'system',
      undo_source_event_id = NULL,
      updated_at = _now
  FROM public.tasks_user_settings AS settings
  WHERE settings.owner_id = task.owner_id
    AND (_owner_id IS NULL OR task.owner_id = _owner_id)
    AND task.destination = 'anytime'
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
    AND task.start_date IS NOT NULL
    AND task.start_date <= (_now AT TIME ZONE settings.planning_timezone)::date;
  GET DIAGNOSTICS _todo_count = ROW_COUNT;
  PERFORM set_config('garden.bath.tasks_activation', 'off', true);
  RETURN jsonb_build_object(
    'rolled_over_todos', _rollover_count,
    'rolled_over_owners', _owner_rollover_count,
    'activated_todos', _todo_count,
    'evaluated_at', _now
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.activate_due_roots(timestamptz, uuid)
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tasks_save_reminder(
  _reminder_id uuid,
  _expected_record_revision bigint,
  _root_type text,
  _root_id uuid,
  _local_date date,
  _local_time text,
  _time_zone text,
  _ambiguity_choice text,
  _mutation_id uuid,
  _mutation_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _parsed_time time(0) without time zone;
  _resolved_at timestamptz;
  _resolution_kind text;
  _reminder public.tasks_reminders;
  _occurrence public.tasks_reminder_occurrences;
  _existing public.tasks_reminders;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save reminders'
      USING ERRCODE = '42501';
  END IF;
  IF _root_type <> 'todo'
    OR _mutation_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation', 'browser_capture',
      'native', 'import'
    )
    OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
    RAISE EXCEPTION 'The reminder request is invalid' USING ERRCODE = '22023';
  END IF;
  BEGIN
    _parsed_time := _local_time::time(0);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'The reminder time is invalid' USING ERRCODE = '22023';
  END;
  IF NOT EXISTS (
    SELECT 1
    FROM public.tasks_todos AS task
    WHERE task.id = _root_id
      AND task.owner_id = _owner_id
      AND task.disposition = 'present'
      AND task.lifecycle = 'open'
  ) THEN
    RAISE EXCEPTION 'The reminder target is unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT resolution.resolved_at, resolution.resolution_kind
  INTO _resolved_at, _resolution_kind
  FROM tasks_private.resolve_reminder_instant(
    _local_date, _parsed_time, _time_zone, _ambiguity_choice
  ) AS resolution;

  IF _reminder_id IS NULL THEN
    SELECT reminder.* INTO _existing
    FROM public.tasks_reminders AS reminder
    WHERE reminder.owner_id = _owner_id
      AND reminder.status = 'active'
      AND reminder.task_id = _root_id
    FOR UPDATE;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'outcome', 'conflict',
        'reminder', to_jsonb(_existing)
      );
    END IF;
    INSERT INTO public.tasks_reminders (
      owner_id, root_type, task_id, local_date, local_time,
      time_zone, ambiguity_choice, resolved_at, resolution_kind,
      last_mutation_channel, last_actor_type, client_mutation_id
    ) VALUES (
      _owner_id, 'todo', _root_id, _local_date, _parsed_time,
      _time_zone, _ambiguity_choice, _resolved_at, _resolution_kind,
      _mutation_channel, _actor_type, _mutation_id
    )
    RETURNING * INTO _reminder;
  ELSE
    SELECT reminder.* INTO _reminder
    FROM public.tasks_reminders AS reminder
    WHERE reminder.id = _reminder_id
      AND reminder.owner_id = _owner_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The reminder is unavailable' USING ERRCODE = '22023';
    END IF;
    IF _reminder.client_mutation_id = _mutation_id THEN
      SELECT occurrence.* INTO _occurrence
      FROM public.tasks_reminder_occurrences AS occurrence
      WHERE occurrence.owner_id = _owner_id
        AND occurrence.reminder_id = _reminder.id
        AND occurrence.reminder_revision = _reminder.record_revision;
      RETURN jsonb_build_object(
        'outcome', 'already_applied',
        'reminder', to_jsonb(_reminder),
        'occurrence', to_jsonb(_occurrence)
      );
    END IF;
    IF _reminder.record_revision <> _expected_record_revision
      OR _reminder.root_type <> 'todo'
      OR _reminder.task_id <> _root_id THEN
      RETURN jsonb_build_object(
        'outcome', 'conflict',
        'reminder', to_jsonb(_reminder)
      );
    END IF;
    UPDATE public.tasks_reminder_occurrences
    SET status = 'canceled'
    WHERE owner_id = _owner_id
      AND reminder_id = _reminder.id
      AND status = 'scheduled';
    UPDATE public.tasks_reminder_deliveries AS delivery
    SET status = 'canceled', updated_at = clock_timestamp()
    FROM public.tasks_reminder_occurrences AS occurrence
    WHERE occurrence.id = delivery.occurrence_id
      AND occurrence.owner_id = delivery.owner_id
      AND occurrence.owner_id = _owner_id
      AND occurrence.reminder_id = _reminder.id
      AND delivery.status NOT IN ('acknowledged', 'canceled');
    UPDATE public.tasks_reminders
    SET local_date = _local_date,
        local_time = _parsed_time,
        time_zone = _time_zone,
        ambiguity_choice = _ambiguity_choice,
        resolved_at = _resolved_at,
        resolution_kind = _resolution_kind,
        status = 'active',
        record_revision = record_revision + 1,
        last_mutation_channel = _mutation_channel,
        last_actor_type = _actor_type,
        client_mutation_id = _mutation_id,
        updated_at = clock_timestamp()
    WHERE id = _reminder.id
      AND owner_id = _owner_id
    RETURNING * INTO _reminder;
  END IF;

  INSERT INTO public.tasks_reminder_occurrences (
    owner_id, reminder_id, reminder_revision, resolved_at,
    client_mutation_id
  ) VALUES (
    _owner_id, _reminder.id, _reminder.record_revision,
    _reminder.resolved_at, _mutation_id
  )
  RETURNING * INTO _occurrence;
  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'reminder', to_jsonb(_reminder),
    'occurrence', to_jsonb(_occurrence)
  );
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_save_start_reminder(
  _reminder_id uuid,
  _expected_record_revision bigint,
  _root_type text,
  _root_id uuid,
  _local_time text,
  _time_zone text,
  _ambiguity_choice text,
  _mutation_id uuid,
  _mutation_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _effective_date date;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save reminders'
      USING ERRCODE = '42501';
  END IF;
  IF _root_type <> 'todo' THEN
    RAISE EXCEPTION 'The reminder request is invalid' USING ERRCODE = '22023';
  END IF;
  _effective_date := tasks_private.root_effective_reminder_date(
    _owner_id, _root_type, _root_id
  );
  IF _effective_date IS NULL THEN
    RAISE EXCEPTION 'A reminder requires a Start date or Today horizon'
      USING ERRCODE = '22023';
  END IF;
  RETURN public.tasks_save_reminder(
    _reminder_id, _expected_record_revision, 'todo', _root_id,
    _effective_date, _local_time, _time_zone, _ambiguity_choice,
    _mutation_id, _mutation_channel, _actor_type
  );
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_claim_due_reminders(
  _through_at timestamptz,
  _request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _target public.tasks_delivery_targets;
  _claim public.tasks_reminder_claims;
  _items jsonb;
  _result jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to claim reminders'
      USING ERRCODE = '42501';
  END IF;
  SELECT claim.* INTO _claim
  FROM public.tasks_reminder_claims AS claim
  WHERE claim.id = _request_id AND claim.owner_id = _owner_id;
  IF FOUND THEN
    IF _claim.through_at IS DISTINCT FROM _through_at THEN
      RAISE EXCEPTION 'A reminder claim identifier cannot be reused with another time'
        USING ERRCODE = '23514';
    END IF;
    RETURN _claim.result;
  END IF;
  INSERT INTO public.tasks_delivery_targets (
    owner_id, channel, endpoint_key, label, capability_status,
    configuration, last_seen_at
  ) VALUES (
    _owner_id, 'in_app', 'account', 'In-App', 'active',
    '{}'::jsonb, clock_timestamp()
  )
  ON CONFLICT (owner_id, channel, endpoint_key) DO UPDATE
  SET capability_status = 'active',
      last_error_code = NULL,
      last_seen_at = clock_timestamp(),
      updated_at = clock_timestamp()
  RETURNING * INTO _target;

  INSERT INTO public.tasks_reminder_deliveries (
    owner_id, occurrence_id, target_id
  )
  SELECT _owner_id, occurrence.id, _target.id
  FROM public.tasks_reminder_occurrences AS occurrence
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id
   AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id
   AND task.owner_id = reminder.owner_id
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.status = 'scheduled'
    AND occurrence.resolved_at <= _through_at
    AND reminder.status = 'active'
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
  ON CONFLICT (owner_id, occurrence_id, target_id) DO NOTHING;

  WITH eligible AS (
    SELECT delivery.id
    FROM public.tasks_reminder_deliveries AS delivery
    JOIN public.tasks_reminder_occurrences AS occurrence
      ON occurrence.id = delivery.occurrence_id
     AND occurrence.owner_id = delivery.owner_id
    WHERE delivery.owner_id = _owner_id
      AND delivery.target_id = _target.id
      AND occurrence.resolved_at <= _through_at
      AND (
        delivery.status IN ('scheduled', 'failed')
        OR (
          delivery.status = 'attempted'
          AND delivery.last_attempted_at <= clock_timestamp() - interval '2 minutes'
        )
      )
    ORDER BY occurrence.resolved_at, delivery.id
    FOR UPDATE OF delivery SKIP LOCKED
  ),
  updated AS (
    UPDATE public.tasks_reminder_deliveries AS delivery
    SET status = 'attempted',
        attempt_count = attempt_count + 1,
        last_attempted_at = clock_timestamp(),
        last_error_code = NULL,
        updated_at = clock_timestamp()
    FROM eligible
    WHERE delivery.id = eligible.id
    RETURNING delivery.*
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'delivery_id', delivery.id,
    'occurrence_id', occurrence.id,
    'reminder_id', reminder.id,
    'root_type', 'todo',
    'root_id', reminder.task_id,
    'title', task.title,
    'resolved_at', occurrence.resolved_at,
    'attempt_count', delivery.attempt_count
  ) ORDER BY occurrence.resolved_at, delivery.id), '[]'::jsonb)
  INTO _items
  FROM updated AS delivery
  JOIN public.tasks_reminder_occurrences AS occurrence
    ON occurrence.id = delivery.occurrence_id
   AND occurrence.owner_id = delivery.owner_id
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id
   AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id
   AND task.owner_id = reminder.owner_id;
  _result := jsonb_build_object(
    'outcome', 'accepted',
    'through_at', _through_at,
    'items', _items
  );
  INSERT INTO public.tasks_reminder_claims(id, owner_id, through_at, result)
  VALUES (_request_id, _owner_id, _through_at, _result);
  RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_claim_web_push_deliveries(
  _through_at timestamptz,
  _limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _items jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authorization is required to dispatch Web Push'
      USING ERRCODE = '42501';
  END IF;
  IF _through_at IS NULL OR _limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'The Web Push claim is invalid' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.tasks_reminder_deliveries (
    owner_id, occurrence_id, target_id
  )
  SELECT occurrence.owner_id, occurrence.id, target.id
  FROM public.tasks_reminder_occurrences AS occurrence
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id
   AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_delivery_targets AS target
    ON target.owner_id = occurrence.owner_id
   AND target.channel = 'web_push'
   AND target.capability_status = 'active'
  JOIN public.tasks_web_push_subscriptions AS subscription
    ON subscription.target_id = target.id
   AND subscription.owner_id = target.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id
   AND task.owner_id = reminder.owner_id
  WHERE occurrence.status = 'scheduled'
    AND occurrence.resolved_at <= _through_at
    AND reminder.status = 'active'
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
    AND NOT EXISTS (
      SELECT 1
      FROM public.tasks_reminder_deliveries AS acknowledged
      WHERE acknowledged.owner_id = occurrence.owner_id
        AND acknowledged.occurrence_id = occurrence.id
        AND acknowledged.status = 'acknowledged'
    )
  ON CONFLICT (owner_id, occurrence_id, target_id) DO NOTHING;

  WITH eligible AS (
    SELECT delivery.id
    FROM public.tasks_reminder_deliveries AS delivery
    JOIN public.tasks_reminder_occurrences AS occurrence
      ON occurrence.id = delivery.occurrence_id
     AND occurrence.owner_id = delivery.owner_id
    JOIN public.tasks_delivery_targets AS target
      ON target.id = delivery.target_id
     AND target.owner_id = delivery.owner_id
    JOIN public.tasks_web_push_subscriptions AS subscription
      ON subscription.target_id = target.id
     AND subscription.owner_id = target.owner_id
    WHERE target.channel = 'web_push'
      AND target.capability_status = 'active'
      AND occurrence.status = 'scheduled'
      AND occurrence.resolved_at <= _through_at
      AND (
        delivery.status = 'scheduled'
        OR (
          delivery.status IN ('attempted', 'failed')
          AND delivery.last_attempted_at <= clock_timestamp() - interval '2 minutes'
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.tasks_reminder_deliveries AS acknowledged
        WHERE acknowledged.owner_id = delivery.owner_id
          AND acknowledged.occurrence_id = delivery.occurrence_id
          AND acknowledged.status = 'acknowledged'
      )
    ORDER BY occurrence.resolved_at, delivery.id
    LIMIT _limit
    FOR UPDATE OF delivery SKIP LOCKED
  ),
  updated AS (
    UPDATE public.tasks_reminder_deliveries AS delivery
    SET status = 'attempted',
        attempt_count = attempt_count + 1,
        last_attempted_at = clock_timestamp(),
        last_error_code = NULL,
        updated_at = clock_timestamp()
    FROM eligible
    WHERE delivery.id = eligible.id
    RETURNING delivery.*
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'delivery_id', delivery.id,
    'occurrence_id', occurrence.id,
    'reminder_id', reminder.id,
    'target_id', target.id,
    'root_type', 'todo',
    'root_id', reminder.task_id,
    'title', task.title,
    'resolved_at', occurrence.resolved_at,
    'attempt_count', delivery.attempt_count,
    'preview', COALESCE(target.configuration ->> 'preview', 'generic'),
    'navigate_url', '/tasks/' || CASE task.destination
      WHEN 'inbox' THEN 'inbox'
      WHEN 'anytime' THEN 'anytime'
      WHEN 'someday' THEN 'someday'
      ELSE 'today'
    END || '?reminder_delivery=' || delivery.id::text,
    'subscription', jsonb_build_object(
      'endpoint', subscription.endpoint,
      'keys', jsonb_build_object(
        'p256dh', subscription.p256dh,
        'auth', subscription.auth_secret
      )
    )
  ) ORDER BY occurrence.resolved_at, delivery.id), '[]'::jsonb)
  INTO _items
  FROM updated AS delivery
  JOIN public.tasks_reminder_occurrences AS occurrence
    ON occurrence.id = delivery.occurrence_id
   AND occurrence.owner_id = delivery.owner_id
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id
   AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_delivery_targets AS target
    ON target.id = delivery.target_id
   AND target.owner_id = delivery.owner_id
  JOIN public.tasks_web_push_subscriptions AS subscription
    ON subscription.target_id = target.id
   AND subscription.owner_id = target.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id
   AND task.owner_id = reminder.owner_id;
  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'through_at', _through_at,
    'items', _items
  );
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.append_hierarchy_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _entity_type text := CASE TG_TABLE_NAME
    WHEN 'tasks_areas' THEN 'area'
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
  IF _entity_type IS NULL THEN
    RAISE EXCEPTION 'Unsupported hierarchy history entity'
      USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' THEN
    _transition := 'create';
    _before_state := NULL;
    _base_revision := 0;
  ELSE
    _before_state := to_jsonb(OLD) - 'owner_id';
    _base_revision := OLD.revision;
    IF NEW.disposition IS DISTINCT FROM OLD.disposition THEN
      _transition := CASE NEW.disposition
        WHEN 'deleted' THEN 'delete'
        ELSE 'restore'
      END;
    ELSIF TG_TABLE_NAME = 'tasks_checklist_items'
      AND to_jsonb(NEW) -> 'task_id' IS DISTINCT FROM to_jsonb(OLD) -> 'task_id' THEN
      _transition := 'move';
    ELSIF NEW.order_key IS DISTINCT FROM OLD.order_key THEN
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
END
$$;

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
  RETURN NEW;
END
$$;

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
  IF _operation = 'restore' THEN
    RETURN QUERY
    SELECT 'area'::text, area.id, area.revision
    FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id
      AND area.deletion_root_id = _root_id
    UNION ALL
    SELECT 'todo', task.id, task.revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id
      AND task.deletion_root_id = _root_id
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id
      AND item.deletion_root_id = _root_id;
    RETURN;
  END IF;
  IF _root_type = 'area' THEN
    RETURN QUERY
    SELECT 'area'::text, area.id, area.revision
    FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id
      AND area.id = _root_id
      AND area.disposition = 'present'
    UNION ALL
    SELECT 'todo', task.id, task.revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id
      AND task.area_id = _root_id
      AND task.disposition = 'present'
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    JOIN public.tasks_todos AS task
      ON task.id = item.task_id
     AND task.owner_id = item.owner_id
    WHERE item.owner_id = _owner_id
      AND task.area_id = _root_id
      AND task.disposition = 'present'
      AND item.disposition = 'present';
  ELSIF _root_type = 'todo' THEN
    RETURN QUERY
    SELECT 'todo'::text, task.id, task.revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id
      AND task.id = _root_id
      AND task.disposition = 'present'
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id
      AND item.task_id = _root_id
      AND item.disposition = 'present';
  ELSE
    RETURN QUERY
    SELECT 'checklist_item'::text, item.id, item.revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id
      AND item.id = _root_id
      AND item.disposition = 'present';
  END IF;
END
$$;

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
  _root_found boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR (SELECT auth.uid()) IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Hierarchy operation owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;
  SELECT
    COALESCE(jsonb_object_agg(
      candidate.entity_id::text,
      candidate.revision
      ORDER BY candidate.entity_id
    ), '{}'::jsonb),
    COALESCE(
      array_agg(candidate.entity_id ORDER BY candidate.entity_id),
      ARRAY[]::uuid[]
    )
  INTO _current_revisions, _affected_ids
  FROM tasks_private.hierarchy_operation_candidates(
    NEW.owner_id, NEW.root_type, NEW.root_id,
    NEW.operation, NEW.descendant_policy
  ) AS candidate;
  _root_found := NEW.root_id::text = ANY(
    ARRAY(SELECT jsonb_object_keys(_current_revisions))
  );
  IF NOT _root_found THEN
    UPDATE public.tasks_hierarchy_operations
    SET outcome = 'rejected',
        code = 'root_not_found',
        completed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  IF _current_revisions IS DISTINCT FROM NEW.expected_revisions THEN
    UPDATE public.tasks_hierarchy_operations
    SET outcome = 'conflict',
        code = 'revision_set_changed',
        completed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  IF NEW.operation = 'restore'
    AND NEW.root_type = 'checklist_item'
    AND NOT EXISTS (
      SELECT 1
      FROM public.tasks_checklist_items AS item
      JOIN public.tasks_todos AS task
        ON task.id = item.task_id
       AND task.owner_id = item.owner_id
      WHERE item.owner_id = NEW.owner_id
        AND item.id = NEW.root_id
        AND task.disposition = 'present'
    ) THEN
    UPDATE public.tasks_hierarchy_operations
    SET outcome = 'rejected',
        code = 'parent_not_present',
        completed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO tasks_private.hierarchy_operation_contexts (
    backend_pid, transaction_id, owner_id, operation_id
  ) VALUES (
    pg_backend_pid(), txid_current(), NEW.owner_id, NEW.id
  );
  IF NEW.operation = 'delete' THEN
    UPDATE public.tasks_checklist_items AS item
    SET disposition = 'deleted',
        deleted_at = NEW.requested_at,
        deletion_root_id = NEW.root_id,
        revision = item.revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = NEW.mutation_channel,
        last_actor_type = NEW.actor_type
    WHERE item.owner_id = NEW.owner_id
      AND item.id = ANY(_affected_ids)
      AND item.disposition = 'present';
    UPDATE public.tasks_todos AS task
    SET disposition = 'deleted',
        deleted_at = NEW.requested_at,
        deletion_root_id = NEW.root_id,
        revision = task.revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = NEW.mutation_channel,
        last_actor_type = NEW.actor_type
    WHERE task.owner_id = NEW.owner_id
      AND task.id = ANY(_affected_ids)
      AND task.disposition = 'present';
    UPDATE public.tasks_areas AS area
    SET disposition = 'deleted',
        deleted_at = NEW.requested_at,
        deletion_root_id = NEW.root_id,
        revision = area.revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = NEW.mutation_channel,
        last_actor_type = NEW.actor_type
    WHERE area.owner_id = NEW.owner_id
      AND area.id = ANY(_affected_ids)
      AND area.disposition = 'present';
  ELSE
    UPDATE public.tasks_areas AS area
    SET disposition = 'present',
        deleted_at = NULL,
        deletion_root_id = NULL,
        revision = area.revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = NEW.mutation_channel,
        last_actor_type = NEW.actor_type
    WHERE area.owner_id = NEW.owner_id
      AND area.deletion_root_id = NEW.root_id;
    UPDATE public.tasks_todos AS task
    SET disposition = 'present',
        deleted_at = NULL,
        deletion_root_id = NULL,
        area_id = CASE
          WHEN task.area_id IS NULL OR EXISTS (
            SELECT 1
            FROM public.tasks_areas AS area
            WHERE area.owner_id = task.owner_id
              AND area.id = task.area_id
              AND area.disposition = 'present'
          ) THEN task.area_id
          ELSE NULL
        END,
        destination = CASE
          WHEN task.area_id IS NOT NULL AND NOT EXISTS (
            SELECT 1
            FROM public.tasks_areas AS area
            WHERE area.owner_id = task.owner_id
              AND area.id = task.area_id
              AND area.disposition = 'present'
          ) THEN 'anytime'
          ELSE task.destination
        END,
        start_date = CASE
          WHEN task.area_id IS NOT NULL AND NOT EXISTS (
            SELECT 1
            FROM public.tasks_areas AS area
            WHERE area.owner_id = task.owner_id
              AND area.id = task.area_id
              AND area.disposition = 'present'
          ) THEN NULL
          ELSE task.start_date
        END,
        revision = task.revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = NEW.mutation_channel,
        last_actor_type = NEW.actor_type
    WHERE task.owner_id = NEW.owner_id
      AND task.deletion_root_id = NEW.root_id;
    UPDATE public.tasks_checklist_items AS item
    SET disposition = 'present',
        deleted_at = NULL,
        deletion_root_id = NULL,
        revision = item.revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = NEW.mutation_channel,
        last_actor_type = NEW.actor_type
    WHERE item.owner_id = NEW.owner_id
      AND item.deletion_root_id = NEW.root_id
      AND EXISTS (
        SELECT 1
        FROM public.tasks_todos AS task
        WHERE task.owner_id = item.owner_id
          AND task.id = item.task_id
          AND task.disposition = 'present'
      );
  END IF;
  SELECT COALESCE(jsonb_object_agg(
    candidate.entity_id::text,
    candidate.revision
    ORDER BY candidate.entity_id
  ), '{}'::jsonb)
  INTO _result_revisions
  FROM (
    SELECT area.id AS entity_id, area.revision
    FROM public.tasks_areas AS area
    WHERE area.owner_id = NEW.owner_id
      AND area.id = ANY(_affected_ids)
    UNION ALL
    SELECT task.id, task.revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = NEW.owner_id
      AND task.id = ANY(_affected_ids)
    UNION ALL
    SELECT item.id, item.revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = NEW.owner_id
      AND item.id = ANY(_affected_ids)
  ) AS candidate;
  DELETE FROM tasks_private.hierarchy_operation_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current();
  UPDATE public.tasks_hierarchy_operations
  SET outcome = 'accepted',
      affected_ids = _affected_ids,
      result_revisions = _result_revisions,
      completed_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END
$$;

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
  _owner_id uuid := auth.uid();
  _existing public.tasks_hierarchy_operations%ROWTYPE;
  _receipt public.tasks_hierarchy_operations%ROWTYPE;
  _root_revision bigint;
  _existing_expected_revision bigint;
  _expected_revisions jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL
    OR _root_id IS NULL
    OR _expected_revision IS NULL
    OR _expected_revision < 1 THEN
    RAISE EXCEPTION 'A request ID, root ID, and positive expected revision are required';
  END IF;
  IF _root_type NOT IN ('area', 'todo', 'checklist_item') THEN
    RAISE EXCEPTION 'Unsupported task hierarchy root type';
  END IF;
  IF _operation NOT IN ('delete', 'restore') THEN
    RAISE EXCEPTION 'Unsupported task hierarchy operation';
  END IF;
  IF _descendant_policy <> 'cascade' THEN
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
    SELECT 1
    FROM public.tasks_history_events AS event
    WHERE event.owner_id = _owner_id
      AND event.client_mutation_id = _request_id
  ) OR EXISTS (
    SELECT 1
    FROM public.tasks_hierarchy_history_events AS event
    WHERE event.owner_id = _owner_id
      AND event.client_mutation_id = _request_id
  ) THEN
    RAISE EXCEPTION 'The mutation identifier is unavailable. Use a new UUID for a new request.';
  END IF;
  IF _root_type = 'area' THEN
    SELECT area.revision INTO _root_revision
    FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id
      AND area.id = _root_id
      AND (
        (_operation = 'delete' AND area.disposition = 'present')
        OR (
          _operation = 'restore'
          AND area.disposition = 'deleted'
          AND area.deletion_root_id = _root_id
        )
      );
  ELSIF _root_type = 'todo' THEN
    SELECT task.revision INTO _root_revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id
      AND task.id = _root_id
      AND (
        (_operation = 'delete' AND task.disposition = 'present')
        OR (
          _operation = 'restore'
          AND task.disposition = 'deleted'
          AND task.deletion_root_id = _root_id
        )
      );
  ELSE
    SELECT item.revision INTO _root_revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id
      AND item.id = _root_id
      AND (
        (_operation = 'delete' AND item.disposition = 'present')
        OR (
          _operation = 'restore'
          AND item.disposition = 'deleted'
          AND item.deletion_root_id = _root_id
        )
      );
  END IF;
  IF _root_revision IS NULL THEN
    RAISE EXCEPTION 'The task hierarchy root is unavailable.';
  END IF;
  SELECT COALESCE(jsonb_object_agg(
    candidate.entity_id::text,
    candidate.revision
    ORDER BY candidate.entity_id
  ), '{}'::jsonb)
  INTO _expected_revisions
  FROM tasks_private.hierarchy_operation_candidates(
    _owner_id, _root_type, _root_id, _operation, _descendant_policy
  ) AS candidate;
  _expected_revisions := _expected_revisions
    || jsonb_build_object(_root_id::text, _expected_revision);
  INSERT INTO public.tasks_hierarchy_operations (
    id, owner_id, root_type, root_id, operation, descendant_policy,
    expected_revisions, actor_type, mutation_channel, requested_at
  ) VALUES (
    _request_id, _owner_id, _root_type, _root_id,
    _operation, _descendant_policy, _expected_revisions,
    'automation', 'mcp', now()
  );
  SELECT operation.* INTO STRICT _receipt
  FROM public.tasks_hierarchy_operations AS operation
  WHERE operation.id = _request_id
    AND operation.owner_id = _owner_id;
  RETURN to_jsonb(_receipt) - 'owner_id';
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.capture_template_source(
  _owner_id uuid,
  _source_type text,
  _source_id uuid,
  _anchor_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _source_revision bigint;
  _snapshot jsonb;
BEGIN
  IF _source_type <> 'todo' THEN
    RAISE EXCEPTION 'Template capture input is invalid' USING ERRCODE = '22023';
  END IF;
  SELECT task.revision INTO _source_revision
  FROM public.tasks_todos AS task
  WHERE task.id = _source_id
    AND task.owner_id = _owner_id
    AND task.disposition = 'present';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The template source task is unavailable'
      USING ERRCODE = '22023';
  END IF;
  _snapshot := tasks_private.template_snapshot_from_todo(
    _owner_id, _source_id, _anchor_date
  );
  RETURN jsonb_build_object(
    'source_revision', _source_revision,
    'snapshot', _snapshot
  );
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_instantiate_template(
  _template_id uuid,
  _template_revision bigint,
  _anchor_date date,
  _request_id uuid,
  _entry_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user',
  _target_area_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _template public.tasks_templates;
  _revision_record public.tasks_template_revisions;
  _existing public.tasks_template_instantiations;
  _instantiation public.tasks_template_instantiations;
  _planning_timezone text;
  _planning_date date;
  _selected_revision bigint;
  _root jsonb;
  _child jsonb;
  _planning jsonb;
  _task_id uuid := gen_random_uuid();
  _checklist_map jsonb := '{}'::jsonb;
  _task_ids jsonb;
  _checklist_ids jsonb := '[]'::jsonb;
  _generated_id uuid;
  _result jsonb;
  _timestamp timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to instantiate templates'
      USING ERRCODE = '42501';
  END IF;
  IF _template_id IS NULL
    OR _anchor_date IS NULL
    OR _request_id IS NULL
    OR _entry_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    )
    OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
    RAISE EXCEPTION 'Template instantiation input is invalid'
      USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _request_id::text, 0)
  );
  SELECT instance.* INTO _existing
  FROM public.tasks_template_instantiations AS instance
  WHERE instance.owner_id = _owner_id
    AND instance.client_mutation_id = _request_id;
  IF FOUND THEN
    IF _existing.template_id IS DISTINCT FROM _template_id
      OR (
        _template_revision IS NOT NULL
        AND _existing.template_revision IS DISTINCT FROM _template_revision
      )
      OR _existing.anchor_date IS DISTINCT FROM _anchor_date
      OR _existing.entry_channel IS DISTINCT FROM _entry_channel
      OR _existing.actor_type IS DISTINCT FROM _actor_type
      OR _existing.target_area_id IS DISTINCT FROM _target_area_id THEN
      RAISE EXCEPTION 'The request identifier belongs to a different template instance'
        USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'instantiation', to_jsonb(_existing) - 'owner_id',
      'result', _existing.result
    );
  END IF;
  SELECT template.* INTO _template
  FROM public.tasks_templates AS template
  WHERE template.id = _template_id
    AND template.owner_id = _owner_id
  FOR SHARE;
  IF NOT FOUND
    OR _template.archived_at IS NOT NULL
    OR _template.kind <> 'todo' THEN
    RAISE EXCEPTION 'The template is unavailable' USING ERRCODE = '22023';
  END IF;
  _selected_revision := COALESCE(
    _template_revision,
    _template.current_revision
  );
  SELECT revision.* INTO _revision_record
  FROM public.tasks_template_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.template_id = _template_id
    AND revision.revision = _selected_revision;
  IF NOT FOUND OR _revision_record.source_type <> 'todo' THEN
    RAISE EXCEPTION 'The requested template revision is unavailable'
      USING ERRCODE = '22023';
  END IF;
  IF _target_area_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.tasks_areas AS area
    WHERE area.id = _target_area_id
      AND area.owner_id = _owner_id
      AND area.disposition = 'present'
  ) THEN
    RAISE EXCEPTION 'The target area is unavailable for this template'
      USING ERRCODE = '22023';
  END IF;
  SELECT setting.planning_timezone INTO _planning_timezone
  FROM public.tasks_user_settings AS setting
  WHERE setting.owner_id = _owner_id;
  IF _planning_timezone IS NULL THEN
    RAISE EXCEPTION 'Task planning settings must be initialized before instantiation'
      USING ERRCODE = '22023';
  END IF;
  _planning_date := (now() AT TIME ZONE _planning_timezone)::date;
  _root := _revision_record.snapshot -> 'root';
  _task_ids := jsonb_build_array(_task_id);
  FOR _child IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(_root -> 'checklist', '[]'::jsonb))
  LOOP
    _generated_id := gen_random_uuid();
    _checklist_map := _checklist_map || jsonb_build_object(
      _child ->> 'node_id',
      _generated_id
    );
    _checklist_ids := _checklist_ids || jsonb_build_array(_generated_id);
  END LOOP;
  _result := jsonb_build_object(
    'root_type', 'todo',
    'root_id', _task_id,
    'task_ids', _task_ids,
    'checklist_item_ids', _checklist_ids
  );
  INSERT INTO public.tasks_template_instantiations (
    owner_id, template_id, template_revision, anchor_date, entry_channel,
    actor_type, target_area_id, root_type, root_id, result,
    client_mutation_id, created_at
  ) VALUES (
    _owner_id, _template.id, _selected_revision, _anchor_date,
    _entry_channel, _actor_type, _target_area_id, 'todo', _task_id,
    _result, _request_id, _timestamp
  )
  RETURNING * INTO _instantiation;
  INSERT INTO tasks_private.template_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (
    pg_backend_pid(), txid_current(), _owner_id
  );
  _planning := tasks_private.resolve_template_planning(
    _root ->> 'destination',
    _root ->> 'today_section',
    (_root ->> 'start_offset_days')::integer,
    (_root ->> 'deadline_offset_days')::integer,
    _anchor_date,
    _planning_date,
    true
  );
  INSERT INTO public.tasks_todos (
    id, owner_id, area_id, title, notes, lifecycle, disposition,
    destination, today_section, actionability, order_key, start_date,
    deadline, entry_channel, last_mutation_channel, last_actor_type,
    source_kind, source_title, source_external_id, revision,
    client_mutation_id, created_at, updated_at, template_definition_id,
    template_revision, template_instantiation_id, template_node_id
  ) VALUES (
    _task_id, _owner_id, _target_area_id, _root ->> 'title',
    COALESCE(_root ->> 'notes', ''), 'open', 'present',
    _planning ->> 'destination', _planning ->> 'today_section',
    COALESCE(_root ->> 'actionability', 'actionable'),
    _root ->> 'order_key', (_planning ->> 'start_date')::date,
    (_planning ->> 'deadline')::date, _entry_channel, _entry_channel,
    _actor_type, 'template', _revision_record.name, _template.id::text,
    1, gen_random_uuid(), _timestamp, _timestamp, _template.id,
    _selected_revision, _instantiation.id, (_root ->> 'node_id')::uuid
  );
  FOR _child IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(_root -> 'checklist', '[]'::jsonb))
  LOOP
    INSERT INTO public.tasks_checklist_items (
      id, owner_id, task_id, title, completed, order_key, disposition,
      entry_channel, last_mutation_channel, last_actor_type, revision,
      client_mutation_id, created_at, updated_at, template_definition_id,
      template_revision, template_instantiation_id, template_node_id
    ) VALUES (
      (_checklist_map ->> (_child ->> 'node_id'))::uuid,
      _owner_id, _task_id, _child ->> 'title', false,
      _child ->> 'order_key', 'present', _entry_channel, _entry_channel,
      _actor_type, 1, gen_random_uuid(), _timestamp, _timestamp,
      _template.id, _selected_revision, _instantiation.id,
      (_child ->> 'node_id')::uuid
    );
  END LOOP;
  DELETE FROM tasks_private.template_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;
  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'instantiation', to_jsonb(_instantiation) - 'owner_id',
    'result', _result
  );
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.instantiate_recurrence_occurrence(
  _owner_id uuid,
  _definition public.tasks_recurrence_definitions,
  _revision public.tasks_recurrence_revisions,
  _scheduled_date date,
  _logical_key text,
  _predecessor_occurrence_id uuid,
  _entry_channel text,
  _actor_type text
)
RETURNS public.tasks_recurrence_occurrences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _existing public.tasks_recurrence_occurrences;
  _occurrence public.tasks_recurrence_occurrences;
  _instantiation_result jsonb;
  _instantiation_id uuid;
  _root_id uuid;
  _occurrence_id uuid := gen_random_uuid();
BEGIN
  SELECT occurrence.* INTO _existing
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.recurrence_id = _definition.id
    AND occurrence.logical_key = _logical_key;
  IF FOUND THEN
    RETURN _existing;
  END IF;
  _instantiation_result := public.tasks_instantiate_template(
    _revision.template_id,
    _revision.template_revision,
    _scheduled_date,
    _occurrence_id,
    _entry_channel,
    _actor_type,
    _revision.target_area_id
  );
  IF _instantiation_result #>> '{result,root_type}' <> 'todo' THEN
    RAISE EXCEPTION 'Recurrence templates must instantiate tasks'
      USING ERRCODE = '23514';
  END IF;
  _instantiation_id := (
    _instantiation_result #>> '{instantiation,id}'
  )::uuid;
  _root_id := (_instantiation_result #>> '{result,root_id}')::uuid;
  INSERT INTO public.tasks_recurrence_occurrences (
    id, owner_id, recurrence_id, recurrence_revision, logical_key,
    scheduled_date, predecessor_occurrence_id, template_instantiation_id,
    root_type, root_id, client_mutation_id, generated_at
  ) VALUES (
    _occurrence_id, _owner_id, _definition.id, _revision.revision,
    _logical_key, _scheduled_date, _predecessor_occurrence_id,
    _instantiation_id, 'todo', _root_id, _occurrence_id,
    clock_timestamp()
  )
  RETURNING * INTO _occurrence;
  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (
    pg_backend_pid(), txid_current(), _owner_id
  )
  ON CONFLICT DO NOTHING;
  UPDATE public.tasks_todos
  SET recurrence_definition_id = _definition.id,
      recurrence_revision = _revision.revision,
      recurrence_occurrence_id = _occurrence.id,
      recurrence_logical_key = _logical_key,
      revision = revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = _entry_channel,
      last_actor_type = _actor_type
  WHERE id = _root_id
    AND owner_id = _owner_id;
  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;
  RETURN _occurrence;
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.permanent_deletion_scope(
  _owner_id uuid,
  _root_type text,
  _root_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  _root_title text;
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
BEGIN
  IF _root_type <> 'todo' THEN
    RAISE EXCEPTION 'Permanent deletion supports deleted task roots only'
      USING ERRCODE = '22023';
  END IF;
  SELECT task.title INTO _root_title
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id
    AND task.id = _root_id
    AND task.disposition = 'deleted'
    AND task.deletion_root_id = task.id;
  IF _root_title IS NULL THEN
    RAISE EXCEPTION 'The deleted task root is unavailable'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id
      AND area.deletion_root_id = _root_id
  ) THEN
    RAISE EXCEPTION 'The deletion root contains an unsupported area record'
      USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg(task.id ORDER BY task.id), ARRAY[]::uuid[])
  INTO _todo_ids
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id
    AND task.deletion_root_id = _root_id;
  SELECT COALESCE(array_agg(item.id ORDER BY item.id), ARRAY[]::uuid[])
  INTO _checklist_ids
  FROM public.tasks_checklist_items AS item
  WHERE item.owner_id = _owner_id
    AND item.deletion_root_id = _root_id;
  _hierarchy_ids := _todo_ids || _checklist_ids;
  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _task_history_ids
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id
    AND event.task_id = ANY(_todo_ids);
  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _hierarchy_history_ids
  FROM public.tasks_hierarchy_history_events AS event
  WHERE event.owner_id = _owner_id
    AND event.entity_id = ANY(_hierarchy_ids);
  SELECT COALESCE(array_agg(source.task_id ORDER BY source.task_id), ARRAY[]::uuid[])
  INTO _mail_source_ids
  FROM public.tasks_mail_sources AS source
  WHERE source.owner_id = _owner_id
    AND source.task_id = ANY(_todo_ids);
  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _mail_event_ids
  FROM public.tasks_mail_source_events AS event
  WHERE event.owner_id = _owner_id
    AND event.task_id = ANY(_todo_ids);
  SELECT COALESCE(array_agg(reminder.id ORDER BY reminder.id), ARRAY[]::uuid[])
  INTO _reminder_ids
  FROM public.tasks_reminders AS reminder
  WHERE reminder.owner_id = _owner_id
    AND reminder.task_id = ANY(_todo_ids);
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
    AND instantiation.root_type = 'todo'
    AND instantiation.root_id = ANY(_todo_ids);
  SELECT COALESCE(array_agg(occurrence.id ORDER BY occurrence.id), ARRAY[]::uuid[])
  INTO _recurrence_occurrence_ids
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.root_type = 'todo'
    AND occurrence.root_id = ANY(_todo_ids);
  RETURN jsonb_build_object(
    'root', jsonb_build_object(
      'type', 'todo',
      'id', _root_id,
      'title', _root_title
    ),
    'hierarchy', jsonb_build_object(
      'todos', to_jsonb(_todo_ids),
      'checklist_items', to_jsonb(_checklist_ids)
    ),
    'hierarchy_revisions', jsonb_build_object(
      'todos', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', task.id, 'revision', task.revision)
          ORDER BY task.id
        )
        FROM public.tasks_todos AS task
        WHERE task.owner_id = _owner_id
          AND task.id = ANY(_todo_ids)
      ), '[]'::jsonb),
      'checklist_items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', item.id, 'revision', item.revision)
          ORDER BY item.id
        )
        FROM public.tasks_checklist_items AS item
        WHERE item.owner_id = _owner_id
          AND item.id = ANY(_checklist_ids)
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
  );
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.tasks_permanently_delete_after_confirmation(
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
  IF _root_type <> 'todo' OR _confirmation <> 'PERMANENTLY DELETE' THEN
    RAISE EXCEPTION 'Permanent deletion requires explicit task confirmation'
      USING ERRCODE = '22023';
  END IF;
  IF _scope_digest IS NULL OR _scope_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Permanent deletion requires a valid preview digest'
      USING ERRCODE = '22023';
  END IF;
  SELECT receipt.* INTO _existing
  FROM tasks_private.permanent_deletion_receipts AS receipt
  WHERE receipt.owner_id = _owner_id
    AND receipt.id = _request_id;
  IF FOUND THEN
    IF _existing.root_type <> _root_type
      OR _existing.root_id <> _root_id
      OR _existing.scope_digest <> _scope_digest THEN
      RAISE EXCEPTION 'Permanent-deletion request identifier was reused with changed input'
        USING ERRCODE = '22023';
    END IF;
    RETURN _existing.result;
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      _owner_id::text || ':' || _root_type || ':' || _root_id::text,
      0
    )
  );
  LOCK TABLE public.tasks_todos, public.tasks_checklist_items,
    public.tasks_history_events, public.tasks_hierarchy_history_events,
    public.tasks_hierarchy_operations, public.tasks_mail_sources,
    public.tasks_mail_source_events, public.tasks_reminders,
    public.tasks_reminder_occurrences, public.tasks_reminder_deliveries,
    public.tasks_template_instantiations, public.tasks_recurrence_occurrences
  IN SHARE ROW EXCLUSIVE MODE;
  _scope := tasks_private.permanent_deletion_scope(
    _owner_id, _root_type, _root_id
  );
  _current_digest := tasks_private.export_checksum(_scope);
  IF _current_digest <> _scope_digest THEN
    RAISE EXCEPTION 'Permanent-deletion preview is stale'
      USING ERRCODE = '40001';
  END IF;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _todo_ids
  FROM jsonb_array_elements_text(_scope #> '{hierarchy,todos}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _checklist_ids
  FROM jsonb_array_elements_text(
    _scope #> '{hierarchy,checklist_items}'
  ) AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _hierarchy_history_ids
  FROM jsonb_array_elements_text(
    _scope #> '{related,hierarchy_history_events}'
  ) AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _reminder_ids
  FROM jsonb_array_elements_text(_scope #> '{related,reminders}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _reminder_occurrence_ids
  FROM jsonb_array_elements_text(
    _scope #> '{related,reminder_occurrences}'
  ) AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _reminder_delivery_ids
  FROM jsonb_array_elements_text(
    _scope #> '{related,reminder_deliveries}'
  ) AS value;
  DELETE FROM public.tasks_reminder_deliveries
  WHERE owner_id = _owner_id
    AND id = ANY(_reminder_delivery_ids);
  DELETE FROM public.tasks_reminder_occurrences
  WHERE owner_id = _owner_id
    AND id = ANY(_reminder_occurrence_ids);
  DELETE FROM public.tasks_reminders
  WHERE owner_id = _owner_id
    AND id = ANY(_reminder_ids);
  DELETE FROM public.tasks_hierarchy_history_events
  WHERE owner_id = _owner_id
    AND id = ANY(_hierarchy_history_ids);
  DELETE FROM public.tasks_checklist_items
  WHERE owner_id = _owner_id
    AND id = ANY(_checklist_ids);
  DELETE FROM public.tasks_todos
  WHERE owner_id = _owner_id
    AND id = ANY(_todo_ids);
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
    _owner_id, _request_id, 'todo', _root_id,
    _scope_digest, _result, _completed_at
  );
  RETURN _result;
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.reject_purged_creation_retry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _entity_type text := CASE TG_TABLE_NAME
    WHEN 'tasks_areas' THEN 'area'
    WHEN 'tasks_todos' THEN 'todo'
    WHEN 'tasks_checklist_items' THEN 'checklist_item'
  END;
BEGIN
  IF _entity_type IS NULL THEN
    RAISE EXCEPTION 'Unsupported task hierarchy entity'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM tasks_private.purged_creation_receipts AS receipt
    WHERE receipt.owner_id = NEW.owner_id
      AND (
        receipt.client_mutation_id = NEW.client_mutation_id
        OR (
          receipt.entity_type = _entity_type
          AND receipt.entity_id = NEW.id
        )
      )
  ) THEN
    RAISE EXCEPTION 'The creation request refers to content that has expired from Done'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.purge_expired_done(
  _now timestamptz DEFAULT clock_timestamp(),
  _limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _candidate record;
  _area_ids uuid[];
  _todo_ids uuid[];
  _checklist_ids uuid[];
  _reminder_ids uuid[];
  _reminder_occurrence_ids uuid[];
  _reminder_delivery_ids uuid[];
  _entity_ids uuid[];
  _purged_roots integer := 0;
  _purged_records integer := 0;
BEGIN
  IF _limit < 1 OR _limit > 5000 THEN
    RAISE EXCEPTION 'Done purge limit must be between 1 and 5000'
      USING ERRCODE = '22023';
  END IF;
  FOR _candidate IN
    WITH owner_zones AS (
      SELECT
        users.id AS owner_id,
        COALESCE(settings.planning_timezone, 'UTC') AS planning_timezone
      FROM auth.users AS users
      LEFT JOIN public.tasks_user_settings AS settings
        ON settings.owner_id = users.id
    ),
    candidates AS (
      SELECT
        area.owner_id,
        'area'::text AS root_type,
        area.id AS root_id,
        area.deleted_at AS terminal_at
      FROM public.tasks_areas AS area
      WHERE area.disposition = 'deleted'
        AND area.deletion_root_id = area.id
      UNION ALL
      SELECT
        task.owner_id,
        'todo',
        task.id,
        COALESCE(task.deleted_at, task.completed_at, task.canceled_at)
      FROM public.tasks_todos AS task
      WHERE (
        task.disposition = 'deleted'
        AND task.deletion_root_id = task.id
      ) OR (
        task.disposition = 'present'
        AND task.lifecycle IN ('completed', 'canceled')
      )
      UNION ALL
      SELECT
        item.owner_id,
        'checklist_item',
        item.id,
        item.deleted_at
      FROM public.tasks_checklist_items AS item
      WHERE item.disposition = 'deleted'
        AND item.deletion_root_id = item.id
    )
    SELECT candidate.*, zone.planning_timezone
    FROM candidates AS candidate
    JOIN owner_zones AS zone
      ON zone.owner_id = candidate.owner_id
    WHERE candidate.terminal_at IS NOT NULL
      AND (
        candidate.terminal_at AT TIME ZONE zone.planning_timezone
      )::date + 31 <= (_now AT TIME ZONE zone.planning_timezone)::date
    ORDER BY candidate.terminal_at, candidate.root_type, candidate.root_id
    LIMIT _limit
  LOOP
    _area_ids := ARRAY[]::uuid[];
    _todo_ids := ARRAY[]::uuid[];
    _checklist_ids := ARRAY[]::uuid[];
    IF _candidate.root_type = 'area' THEN
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO _area_ids
      FROM public.tasks_areas
      WHERE owner_id = _candidate.owner_id
        AND deletion_root_id = _candidate.root_id;
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO _todo_ids
      FROM public.tasks_todos
      WHERE owner_id = _candidate.owner_id
        AND deletion_root_id = _candidate.root_id;
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO _checklist_ids
      FROM public.tasks_checklist_items
      WHERE owner_id = _candidate.owner_id
        AND deletion_root_id = _candidate.root_id;
    ELSIF _candidate.root_type = 'todo' THEN
      IF EXISTS (
        SELECT 1
        FROM public.tasks_todos
        WHERE owner_id = _candidate.owner_id
          AND id = _candidate.root_id
          AND disposition = 'deleted'
          AND deletion_root_id = id
      ) THEN
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
        INTO _todo_ids
        FROM public.tasks_todos
        WHERE owner_id = _candidate.owner_id
          AND deletion_root_id = _candidate.root_id;
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
        INTO _checklist_ids
        FROM public.tasks_checklist_items
        WHERE owner_id = _candidate.owner_id
          AND deletion_root_id = _candidate.root_id;
      ELSE
        _todo_ids := ARRAY[_candidate.root_id];
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
        INTO _checklist_ids
        FROM public.tasks_checklist_items
        WHERE owner_id = _candidate.owner_id
          AND task_id = _candidate.root_id;
      END IF;
    ELSE
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO _checklist_ids
      FROM public.tasks_checklist_items
      WHERE owner_id = _candidate.owner_id
        AND deletion_root_id = _candidate.root_id;
    END IF;
    IF cardinality(_area_ids)
      + cardinality(_todo_ids)
      + cardinality(_checklist_ids) = 0 THEN
      CONTINUE;
    END IF;
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO _reminder_ids
    FROM public.tasks_reminders
    WHERE owner_id = _candidate.owner_id
      AND task_id = ANY(_todo_ids);
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO _reminder_occurrence_ids
    FROM public.tasks_reminder_occurrences
    WHERE owner_id = _candidate.owner_id
      AND reminder_id = ANY(_reminder_ids);
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO _reminder_delivery_ids
    FROM public.tasks_reminder_deliveries
    WHERE owner_id = _candidate.owner_id
      AND occurrence_id = ANY(_reminder_occurrence_ids);
    DELETE FROM public.tasks_reminder_deliveries
    WHERE owner_id = _candidate.owner_id
      AND id = ANY(_reminder_delivery_ids);
    DELETE FROM public.tasks_reminder_occurrences
    WHERE owner_id = _candidate.owner_id
      AND id = ANY(_reminder_occurrence_ids);
    DELETE FROM public.tasks_reminders
    WHERE owner_id = _candidate.owner_id
      AND id = ANY(_reminder_ids);
    _entity_ids := _area_ids || _todo_ids || _checklist_ids;
    INSERT INTO tasks_private.purged_creation_receipts (
      owner_id, entity_type, entity_id, client_mutation_id, purged_at
    )
    SELECT
      receipt.owner_id,
      receipt.entity_type,
      receipt.entity_id,
      receipt.client_mutation_id,
      _now
    FROM (
      SELECT todo_receipt.*
      FROM (
        SELECT DISTINCT ON (event.task_id)
          event.owner_id,
          'todo'::text AS entity_type,
          event.task_id AS entity_id,
          event.client_mutation_id,
          event.occurred_at,
          event.id
        FROM public.tasks_history_events AS event
        WHERE event.owner_id = _candidate.owner_id
          AND event.task_id = ANY(_todo_ids)
          AND event.transition IN ('create', 'baseline')
        ORDER BY event.task_id, event.occurred_at, event.id
      ) AS todo_receipt
      UNION ALL
      SELECT hierarchy_receipt.*
      FROM (
        SELECT DISTINCT ON (event.entity_type, event.entity_id)
          event.owner_id,
          event.entity_type,
          event.entity_id,
          event.client_mutation_id,
          event.occurred_at,
          event.id
        FROM public.tasks_hierarchy_history_events AS event
        WHERE event.owner_id = _candidate.owner_id
          AND event.entity_id = ANY(_entity_ids)
          AND event.transition IN ('create', 'baseline')
        ORDER BY event.entity_type, event.entity_id, event.occurred_at, event.id
      ) AS hierarchy_receipt
    ) AS receipt
    ON CONFLICT DO NOTHING;
    DELETE FROM public.tasks_hierarchy_history_events
    WHERE owner_id = _candidate.owner_id
      AND entity_id = ANY(_entity_ids);
    DELETE FROM public.tasks_checklist_items
    WHERE owner_id = _candidate.owner_id
      AND id = ANY(_checklist_ids);
    DELETE FROM public.tasks_todos
    WHERE owner_id = _candidate.owner_id
      AND id = ANY(_todo_ids);
    DELETE FROM public.tasks_areas
    WHERE owner_id = _candidate.owner_id
      AND id = ANY(_area_ids);
    _purged_roots := _purged_roots + 1;
    _purged_records := _purged_records + cardinality(_entity_ids);
  END LOOP;
  RETURN jsonb_build_object(
    'purged_roots', _purged_roots,
    'purged_records', _purged_records,
    'evaluated_at', _now
  );
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_capture_template(
  _template_id uuid,
  _source_type text,
  _source_id uuid,
  _name text,
  _anchor_date date,
  _mutation_id uuid,
  _mutation_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _template public.tasks_templates;
  _revision public.tasks_template_revisions;
  _source_capture jsonb;
  _source_revision bigint;
  _next_revision bigint;
  _snapshot jsonb;
  _normalized_name text := btrim(_name);
  _timestamp timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save templates'
      USING ERRCODE = '42501';
  END IF;
  IF _source_type <> 'todo'
    OR _source_id IS NULL
    OR _mutation_id IS NULL
    OR _anchor_date IS NULL
    OR NULLIF(_normalized_name, '') IS NULL
    OR char_length(_normalized_name) > 500
    OR _mutation_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    )
    OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
    RAISE EXCEPTION 'Template capture input is invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _mutation_id::text, 0)
  );
  SELECT revision.* INTO _revision
  FROM public.tasks_template_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.client_mutation_id = _mutation_id;
  IF FOUND THEN
    IF _revision.source_type IS DISTINCT FROM 'todo'
      OR _revision.source_id IS DISTINCT FROM _source_id
      OR _revision.name IS DISTINCT FROM _normalized_name
      OR _revision.anchor_date IS DISTINCT FROM _anchor_date
      OR (
        _template_id IS NOT NULL
        AND _revision.template_id IS DISTINCT FROM _template_id
      ) THEN
      RAISE EXCEPTION 'The mutation identifier belongs to a different template capture'
        USING ERRCODE = '23505';
    END IF;
    SELECT template.* INTO _template
    FROM public.tasks_templates AS template
    WHERE template.id = _revision.template_id
      AND template.owner_id = _owner_id;
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'template', to_jsonb(_template) - 'owner_id',
      'revision', to_jsonb(_revision) - 'owner_id'
    );
  END IF;
  _source_capture := tasks_private.capture_template_source(
    _owner_id, 'todo', _source_id, _anchor_date
  );
  _source_revision := (_source_capture ->> 'source_revision')::bigint;
  _snapshot := _source_capture -> 'snapshot';
  IF _template_id IS NULL THEN
    INSERT INTO public.tasks_templates (
      owner_id, kind, name, current_revision, record_revision,
      last_mutation_channel, last_actor_type, client_mutation_id,
      created_at, updated_at
    ) VALUES (
      _owner_id, 'todo', _normalized_name, 1, 1,
      _mutation_channel, _actor_type, _mutation_id, _timestamp, _timestamp
    )
    RETURNING * INTO _template;
    _next_revision := 1;
  ELSE
    SELECT template.* INTO _template
    FROM public.tasks_templates AS template
    WHERE template.id = _template_id
      AND template.owner_id = _owner_id
    FOR UPDATE;
    IF NOT FOUND
      OR _template.archived_at IS NOT NULL
      OR _template.kind <> 'todo' THEN
      RAISE EXCEPTION 'The template is unavailable' USING ERRCODE = '22023';
    END IF;
    _next_revision := _template.current_revision + 1;
    UPDATE public.tasks_templates
    SET name = _normalized_name,
        current_revision = _next_revision,
        record_revision = record_revision + 1,
        last_mutation_channel = _mutation_channel,
        last_actor_type = _actor_type,
        client_mutation_id = _mutation_id
    WHERE id = _template.id
      AND owner_id = _owner_id
    RETURNING * INTO _template;
  END IF;
  INSERT INTO public.tasks_template_revisions (
    owner_id, template_id, revision, name, source_type, source_id,
    source_revision, anchor_date, snapshot, client_mutation_id, created_at
  ) VALUES (
    _owner_id, _template.id, _next_revision, _normalized_name,
    'todo', _source_id, _source_revision, _anchor_date,
    _snapshot, _mutation_id, _timestamp
  )
  RETURNING * INTO _revision;
  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'template', to_jsonb(_template) - 'owner_id',
    'revision', to_jsonb(_revision) - 'owner_id'
  );
END
$$;

DO $$
DECLARE
  _definition text;
  _rewritten text;
BEGIN
  SELECT pg_get_functiondef(
    'public.tasks_create_mail_capture(uuid,uuid,text,text,date,text,text,text,text,text,text,text,text,uuid)'::regprocedure
  ) INTO _definition;
  _rewritten := replace(
    replace(
      _definition,
      'id, owner_id, area_id, project_id, title, notes,',
      'id, owner_id, area_id, title, notes,'
    ),
    '_task_id, _owner_id, _area_id, NULL, btrim(_title),',
    '_task_id, _owner_id, _area_id, btrim(_title),'
  );
  IF _rewritten = _definition OR _rewritten ILIKE '%project_id%' THEN
    RAISE EXCEPTION 'Mail capture Project contraction did not match the installed function'
      USING ERRCODE = 'P0001';
  END IF;
  EXECUTE _rewritten;

  SELECT pg_get_functiondef(
    'public.tasks_save_recurrence(uuid,bigint,text,uuid,bigint,text,text,integer,date,text,text,integer,uuid,uuid,text,text)'::regprocedure
  ) INTO _definition;
  _rewritten := replace(
    _definition,
    '_template.kind <> ''project'' OR NOT EXISTS',
    '_template.kind <> ''todo'' OR NOT EXISTS'
  );
  IF _rewritten = _definition OR _rewritten ILIKE '%''project''%' THEN
    RAISE EXCEPTION 'Recurrence Project contraction did not match the installed function'
      USING ERRCODE = 'P0001';
  END IF;
  EXECUTE _rewritten;
END
$$;
