-- Guarded multi-step task undo and redo over append-only history.

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
    'undo',
    'redo'
  )
);

CREATE FUNCTION tasks_private.prepare_todo_update_v8()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _history_source public.tasks_history_events;
  _source_before jsonb;
  _source_after jsonb;
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
  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Task owner does not match the authenticated user'
      USING ERRCODE = '42501';
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

  -- An ordinary writer can leave the prior inverse source in place. Preserve a
  -- repeated source only when the complete state pair proves a deliberate
  -- undo or redo of that source event.
  IF NEW.undo_source_event_id IS NOT NULL
    AND NEW.undo_source_event_id IS NOT DISTINCT FROM OLD.undo_source_event_id THEN
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
      OR _history_source.transition IN ('baseline', 'create', 'undo', 'redo')
      OR NOT (
        (
          tasks_private.todo_snapshot_v7(OLD) IS NOT DISTINCT FROM _source_after
          AND tasks_private.todo_snapshot_v7(NEW) IS NOT DISTINCT FROM _source_before
        )
        OR (
          tasks_private.todo_snapshot_v7(OLD) IS NOT DISTINCT FROM _source_before
          AND tasks_private.todo_snapshot_v7(NEW) IS NOT DISTINCT FROM _source_after
        )
      ) THEN
      NEW.undo_source_event_id := NULL;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.prepare_todo_update_v8()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER tasks_todos_prepare_update ON public.tasks_todos;

CREATE TRIGGER tasks_todos_prepare_update
BEFORE UPDATE ON public.tasks_todos
FOR EACH ROW
EXECUTE FUNCTION tasks_private.prepare_todo_update_v8();

DROP FUNCTION public.tasks_prepare_todo_update();

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

  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) IS DISTINCT FROM NEW.owner_id THEN
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
        OR _history_source.transition IN ('baseline', 'create', 'undo', 'redo')
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
    _transition, NEW.updated_at, 'accepted', NULL, _before_state, _after_state
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.append_todo_history()
FROM PUBLIC, anon, authenticated;
