-- Structured task actionability with history, undo, and portable export v7.

ALTER TABLE public.tasks_todos
ADD COLUMN actionability text NOT NULL DEFAULT 'actionable';

ALTER TABLE public.tasks_todos
ADD CONSTRAINT tasks_todos_actionability_valid CHECK (
  actionability IN ('actionable', 'waiting')
);

CREATE INDEX tasks_todos_owner_actionability_idx
ON public.tasks_todos (owner_id, actionability, destination, order_key, id)
WHERE disposition = 'present' AND lifecycle = 'open';

CREATE OR REPLACE FUNCTION public.tasks_prepare_todo_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Task identifier is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Task owner is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Task creation time is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.entry_channel IS DISTINCT FROM OLD.entry_channel THEN
    RAISE EXCEPTION 'Task entry channel is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.actionability IS DISTINCT FROM OLD.actionability
    AND (
      OLD.lifecycle <> 'open'
      OR OLD.disposition <> 'present'
      OR NEW.lifecycle <> 'open'
      OR NEW.disposition <> 'present'
    ) THEN
    RAISE EXCEPTION 'Actionability can be changed only on open, present tasks'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Task revision must increment by exactly one'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.client_mutation_id = OLD.client_mutation_id THEN
    RAISE EXCEPTION 'Task updates require a new client mutation identifier'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.undo_source_event_id IS NOT DISTINCT FROM OLD.undo_source_event_id THEN
    NEW.undo_source_event_id := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Schema versions three through six predate actionability in history
