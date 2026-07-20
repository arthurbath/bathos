-- Persisted Today sections, carryover planning, and portable export schema version three

ALTER TABLE public.tasks_todos
  ADD COLUMN today_section text NOT NULL DEFAULT 'daytime',
  ADD CONSTRAINT tasks_todos_today_section_valid CHECK (
    today_section IN ('daytime', 'evening')
  ),
  ADD CONSTRAINT tasks_todos_evening_within_today CHECK (
    today_section = 'daytime' OR destination = 'today'
  );

UPDATE public.tasks_todos AS task
SET start_date = COALESCE(
  task.start_date,
  (
    now() AT TIME ZONE COALESCE(
      (
        SELECT setting.planning_timezone
        FROM public.tasks_user_settings AS setting
        WHERE setting.owner_id = task.owner_id
      ),
      'UTC'
    )
  )::date
)
WHERE task.destination = 'today'
  AND task.start_date IS NULL;

DROP INDEX IF EXISTS public.tasks_todos_owner_active_destination_order_idx;
CREATE INDEX tasks_todos_owner_active_destination_order_idx
ON public.tasks_todos (owner_id, destination, today_section, order_key, id)
WHERE disposition = 'present' AND lifecycle = 'open';

CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_snapshot_v3(_snapshot jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN _snapshot IS NULL OR _snapshot = 'null'::jsonb THEN NULL
    ELSE _snapshot || jsonb_build_object(
      'today_section', COALESCE(_snapshot ->> 'today_section', 'daytime')
    )
  END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_todo_snapshot_v3(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot_v3(_task public.tasks_todos)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
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
    'start_date', _task.start_date,
    'deadline', _task.deadline,
    'source_kind', _task.source_kind,
    'source_url', _task.source_url,
    'source_title', _task.source_title,
    'source_external_id', _task.source_external_id
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_snapshot_v3(public.tasks_todos)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.append_todo_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _base_revision bigint;
  _before_state jsonb;
  _transition text;
  _undo_source public.tasks_history_events;
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

  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Task history owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.undo_source_event_id IS NOT NULL THEN
      RAISE EXCEPTION 'A new task cannot be an undo mutation'
        USING ERRCODE = '23514';
    END IF;
    _base_revision := 0;
    _before_state := NULL;
    _transition := 'create';
  ELSE
    _base_revision := OLD.revision;
    _before_state := tasks_private.todo_snapshot_v3(OLD);

    IF NEW.undo_source_event_id IS NOT NULL THEN
      SELECT event.*
      INTO _undo_source
      FROM public.tasks_history_events AS event
      WHERE event.id = NEW.undo_source_event_id
        AND event.owner_id = NEW.owner_id
        AND event.task_id = NEW.id;

      IF NOT FOUND
        OR _undo_source.transition IN ('baseline', 'create')
        OR _undo_source.result_revision <> OLD.revision
        OR tasks_private.normalize_todo_snapshot_v3(_undo_source.before_state)
          IS DISTINCT FROM tasks_private.todo_snapshot_v3(NEW) THEN
        RAISE EXCEPTION 'The requested undo is no longer safe'
          USING ERRCODE = '23514';
      END IF;
      _transition := 'undo';
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
    ELSIF NEW.destination IS DISTINCT FROM OLD.destination
      OR NEW.today_section IS DISTINCT FROM OLD.today_section THEN
      _transition := 'move';
    ELSIF NEW.order_key IS DISTINCT FROM OLD.order_key THEN
      _transition := 'reorder';
    ELSE
      _transition := 'update';
    END IF;
  END IF;

  INSERT INTO public.tasks_history_events (
    owner_id,
    task_id,
    client_mutation_id,
    actor_type,
    mutation_channel,
    affected_ids,
    base_revision,
    result_revision,
    transition,
    occurred_at,
    outcome,
    code,
    before_state,
    after_state
  )
  VALUES (
    NEW.owner_id,
    NEW.id,
    NEW.client_mutation_id,
    NEW.last_actor_type,
    NEW.last_mutation_channel,
    ARRAY[NEW.id],
    _base_revision,
    NEW.revision,
    _transition,
    NEW.updated_at,
    'accepted',
    NULL,
    _before_state,
    tasks_private.todo_snapshot_v3(NEW)
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.append_todo_history()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v3()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _tasks jsonb;
  _history jsonb;
  _settings jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(task) - 'owner_id' ORDER BY task.id), '[]'::jsonb)
  INTO _tasks
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_set(
        jsonb_set(
          to_jsonb(event) - 'owner_id',
          '{before_state}',
          COALESCE(tasks_private.normalize_todo_snapshot_v3(event.before_state), 'null'::jsonb)
        ),
        '{after_state}',
        tasks_private.normalize_todo_snapshot_v3(event.after_state)
      )
      ORDER BY event.occurred_at, event.id
    ),
    '[]'::jsonb
  )
  INTO _history
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(setting) - 'owner_id' ORDER BY setting.id), '[]'::jsonb)
  INTO _settings
  FROM public.tasks_user_settings AS setting
  WHERE setting.owner_id = _owner_id;

  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 3,
    'created_at', clock_timestamp(),
    'manifest', jsonb_build_object(
      'collections', jsonb_build_array(
        'tasks_todos',
        'tasks_history_events',
        'tasks_user_settings'
      ),
      'counts', jsonb_build_object(
        'tasks_todos', jsonb_array_length(_tasks),
        'tasks_history_events', jsonb_array_length(_history),
        'tasks_user_settings', jsonb_array_length(_settings)
      ),
      'checksums', jsonb_build_object(
        'algorithm', 'sha256',
        'tasks_todos', tasks_private.export_checksum(_tasks),
        'tasks_history_events', tasks_private.export_checksum(_history),
        'tasks_user_settings', tasks_private.export_checksum(_settings)
      )
    ),
    'data', jsonb_build_object(
      'tasks_todos', _tasks,
      'tasks_history_events', _history,
      'tasks_user_settings', _settings
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v3()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v3() TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v3(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _tasks jsonb;
  _history jsonb;
  _settings jsonb;
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export' THEN
    RAISE EXCEPTION 'Invalid task export format' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(_envelope ->> 'schema_version', '') !~ '^[0-9]+$'
    OR (_envelope ->> 'schema_version')::integer <> 3 THEN
    RAISE EXCEPTION 'Unsupported task export schema version' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(_envelope -> 'manifest') IS DISTINCT FROM 'object'
    OR jsonb_typeof(_envelope -> 'data') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid task export envelope' USING ERRCODE = '22023';
  END IF;

  _tasks := _envelope #> '{data,tasks_todos}';
  _history := _envelope #> '{data,tasks_history_events}';
  _settings := _envelope #> '{data,tasks_user_settings}';
  IF jsonb_typeof(_tasks) IS DISTINCT FROM 'array'
    OR jsonb_typeof(_history) IS DISTINCT FROM 'array'
    OR jsonb_typeof(_settings) IS DISTINCT FROM 'array'
    OR jsonb_array_length(_settings) > 1 THEN
    RAISE EXCEPTION 'Invalid task export collections' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(_envelope #>> '{manifest,counts,tasks_todos}', '') !~ '^[0-9]+$'
    OR COALESCE(_envelope #>> '{manifest,counts,tasks_history_events}', '') !~ '^[0-9]+$'
    OR COALESCE(_envelope #>> '{manifest,counts,tasks_user_settings}', '') !~ '^[0-9]+$'
    OR (_envelope #>> '{manifest,counts,tasks_todos}')::integer <> jsonb_array_length(_tasks)
    OR (_envelope #>> '{manifest,counts,tasks_history_events}')::integer
      <> jsonb_array_length(_history)
    OR (_envelope #>> '{manifest,counts,tasks_user_settings}')::integer
      <> jsonb_array_length(_settings) THEN
    RAISE EXCEPTION 'Task export record counts do not match the manifest'
      USING ERRCODE = '22023';
  END IF;

  IF _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256'
    OR _envelope #>> '{manifest,checksums,tasks_todos}'
      IS DISTINCT FROM tasks_private.export_checksum(_tasks)
    OR _envelope #>> '{manifest,checksums,tasks_history_events}'
      IS DISTINCT FROM tasks_private.export_checksum(_history)
    OR _envelope #>> '{manifest,checksums,tasks_user_settings}'
      IS DISTINCT FROM tasks_private.export_checksum(_settings) THEN
    RAISE EXCEPTION 'Task export checksum validation failed' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v3(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.normalize_history_event_v3(_event jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_set(
    jsonb_set(
      _event,
      '{before_state}',
      COALESCE(
        tasks_private.normalize_todo_snapshot_v3(_event -> 'before_state'),
        'null'::jsonb
      )
    ),
    '{after_state}',
    tasks_private.normalize_todo_snapshot_v3(_event -> 'after_state')
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_history_event_v3(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v3(
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
  _task_json jsonb;
  _history_json jsonb;
  _setting_json jsonb;
  _task public.tasks_todos;
  _event public.tasks_history_events;
  _setting public.tasks_user_settings;
  _existing_task public.tasks_todos;
  _existing_event public.tasks_history_events;
  _existing_setting public.tasks_user_settings;
  _task_insert_ids jsonb := '[]'::jsonb;
  _task_match_ids jsonb := '[]'::jsonb;
  _task_conflict_ids jsonb := '[]'::jsonb;
  _history_insert_ids jsonb := '[]'::jsonb;
  _history_match_ids jsonb := '[]'::jsonb;
  _history_conflict_ids jsonb := '[]'::jsonb;
  _setting_insert_ids jsonb := '[]'::jsonb;
  _setting_match_ids jsonb := '[]'::jsonb;
  _setting_conflict_ids jsonb := '[]'::jsonb;
  _conflicting_task_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;

  PERFORM tasks_private.validate_export_v3(_envelope);

  FOR _task_json IN
    SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}')
  LOOP
    IF jsonb_typeof(_task_json) IS DISTINCT FROM 'object'
      OR NOT (_task_json ?& ARRAY[
        'id', 'title', 'notes', 'lifecycle', 'completed_at', 'canceled_at',
        'disposition', 'deleted_at', 'destination', 'today_section', 'order_key',
        'start_date', 'deadline', 'entry_channel', 'last_mutation_channel',
        'last_actor_type', 'undo_source_event_id', 'source_kind', 'source_url',
        'source_title', 'source_external_id', 'revision', 'client_mutation_id',
        'created_at', 'updated_at'
      ]) THEN
      RAISE EXCEPTION 'Task export contains an incomplete task record'
        USING ERRCODE = '22023';
    END IF;

    _task := jsonb_populate_record(
      NULL::public.tasks_todos,
      (_task_json - 'owner_id') || jsonb_build_object('owner_id', _owner_id)
    );
    IF _task.today_section NOT IN ('daytime', 'evening')
      OR (_task.today_section = 'evening' AND _task.destination <> 'today')
      OR (
        _task.start_date IS NOT NULL
        AND _task.deadline IS NOT NULL
        AND _task.deadline < _task.start_date
      ) THEN
      RAISE EXCEPTION 'Task export contains invalid planning placement for task %', _task.id
        USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_envelope #> '{data,tasks_history_events}') AS item(value)
      WHERE item.value ->> 'task_id' = _task.id::text
        AND item.value ->> 'client_mutation_id' = _task.client_mutation_id::text
        AND item.value ->> 'result_revision' = _task.revision::text
        AND tasks_private.normalize_todo_snapshot_v3(item.value -> 'after_state')
          IS NOT DISTINCT FROM tasks_private.todo_snapshot_v3(_task)
    ) THEN
      RAISE EXCEPTION 'Task export is missing the final history state for task %', _task.id
        USING ERRCODE = '22023';
    END IF;

    IF _task.undo_source_event_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_envelope #> '{data,tasks_history_events}') AS item(value)
      WHERE item.value ->> 'id' = _task.undo_source_event_id::text
        AND item.value ->> 'task_id' = _task.id::text
    ) THEN
      RAISE EXCEPTION 'Task export contains an invalid undo source for task %', _task.id
        USING ERRCODE = '22023';
    END IF;

    _existing_task := NULL;
    SELECT task.*
    INTO _existing_task
    FROM public.tasks_todos AS task
    WHERE task.id = _task.id
       OR task.client_mutation_id = _task.client_mutation_id
    ORDER BY (task.id = _task.id) DESC
    LIMIT 1;

    IF NOT FOUND THEN
      _task_insert_ids := _task_insert_ids || jsonb_build_array(_task.id);
    ELSIF _existing_task.id = _task.id
      AND _existing_task.owner_id = _owner_id
      AND to_jsonb(_existing_task) - 'owner_id' = _task_json - 'owner_id' THEN
      _task_match_ids := _task_match_ids || jsonb_build_array(_task.id);
    ELSE
      _task_conflict_ids := _task_conflict_ids || jsonb_build_array(_task.id);
      _conflicting_task_ids := array_append(_conflicting_task_ids, _task.id);
    END IF;
  END LOOP;

  FOR _history_json IN
    SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_history_events}')
  LOOP
    IF jsonb_typeof(_history_json) IS DISTINCT FROM 'object'
      OR NOT (_history_json ?& ARRAY[
        'id', 'task_id', 'client_mutation_id', 'actor_type', 'mutation_channel',
        'affected_ids', 'base_revision', 'result_revision', 'transition',
        'occurred_at', 'outcome', 'code', 'before_state', 'after_state'
      ]) THEN
      RAISE EXCEPTION 'Task export contains an incomplete history record'
        USING ERRCODE = '22023';
    END IF;

    _history_json := tasks_private.normalize_history_event_v3(_history_json);
    _event := jsonb_populate_record(
      NULL::public.tasks_history_events,
      (_history_json - 'owner_id') || jsonb_build_object('owner_id', _owner_id)
    );

    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS item(value)
      WHERE item.value ->> 'id' = _event.task_id::text
    ) THEN
      RAISE EXCEPTION 'Task export history references an absent task %', _event.task_id
        USING ERRCODE = '22023';
    END IF;

    IF _event.task_id = ANY(_conflicting_task_ids) THEN
      _history_conflict_ids := _history_conflict_ids || jsonb_build_array(_event.id);
      CONTINUE;
    END IF;

    _existing_event := NULL;
    SELECT event.*
    INTO _existing_event
    FROM public.tasks_history_events AS event
    WHERE event.id = _event.id
       OR (event.owner_id = _owner_id AND event.client_mutation_id = _event.client_mutation_id)
    ORDER BY (event.id = _event.id) DESC
    LIMIT 1;

    IF NOT FOUND THEN
      _history_insert_ids := _history_insert_ids || jsonb_build_array(_event.id);
    ELSIF _existing_event.id = _event.id
      AND _existing_event.owner_id = _owner_id
      AND tasks_private.normalize_history_event_v3(to_jsonb(_existing_event) - 'owner_id')
        = _history_json - 'owner_id' THEN
      _history_match_ids := _history_match_ids || jsonb_build_array(_event.id);
    ELSE
      _history_conflict_ids := _history_conflict_ids || jsonb_build_array(_event.id);
    END IF;
  END LOOP;

  FOR _setting_json IN
    SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_user_settings}')
  LOOP
    IF jsonb_typeof(_setting_json) IS DISTINCT FROM 'object'
      OR NOT (_setting_json ?& ARRAY[
        'id', 'planning_timezone', 'revision', 'client_mutation_id', 'created_at', 'updated_at'
      ]) THEN
      RAISE EXCEPTION 'Task export contains an incomplete planning setting'
        USING ERRCODE = '22023';
    END IF;

    _setting := jsonb_populate_record(
      NULL::public.tasks_user_settings,
      (_setting_json - 'owner_id') || jsonb_build_object('owner_id', _owner_id)
    );
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = _setting.planning_timezone
    ) THEN
      RAISE EXCEPTION 'Task export contains an invalid planning time zone'
        USING ERRCODE = '22023';
    END IF;

    _existing_setting := NULL;
    SELECT setting.*
    INTO _existing_setting
    FROM public.tasks_user_settings AS setting
    WHERE setting.id = _setting.id
      OR setting.owner_id = _owner_id
      OR setting.client_mutation_id = _setting.client_mutation_id
    ORDER BY (setting.id = _setting.id) DESC
    LIMIT 1;

    IF NOT FOUND THEN
      _setting_insert_ids := _setting_insert_ids || jsonb_build_array(_setting.id);
    ELSIF _existing_setting.id = _setting.id
      AND _existing_setting.owner_id = _owner_id
      AND to_jsonb(_existing_setting) - 'owner_id' = _setting_json - 'owner_id' THEN
      _setting_match_ids := _setting_match_ids || jsonb_build_array(_setting.id);
    ELSE
      _setting_conflict_ids := _setting_conflict_ids || jsonb_build_array(_setting.id);
    END IF;
  END LOOP;

  IF NOT _dry_run THEN
    INSERT INTO tasks_private.restore_contexts (backend_pid, transaction_id, owner_id)
    VALUES (pg_backend_pid(), txid_current(), _owner_id);

    FOR _task_json IN
      SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}')
    LOOP
      IF _task_insert_ids @> jsonb_build_array(_task_json -> 'id') THEN
        _task := jsonb_populate_record(
          NULL::public.tasks_todos,
          (_task_json - 'owner_id') || jsonb_build_object('owner_id', _owner_id)
        );
        INSERT INTO public.tasks_todos SELECT (_task).*;
      END IF;
    END LOOP;

    FOR _history_json IN
      SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_history_events}')
    LOOP
      IF _history_insert_ids @> jsonb_build_array(_history_json -> 'id') THEN
        _history_json := tasks_private.normalize_history_event_v3(_history_json);
        _event := jsonb_populate_record(
          NULL::public.tasks_history_events,
          (_history_json - 'owner_id') || jsonb_build_object('owner_id', _owner_id)
        );
        INSERT INTO public.tasks_history_events SELECT (_event).*;
      END IF;
    END LOOP;

    FOR _setting_json IN
      SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_user_settings}')
    LOOP
      IF _setting_insert_ids @> jsonb_build_array(_setting_json -> 'id') THEN
        _setting := jsonb_populate_record(
          NULL::public.tasks_user_settings,
          (_setting_json - 'owner_id') || jsonb_build_object('owner_id', _owner_id)
        );
        INSERT INTO public.tasks_user_settings SELECT (_setting).*;
      END IF;
    END LOOP;

    DELETE FROM tasks_private.restore_contexts
    WHERE backend_pid = pg_backend_pid() AND transaction_id = txid_current();
  END IF;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'schema_version', 3,
    'tasks_todos', jsonb_build_object(
      'inserts', jsonb_array_length(_task_insert_ids),
      'matches', jsonb_array_length(_task_match_ids),
      'conflicts', jsonb_array_length(_task_conflict_ids),
      'insert_ids', _task_insert_ids,
      'match_ids', _task_match_ids,
      'conflict_ids', _task_conflict_ids
    ),
    'tasks_history_events', jsonb_build_object(
      'inserts', jsonb_array_length(_history_insert_ids),
      'matches', jsonb_array_length(_history_match_ids),
      'conflicts', jsonb_array_length(_history_conflict_ids),
      'insert_ids', _history_insert_ids,
      'match_ids', _history_match_ids,
      'conflict_ids', _history_conflict_ids
    ),
    'tasks_user_settings', jsonb_build_object(
      'inserts', jsonb_array_length(_setting_insert_ids),
      'matches', jsonb_array_length(_setting_match_ids),
      'conflicts', jsonb_array_length(_setting_conflict_ids),
      'insert_ids', _setting_insert_ids,
      'match_ids', _setting_match_ids,
      'conflict_ids', _setting_conflict_ids
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v3(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v3(jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.upgrade_export_to_v3(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _version integer;
  _tasks jsonb;
  _history jsonb;
  _settings jsonb;
BEGIN
  _version := (_envelope ->> 'schema_version')::integer;
  IF _version = 1 THEN
    PERFORM tasks_private.validate_export_v1(_envelope);
    _settings := '[]'::jsonb;
  ELSIF _version = 2 THEN
    PERFORM tasks_private.validate_export_v2(_envelope);
    _settings := _envelope #> '{data,tasks_user_settings}';
  ELSE
    RAISE EXCEPTION 'Unsupported task export schema version' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      item.value || jsonb_build_object(
        'today_section', COALESCE(item.value ->> 'today_section', 'daytime')
      )
      ORDER BY item.ordinality
    ),
    '[]'::jsonb
  )
  INTO _tasks
  FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}')
    WITH ORDINALITY AS item(value, ordinality);

  SELECT COALESCE(
    jsonb_agg(
      tasks_private.normalize_history_event_v3(item.value)
      ORDER BY item.ordinality
    ),
    '[]'::jsonb
  )
  INTO _history
  FROM jsonb_array_elements(_envelope #> '{data,tasks_history_events}')
    WITH ORDINALITY AS item(value, ordinality);

  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 3,
    'created_at', _envelope -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', jsonb_build_array(
        'tasks_todos',
        'tasks_history_events',
        'tasks_user_settings'
      ),
      'counts', jsonb_build_object(
        'tasks_todos', jsonb_array_length(_tasks),
        'tasks_history_events', jsonb_array_length(_history),
        'tasks_user_settings', jsonb_array_length(_settings)
      ),
      'checksums', jsonb_build_object(
        'algorithm', 'sha256',
        'tasks_todos', tasks_private.export_checksum(_tasks),
        'tasks_history_events', tasks_private.export_checksum(_history),
        'tasks_user_settings', tasks_private.export_checksum(_settings)
      )
    ),
    'data', jsonb_build_object(
      'tasks_todos', _tasks,
      'tasks_history_events', _history,
      'tasks_user_settings', _settings
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.upgrade_export_to_v3(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v1(
  _envelope jsonb,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _result jsonb;
BEGIN
  PERFORM tasks_private.validate_export_v1(_envelope);
  _result := public.tasks_restore_export_v3(
    tasks_private.upgrade_export_to_v3(_envelope),
    _dry_run
  );
  RETURN (_result - 'tasks_user_settings') || jsonb_build_object('schema_version', 1);
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v1(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v1(jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v2(
  _envelope jsonb,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _result jsonb;
BEGIN
  PERFORM tasks_private.validate_export_v2(_envelope);
  _result := public.tasks_restore_export_v3(
    tasks_private.upgrade_export_to_v3(_envelope),
    _dry_run
  );
  RETURN _result || jsonb_build_object('schema_version', 2);
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v2(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v2(jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.downgrade_export_from_v3(
  _envelope jsonb,
  _target_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _tasks jsonb;
  _history jsonb;
  _settings jsonb;
  _collections jsonb;
  _counts jsonb;
  _checksums jsonb;
  _data jsonb;
BEGIN
  IF _target_version NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Unsupported legacy task export schema version' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(item.value - 'today_section' ORDER BY item.ordinality), '[]'::jsonb)
  INTO _tasks
  FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}')
    WITH ORDINALITY AS item(value, ordinality);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_set(
        jsonb_set(
          item.value,
          '{before_state}',
          CASE
            WHEN item.value -> 'before_state' = 'null'::jsonb THEN 'null'::jsonb
            ELSE (item.value -> 'before_state') - 'today_section'
          END
        ),
        '{after_state}',
        (item.value -> 'after_state') - 'today_section'
      )
      ORDER BY item.ordinality
    ),
    '[]'::jsonb
  )
  INTO _history
  FROM jsonb_array_elements(_envelope #> '{data,tasks_history_events}')
    WITH ORDINALITY AS item(value, ordinality);

  _settings := _envelope #> '{data,tasks_user_settings}';
  _collections := CASE _target_version
    WHEN 1 THEN jsonb_build_array('tasks_todos', 'tasks_history_events')
    ELSE jsonb_build_array('tasks_todos', 'tasks_history_events', 'tasks_user_settings')
  END;
  _counts := jsonb_build_object(
    'tasks_todos', jsonb_array_length(_tasks),
    'tasks_history_events', jsonb_array_length(_history)
  );
  _checksums := jsonb_build_object(
    'algorithm', 'sha256',
    'tasks_todos', tasks_private.export_checksum(_tasks),
    'tasks_history_events', tasks_private.export_checksum(_history)
  );
  _data := jsonb_build_object(
    'tasks_todos', _tasks,
    'tasks_history_events', _history
  );
  IF _target_version = 2 THEN
    _counts := _counts || jsonb_build_object(
      'tasks_user_settings', jsonb_array_length(_settings)
    );
    _checksums := _checksums || jsonb_build_object(
      'tasks_user_settings', tasks_private.export_checksum(_settings)
    );
    _data := _data || jsonb_build_object('tasks_user_settings', _settings);
  END IF;

  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', _target_version,
    'created_at', _envelope -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', _collections,
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.downgrade_export_from_v3(jsonb, integer)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v1()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tasks_private.downgrade_export_from_v3(public.tasks_create_export_v3(), 1);
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v1() TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v2()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tasks_private.downgrade_export_from_v3(public.tasks_create_export_v3(), 2);
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v2() TO authenticated;
