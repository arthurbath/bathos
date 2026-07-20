-- Append-only task history and inverse-mutation metadata

CREATE SCHEMA IF NOT EXISTS tasks_private;
REVOKE ALL ON SCHEMA tasks_private FROM PUBLIC, anon, authenticated;

ALTER TABLE public.tasks_todos
  ADD COLUMN last_mutation_channel text NOT NULL DEFAULT 'web',
  ADD COLUMN last_actor_type text NOT NULL DEFAULT 'user',
  ADD COLUMN undo_source_event_id uuid,
  ADD CONSTRAINT tasks_todos_last_mutation_channel_valid CHECK (
    last_mutation_channel IN (
      'web',
      'raycast',
      'mcp',
      'mail_automation',
      'browser_capture',
      'native',
      'import'
    )
  ),
  ADD CONSTRAINT tasks_todos_last_actor_type_valid CHECK (
    last_actor_type IN ('user', 'automation', 'system', 'import')
  );

CREATE TABLE public.tasks_history_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  client_mutation_id uuid NOT NULL,
  actor_type text NOT NULL,
  mutation_channel text NOT NULL,
  affected_ids uuid[] NOT NULL,
  base_revision bigint NOT NULL,
  result_revision bigint NOT NULL,
  transition text NOT NULL,
  occurred_at timestamptz NOT NULL,
  outcome text NOT NULL DEFAULT 'accepted',
  code text,
  before_state jsonb,
  after_state jsonb NOT NULL,
  CONSTRAINT tasks_history_events_task_owner_fkey
    FOREIGN KEY (task_id, owner_id)
    REFERENCES public.tasks_todos(id, owner_id)
    ON DELETE CASCADE,
  CONSTRAINT tasks_history_events_owner_mutation_key
    UNIQUE (owner_id, client_mutation_id),
  CONSTRAINT tasks_history_events_actor_type_valid CHECK (
    actor_type IN ('user', 'automation', 'system', 'import')
  ),
  CONSTRAINT tasks_history_events_channel_valid CHECK (
    mutation_channel IN (
      'web',
      'raycast',
      'mcp',
      'mail_automation',
      'browser_capture',
      'native',
      'import'
    )
  ),
  CONSTRAINT tasks_history_events_affected_ids_valid CHECK (
    cardinality(affected_ids) > 0
    AND task_id = ANY(affected_ids)
  ),
  CONSTRAINT tasks_history_events_transition_valid CHECK (
    transition IN (
      'baseline',
      'create',
      'update',
      'move',
      'reorder',
      'complete',
      'cancel',
      'reopen',
      'delete',
      'restore',
      'undo'
    )
  ),
  CONSTRAINT tasks_history_events_outcome_valid CHECK (outcome = 'accepted'),
  CONSTRAINT tasks_history_events_revisions_valid CHECK (
    base_revision >= 0
    AND result_revision > 0
    AND (
      (transition = 'baseline' AND base_revision = result_revision)
      OR (transition = 'create' AND base_revision = 0 AND result_revision = 1)
      OR (
        transition NOT IN ('baseline', 'create')
        AND result_revision = base_revision + 1
      )
    )
  ),
  CONSTRAINT tasks_history_events_state_valid CHECK (
    (transition IN ('baseline', 'create') AND before_state IS NULL)
    OR (transition NOT IN ('baseline', 'create') AND before_state IS NOT NULL)
  ),
  CONSTRAINT tasks_history_events_code_valid CHECK (
    (transition = 'baseline' AND code = 'history_started')
    OR (transition <> 'baseline' AND code IS NULL)
  )
);

ALTER TABLE public.tasks_history_events REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_history_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX tasks_history_events_owner_occurred_idx
ON public.tasks_history_events (owner_id, occurred_at DESC, id);

CREATE INDEX tasks_history_events_owner_task_occurred_idx
ON public.tasks_history_events (owner_id, task_id, occurred_at DESC, id);

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot(_task public.tasks_todos)
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
    'order_key', _task.order_key,
    'source_kind', _task.source_kind,
    'source_url', _task.source_url,
    'source_title', _task.source_title,
    'source_external_id', _task.source_external_id
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_snapshot(public.tasks_todos)
FROM PUBLIC, anon, authenticated;

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
SELECT
  task.owner_id,
  task.id,
  task.client_mutation_id,
  'system',
  'import',
  ARRAY[task.id],
  task.revision,
  task.revision,
  'baseline',
  task.updated_at,
  'accepted',
  'history_started',
  NULL,
  tasks_private.todo_snapshot(task)
FROM public.tasks_todos AS task;

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

CREATE OR REPLACE FUNCTION public.tasks_prepare_todo_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Task identifier is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Task owner is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Task creation time is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.entry_channel IS DISTINCT FROM OLD.entry_channel THEN
    RAISE EXCEPTION 'Task entry channel is immutable'
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

CREATE TRIGGER tasks_todos_append_history
AFTER INSERT OR UPDATE ON public.tasks_todos
FOR EACH ROW
EXECUTE FUNCTION tasks_private.append_todo_history();

CREATE POLICY "Task owners can view their history"
ON public.tasks_history_events
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.tasks_history_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tasks_history_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_history_events TO service_role;
