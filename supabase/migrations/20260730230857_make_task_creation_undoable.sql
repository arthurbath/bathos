-- Make accepted task creation events traversable without erasing their history.
-- Undo represents creation as a recoverably deleted root. Redo restores the
-- exact creation snapshot. No task rows are rewritten by this migration.

ALTER TABLE public.tasks_checklist_items
  ADD COLUMN last_operation_id uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.tasks_hierarchy_history_events
  ADD COLUMN action_id uuid NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX tasks_hierarchy_history_owner_action_idx
ON public.tasks_hierarchy_history_events (
  owner_id, action_id, occurred_at, id
);

CREATE OR REPLACE FUNCTION tasks_private.assign_checklist_operation_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.last_operation_id := COALESCE(
      NEW.last_operation_id,
      NEW.client_mutation_id
    );
  ELSIF NEW.last_operation_id IS NOT DISTINCT FROM OLD.last_operation_id THEN
    NEW.last_operation_id := NEW.client_mutation_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.assign_checklist_operation_id()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_checklist_items_assign_operation_id
BEFORE INSERT OR UPDATE ON public.tasks_checklist_items
FOR EACH ROW
EXECUTE FUNCTION tasks_private.assign_checklist_operation_id();

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
  _action_id uuid := COALESCE(
    NULLIF(to_jsonb(NEW) ->> 'last_operation_id', '')::uuid,
    NEW.client_mutation_id
  );
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
    action_id, actor_type, mutation_channel, affected_ids, base_revision,
    result_revision, transition, occurred_at, before_state, after_state
  ) VALUES (
    NEW.owner_id, _entity_type, NEW.id, NEW.client_mutation_id,
    tasks_private.current_hierarchy_operation_id(NEW.owner_id),
    _action_id, NEW.last_actor_type, NEW.last_mutation_channel, ARRAY[NEW.id],
    _base_revision, NEW.revision, _transition, NEW.updated_at,
    _before_state, to_jsonb(NEW) - 'owner_id'
  );
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.append_hierarchy_history()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot_is_create_deletion(
  _candidate jsonb,
  _created jsonb,
  _task_id uuid
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT _candidate IS NOT NULL
    AND _created IS NOT NULL
    AND _candidate ->> 'disposition' = 'deleted'
    AND NULLIF(_candidate ->> 'deleted_at', '') IS NOT NULL
    AND _candidate ->> 'deletion_root_id' = _task_id::text
    AND (
      _candidate - 'disposition' - 'deleted_at' - 'deletion_root_id'
    ) IS NOT DISTINCT FROM (
      _created - 'disposition' - 'deleted_at' - 'deletion_root_id'
    )
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_snapshot_is_create_deletion(
  jsonb, jsonb, uuid
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.guard_todo_hierarchy_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.disposition IS DISTINCT FROM OLD.disposition
    AND tasks_private.current_hierarchy_operation_id(NEW.owner_id) IS NULL
    AND NEW.undo_source_event_id IS NULL THEN
    RAISE EXCEPTION 'Task disposition changes require a hierarchy operation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.guard_todo_hierarchy_transition()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.prepare_todo_update_v8()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _history_source public.tasks_history_events;
  _source_before jsonb;
  _source_after jsonb;
  _history_traversal_is_safe boolean;
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
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Task revision must increment by exactly one'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.client_mutation_id = OLD.client_mutation_id THEN
    RAISE EXCEPTION 'Task updates require a new client mutation identifier'
      USING ERRCODE = '23514';
  END IF;

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

    IF FOUND AND _history_source.transition = 'create' THEN
      _history_traversal_is_safe := _source_before IS NULL
        AND (
          (
            tasks_private.todo_snapshot_v7(OLD)
              IS NOT DISTINCT FROM _source_after
            AND tasks_private.todo_snapshot_is_create_deletion(
              tasks_private.todo_snapshot_v7(NEW),
              _source_after,
              NEW.id
            )
          )
          OR (
            tasks_private.todo_snapshot_is_create_deletion(
              tasks_private.todo_snapshot_v7(OLD),
              _source_after,
              NEW.id
            )
            AND tasks_private.todo_snapshot_v7(NEW)
              IS NOT DISTINCT FROM _source_after
          )
        );
    ELSE
      _history_traversal_is_safe := FOUND
        AND _history_source.transition NOT IN (
          'baseline', 'undo', 'redo'
        )
        AND _source_before IS NOT NULL
        AND (
          (
            tasks_private.todo_snapshot_v7(OLD)
              IS NOT DISTINCT FROM _source_after
            AND tasks_private.todo_snapshot_v7(NEW)
              IS NOT DISTINCT FROM _source_before
          )
          OR (
            tasks_private.todo_snapshot_v7(OLD)
              IS NOT DISTINCT FROM _source_before
            AND tasks_private.todo_snapshot_v7(NEW)
              IS NOT DISTINCT FROM _source_after
          )
        );
    END IF;

    IF NOT COALESCE(_history_traversal_is_safe, false) THEN
      NEW.undo_source_event_id := NULL;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.prepare_todo_update_v8()
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
        OR _history_source.transition IN ('baseline', 'undo', 'redo') THEN
        RAISE EXCEPTION 'The requested task history traversal is no longer safe'
          USING ERRCODE = '23514';
      ELSIF _history_source.transition = 'create'
        AND _source_before IS NULL
        AND _before_state IS NOT DISTINCT FROM _source_after
        AND tasks_private.todo_snapshot_is_create_deletion(
          _after_state,
          _source_after,
          NEW.id
        ) THEN
        _transition := 'undo';
      ELSIF _history_source.transition = 'create'
        AND _source_before IS NULL
        AND tasks_private.todo_snapshot_is_create_deletion(
          _before_state,
          _source_after,
          NEW.id
        )
        AND _after_state IS NOT DISTINCT FROM _source_after THEN
        _transition := 'redo';
      ELSIF _history_source.transition <> 'create'
        AND _source_before IS NOT NULL
        AND _before_state IS NOT DISTINCT FROM _source_after
        AND _after_state IS NOT DISTINCT FROM _source_before THEN
        _transition := 'undo';
      ELSIF _history_source.transition <> 'create'
        AND _source_before IS NOT NULL
        AND _before_state IS NOT DISTINCT FROM _source_before
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

REVOKE ALL ON FUNCTION tasks_private.append_todo_history()
FROM PUBLIC, anon, authenticated;
