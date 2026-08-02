-- Extend the guarded, preview-bound permanent-deletion authority from trashed
-- task roots to every task that is already terminal in Done. Active tasks stay
-- recoverable and cannot enter this scope.
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
  _root_deleted boolean := false;
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
  _recurrence_occurrence_ids uuid[] := ARRAY[]::uuid[];
  _hierarchy_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _root_type <> 'todo' THEN
    RAISE EXCEPTION 'Permanent deletion supports Done task roots only'
      USING ERRCODE = '22023';
  END IF;

  SELECT task.title, task.disposition = 'deleted'
  INTO _root_title, _root_deleted
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id
    AND task.id = _root_id
    AND (
      (
        task.disposition = 'deleted'
        AND task.deletion_root_id = task.id
      )
      OR (
        task.disposition = 'present'
        AND task.lifecycle IN ('completed', 'canceled')
      )
    );

  IF _root_title IS NULL THEN
    RAISE EXCEPTION 'The Done task root is unavailable'
      USING ERRCODE = '22023';
  END IF;

  IF _root_deleted AND EXISTS (
    SELECT 1 FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id
      AND area.deletion_root_id = _root_id
  ) THEN
    RAISE EXCEPTION 'The deletion root contains an unsupported area record'
      USING ERRCODE = '22023';
  END IF;

  IF _root_deleted THEN
    SELECT COALESCE(array_agg(task.id ORDER BY task.id), ARRAY[]::uuid[])
    INTO _todo_ids
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id AND task.deletion_root_id = _root_id;

    SELECT COALESCE(array_agg(item.id ORDER BY item.id), ARRAY[]::uuid[])
    INTO _checklist_ids
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id AND item.deletion_root_id = _root_id;
  ELSE
    _todo_ids := ARRAY[_root_id];

    SELECT COALESCE(array_agg(item.id ORDER BY item.id), ARRAY[]::uuid[])
    INTO _checklist_ids
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id AND item.task_id = _root_id;
  END IF;

  _hierarchy_ids := _todo_ids || _checklist_ids;

  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _task_history_ids
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id AND event.task_id = ANY(_todo_ids);

  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _hierarchy_history_ids
  FROM public.tasks_hierarchy_history_events AS event
  WHERE event.owner_id = _owner_id AND event.entity_id = ANY(_hierarchy_ids);

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
  WHERE reminder.owner_id = _owner_id AND reminder.task_id = ANY(_todo_ids);

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

  SELECT COALESCE(array_agg(occurrence.id ORDER BY occurrence.id), ARRAY[]::uuid[])
  INTO _recurrence_occurrence_ids
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.root_type = 'todo'
    AND occurrence.root_id = ANY(_todo_ids);

  RETURN jsonb_build_object(
    'root', jsonb_build_object('type', 'todo', 'id', _root_id, 'title', _root_title),
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
        WHERE task.owner_id = _owner_id AND task.id = ANY(_todo_ids)
      ), '[]'::jsonb),
      'checklist_items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('id', item.id, 'revision', item.revision)
          ORDER BY item.id
        )
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
      'recurrence_occurrences', to_jsonb(_recurrence_occurrence_ids)
    ),
    'erased_record_count', cardinality(_hierarchy_ids)
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

REVOKE ALL ON FUNCTION tasks_private.permanent_deletion_scope(uuid, text, uuid)
FROM PUBLIC, anon, authenticated;
