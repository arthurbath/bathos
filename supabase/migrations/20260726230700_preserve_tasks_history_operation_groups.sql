-- Preserve one durable operation identifier across every task history event.
--
-- The project-removal migration rewrote this trigger function to remove the
-- Project snapshot field. This replacement retains that project-free snapshot
-- while restoring the operation-group assignment introduced immediately
-- before project removal.

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
    owner_id, task_id, client_mutation_id, operation_id, actor_type,
    mutation_channel, affected_ids, base_revision, result_revision,
    transition, occurred_at, outcome, code, before_state, after_state
  ) VALUES (
    NEW.owner_id, NEW.id, NEW.client_mutation_id,
    COALESCE(NEW.last_operation_id, NEW.client_mutation_id),
    NEW.last_actor_type, NEW.last_mutation_channel, ARRAY[NEW.id],
    _base_revision, NEW.revision, _transition, NEW.updated_at,
    'accepted', NULL, _before_state, _after_state
  );
  RETURN NEW;
END;
$$;
