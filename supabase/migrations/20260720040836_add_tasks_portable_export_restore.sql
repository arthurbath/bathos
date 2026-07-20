-- Versioned, owner-rebound export and merge restore for the current Tasks foundation

CREATE OR REPLACE FUNCTION tasks_private.export_checksum(_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT encode(extensions.digest(convert_to(_value::text, 'UTF8'), 'sha256'), 'hex');
$$;

REVOKE ALL ON FUNCTION tasks_private.export_checksum(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE TABLE tasks_private.restore_contexts (
  backend_pid integer NOT NULL,
  transaction_id bigint NOT NULL,
  owner_id uuid NOT NULL,
  PRIMARY KEY (backend_pid, transaction_id)
);

REVOKE ALL ON TABLE tasks_private.restore_contexts
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
    _before_state := tasks_private.todo_snapshot(OLD);

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
        OR _undo_source.before_state IS DISTINCT FROM tasks_private.todo_snapshot(NEW) THEN
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
    ELSIF NEW.destination IS DISTINCT FROM OLD.destination THEN
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
    tasks_private.todo_snapshot(NEW)
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.append_todo_history()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _tasks jsonb;
  _history jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(task) - 'owner_id' ORDER BY task.id),
    '[]'::jsonb
  )
  INTO _tasks
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(event) - 'owner_id' ORDER BY event.occurred_at, event.id),
    '[]'::jsonb
  )
  INTO _history
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id;

  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 1,
    'created_at', clock_timestamp(),
    'manifest', jsonb_build_object(
      'collections', jsonb_build_array('tasks_todos', 'tasks_history_events'),
      'counts', jsonb_build_object(
        'tasks_todos', jsonb_array_length(_tasks),
        'tasks_history_events', jsonb_array_length(_history)
      ),
      'checksums', jsonb_build_object(
        'algorithm', 'sha256',
        'tasks_todos', tasks_private.export_checksum(_tasks),
        'tasks_history_events', tasks_private.export_checksum(_history)
      )
    ),
    'data', jsonb_build_object(
      'tasks_todos', _tasks,
      'tasks_history_events', _history
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v1()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v1() TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v1(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _tasks jsonb;
  _history jsonb;
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export' THEN
    RAISE EXCEPTION 'Invalid task export format'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(_envelope ->> 'schema_version', '') !~ '^[0-9]+$'
    OR (_envelope ->> 'schema_version')::integer <> 1 THEN
    RAISE EXCEPTION 'Unsupported task export schema version'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(_envelope -> 'manifest') IS DISTINCT FROM 'object'
    OR jsonb_typeof(_envelope -> 'data') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid task export envelope'
      USING ERRCODE = '22023';
  END IF;

  _tasks := _envelope #> '{data,tasks_todos}';
  _history := _envelope #> '{data,tasks_history_events}';
  IF jsonb_typeof(_tasks) IS DISTINCT FROM 'array'
    OR jsonb_typeof(_history) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid task export collections'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(_envelope #>> '{manifest,counts,tasks_todos}', '') !~ '^[0-9]+$'
    OR COALESCE(_envelope #>> '{manifest,counts,tasks_history_events}', '') !~ '^[0-9]+$'
    OR (_envelope #>> '{manifest,counts,tasks_todos}')::integer <> jsonb_array_length(_tasks)
    OR (_envelope #>> '{manifest,counts,tasks_history_events}')::integer
      <> jsonb_array_length(_history) THEN
    RAISE EXCEPTION 'Task export record counts do not match the manifest'
      USING ERRCODE = '22023';
  END IF;

  IF _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256'
    OR _envelope #>> '{manifest,checksums,tasks_todos}'
      IS DISTINCT FROM tasks_private.export_checksum(_tasks)
    OR _envelope #>> '{manifest,checksums,tasks_history_events}'
      IS DISTINCT FROM tasks_private.export_checksum(_history) THEN
    RAISE EXCEPTION 'Task export checksum validation failed'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v1(jsonb)
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
  _owner_id uuid := auth.uid();
  _task_json jsonb;
  _history_json jsonb;
  _task public.tasks_todos;
  _event public.tasks_history_events;
  _existing_task public.tasks_todos;
  _existing_event public.tasks_history_events;
  _task_insert_ids jsonb := '[]'::jsonb;
  _task_match_ids jsonb := '[]'::jsonb;
  _task_conflict_ids jsonb := '[]'::jsonb;
  _history_insert_ids jsonb := '[]'::jsonb;
  _history_match_ids jsonb := '[]'::jsonb;
  _history_conflict_ids jsonb := '[]'::jsonb;
  _conflicting_task_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;

  PERFORM tasks_private.validate_export_v1(_envelope);

  FOR _task_json IN
    SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}')
  LOOP
    IF jsonb_typeof(_task_json) IS DISTINCT FROM 'object'
      OR NOT (_task_json ?& ARRAY[
        'id', 'title', 'notes', 'lifecycle', 'completed_at', 'canceled_at',
        'disposition', 'deleted_at', 'destination', 'order_key', 'entry_channel',
        'last_mutation_channel', 'last_actor_type', 'undo_source_event_id',
        'source_kind', 'source_url', 'source_title', 'source_external_id',
        'revision', 'client_mutation_id', 'created_at', 'updated_at'
      ]) THEN
      RAISE EXCEPTION 'Task export contains an incomplete task record'
        USING ERRCODE = '22023';
    END IF;

    _task := jsonb_populate_record(
      NULL::public.tasks_todos,
      (_task_json - 'owner_id') || jsonb_build_object('owner_id', _owner_id)
    );

    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_envelope #> '{data,tasks_history_events}') AS item(value)
      WHERE item.value ->> 'task_id' = _task.id::text
        AND item.value ->> 'client_mutation_id' = _task.client_mutation_id::text
        AND item.value ->> 'result_revision' = _task.revision::text
        AND item.value -> 'after_state' IS NOT DISTINCT FROM tasks_private.todo_snapshot(_task)
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
      AND to_jsonb(_existing_event) - 'owner_id' = _history_json - 'owner_id' THEN
      _history_match_ids := _history_match_ids || jsonb_build_array(_event.id);
    ELSE
      _history_conflict_ids := _history_conflict_ids || jsonb_build_array(_event.id);
    END IF;
  END LOOP;

  IF NOT _dry_run THEN
    INSERT INTO tasks_private.restore_contexts (backend_pid, transaction_id, owner_id)
    VALUES (pg_backend_pid(), txid_current(), _owner_id);

    FOR _task_json IN
      SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}')
    LOOP
      IF (_task_insert_ids @> jsonb_build_array(_task_json -> 'id')) THEN
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
      IF (_history_insert_ids @> jsonb_build_array(_history_json -> 'id')) THEN
        _event := jsonb_populate_record(
          NULL::public.tasks_history_events,
          (_history_json - 'owner_id') || jsonb_build_object('owner_id', _owner_id)
        );
        INSERT INTO public.tasks_history_events SELECT (_event).*;
      END IF;
    END LOOP;

    DELETE FROM tasks_private.restore_contexts
    WHERE backend_pid = pg_backend_pid()
      AND transaction_id = txid_current();
  END IF;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'schema_version', 1,
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
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v1(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v1(jsonb, boolean) TO authenticated;