-- snapshots. Keep their snapshot comparators stable while current v7
-- normalization adds the field explicitly below.
CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_snapshot_v3(_snapshot jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN _snapshot IS NULL OR _snapshot = 'null'::jsonb THEN NULL
    ELSE (_snapshot - 'deletion_root_id' - 'actionability') || jsonb_build_object(
      'today_section', COALESCE(_snapshot ->> 'today_section', 'daytime'),
      'area_id', _snapshot -> 'area_id',
      'project_id', _snapshot -> 'project_id',
      'heading_id', _snapshot -> 'heading_id',
      'hierarchy_order_key', _snapshot -> 'hierarchy_order_key'
    )
  END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_todo_snapshot_v3(jsonb)
FROM PUBLIC, anon, authenticated;

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

ALTER TABLE public.tasks_history_events
DROP CONSTRAINT tasks_history_events_transition_valid;

ALTER TABLE public.tasks_history_events
ADD CONSTRAINT tasks_history_events_transition_valid CHECK (
  transition IN (
    'baseline',
    'create',
    'update',
    'move',
    'reorder',
    'set_actionability',
    'complete',
    'cancel',
    'reopen',
    'delete',
    'restore',
    'undo'
  )
);

CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_snapshot_v7(_snapshot jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN _snapshot IS NULL OR _snapshot = 'null'::jsonb THEN NULL
    ELSE tasks_private.normalize_todo_snapshot_v4(_snapshot) || jsonb_build_object(
      'actionability', COALESCE(_snapshot ->> 'actionability', 'actionable')
    )
  END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_todo_snapshot_v7(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot_v7(_task public.tasks_todos)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT tasks_private.todo_snapshot_v4(_task) || jsonb_build_object(
    'actionability', _task.actionability
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_snapshot_v7(public.tasks_todos)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.normalize_history_event_v7(_event jsonb)
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
        tasks_private.normalize_todo_snapshot_v7(_event -> 'before_state'),
        'null'::jsonb
      )
    ),
    '{after_state}',
    tasks_private.normalize_todo_snapshot_v7(_event -> 'after_state')
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_history_event_v7(jsonb)
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
      RAISE EXCEPTION 'A new task cannot be an undo mutation' USING ERRCODE = '23514';
    END IF;
    _base_revision := 0;
    _before_state := NULL;
    _transition := 'create';
  ELSE
    _base_revision := OLD.revision;
    _before_state := tasks_private.todo_snapshot_v7(OLD);

    IF NEW.undo_source_event_id IS NOT NULL THEN
      SELECT event.* INTO _undo_source
      FROM public.tasks_history_events AS event
      WHERE event.id = NEW.undo_source_event_id
        AND event.owner_id = NEW.owner_id
        AND event.task_id = NEW.id;

      IF NOT FOUND
        OR _undo_source.transition IN ('baseline', 'create')
        OR _undo_source.result_revision <> OLD.revision
        OR tasks_private.normalize_todo_snapshot_v7(_undo_source.before_state)
          IS DISTINCT FROM tasks_private.todo_snapshot_v7(NEW) THEN
        RAISE EXCEPTION 'The requested undo is no longer safe' USING ERRCODE = '23514';
      END IF;
      _transition := 'undo';
    ELSIF NEW.lifecycle IS DISTINCT FROM OLD.lifecycle THEN
      _transition := CASE NEW.lifecycle
        WHEN 'completed' THEN 'complete'
        WHEN 'canceled' THEN 'cancel'
        ELSE 'reopen'
      END;
    ELSIF NEW.disposition IS DISTINCT FROM OLD.disposition THEN
      _transition := CASE NEW.disposition WHEN 'deleted' THEN 'delete' ELSE 'restore' END;
    ELSIF NEW.actionability IS DISTINCT FROM OLD.actionability THEN
      _transition := 'set_actionability';
    ELSIF NEW.destination IS DISTINCT FROM OLD.destination
      OR NEW.today_section IS DISTINCT FROM OLD.today_section
      OR NEW.area_id IS DISTINCT FROM OLD.area_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.heading_id IS DISTINCT FROM OLD.heading_id THEN
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
    _transition, NEW.updated_at, 'accepted', NULL, _before_state,
    tasks_private.todo_snapshot_v7(NEW)
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.append_todo_history()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.normalize_legacy_export_actionability(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _tasks jsonb;
  _data jsonb;
  _manifest jsonb;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      task.value || jsonb_build_object(
        'actionability', COALESCE(task.value ->> 'actionability', 'actionable')
      )
      ORDER BY task.ordinality
    ),
    '[]'::jsonb
  ) INTO _tasks
  FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}')
    WITH ORDINALITY AS task(value, ordinality);

  _data := (_envelope -> 'data') || jsonb_build_object(
    'tasks_todos', _tasks
  );
  _manifest := jsonb_set(
    _envelope -> 'manifest',
    '{checksums,tasks_todos}',
    to_jsonb(tasks_private.export_checksum(_tasks))
  );

  RETURN (_envelope - 'data' - 'manifest') || jsonb_build_object(
    'manifest', _manifest,
    'data', _data
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_legacy_export_actionability(jsonb)
FROM PUBLIC, anon, authenticated;

-- Keep legacy exports restorable by validating their original checksums before
-- adding the default actionability value expected by the current row type.
ALTER FUNCTION public.tasks_restore_export_v3(jsonb, boolean)
RENAME TO tasks_restore_export_v3_pre_actionability;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v3_pre_actionability(jsonb, boolean)
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
BEGIN
  PERFORM tasks_private.validate_export_v3(_envelope);
  RETURN public.tasks_restore_export_v3_pre_actionability(
    tasks_private.normalize_legacy_export_actionability(_envelope),
    _dry_run
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v3(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v3(jsonb, boolean)
TO authenticated;

ALTER FUNCTION public.tasks_restore_export_v4(jsonb, boolean)
RENAME TO tasks_restore_export_v4_pre_actionability;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v4_pre_actionability(jsonb, boolean)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v4(
  _envelope jsonb,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM tasks_private.validate_export_v4(_envelope);
  RETURN public.tasks_restore_export_v4_pre_actionability(
    tasks_private.normalize_legacy_export_actionability(_envelope),
    _dry_run
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v4(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v4(jsonb, boolean)
TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.export_v7_as_v6(_envelope jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_set(_envelope, '{schema_version}', '6'::jsonb);
$$;

REVOKE ALL ON FUNCTION tasks_private.export_v7_as_v6(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v7(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export'
    OR COALESCE(_envelope ->> 'schema_version', '') !~ '^[0-9]+$'
    OR (_envelope ->> 'schema_version')::integer <> 7 THEN
    RAISE EXCEPTION 'Invalid task export v7 envelope' USING ERRCODE = '22023';
  END IF;

  PERFORM tasks_private.validate_export_v6(
    tasks_private.export_v7_as_v6(_envelope)
  );

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS task(value)
    WHERE COALESCE(task.value ->> 'actionability', '') NOT IN ('actionable', 'waiting')
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_history_events}') AS event(value)
    WHERE COALESCE(event.value #>> '{after_state,actionability}', '')
        NOT IN ('actionable', 'waiting')
      OR (
        event.value -> 'before_state' IS DISTINCT FROM 'null'::jsonb
        AND COALESCE(event.value #>> '{before_state,actionability}', '')
          NOT IN ('actionable', 'waiting')
      )
  ) THEN
    RAISE EXCEPTION 'Task export v7 contains invalid actionability'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS task(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_envelope #> '{data,tasks_history_events}') AS event(value)
      WHERE event.value ->> 'task_id' = task.value ->> 'id'
        AND (event.value ->> 'result_revision')::bigint
          = (task.value ->> 'revision')::bigint
        AND event.value #>> '{after_state,actionability}'
          = task.value ->> 'actionability'
    )
  ) THEN
    RAISE EXCEPTION 'Task export v7 is missing the final actionability history state'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v7(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v7()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _envelope jsonb;
  _history jsonb;
BEGIN
  _envelope := tasks_private.normalize_legacy_export_actionability(
    public.tasks_create_export_v6()
  );
  SELECT COALESCE(
    jsonb_agg(
      tasks_private.normalize_history_event_v7(to_jsonb(event) - 'owner_id')
      ORDER BY event.occurred_at, event.id
    ),
    '[]'::jsonb
  ) INTO _history
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id;

  _envelope := jsonb_set(
    jsonb_set(
      _envelope,
      '{data,tasks_history_events}',
      _history
    ),
    '{manifest,checksums,tasks_history_events}',
    to_jsonb(tasks_private.export_checksum(_history))
  );
  RETURN jsonb_set(_envelope, '{schema_version}', '7'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v7() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v7() TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v7(
  _envelope jsonb,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _report jsonb;
BEGIN
  PERFORM tasks_private.validate_export_v7(_envelope);
  _report := public.tasks_restore_export_v6(
    tasks_private.export_v7_as_v6(_envelope),
    _dry_run
  );
  RETURN jsonb_set(_report, '{schema_version}', '7'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v7(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v7(jsonb, boolean)
TO authenticated;
