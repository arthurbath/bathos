-- Date-only planning fields for task availability and completion boundaries

ALTER TABLE public.tasks_todos
  ADD COLUMN start_date date,
  ADD COLUMN deadline date,
  ADD CONSTRAINT tasks_todos_calendar_range_valid CHECK (
    start_date IS NULL
    OR deadline IS NULL
    OR deadline >= start_date
  );

CREATE INDEX tasks_todos_owner_start_date_idx
ON public.tasks_todos (owner_id, start_date, order_key, id)
WHERE disposition = 'present'
  AND lifecycle = 'open'
  AND start_date IS NOT NULL;

CREATE INDEX tasks_todos_owner_deadline_idx
ON public.tasks_todos (owner_id, deadline, id)
WHERE disposition = 'present'
  AND lifecycle = 'open'
  AND deadline IS NOT NULL;

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
    'start_date', _task.start_date,
    'deadline', _task.deadline,
    'source_kind', _task.source_kind,
    'source_url', _task.source_url,
    'source_title', _task.source_title,
    'source_external_id', _task.source_external_id
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_snapshot(public.tasks_todos)
FROM PUBLIC, anon, authenticated;
