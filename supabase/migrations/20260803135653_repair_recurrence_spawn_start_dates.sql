-- Generate recurrence instance dates from the accepted recurrence revision.
-- Prototype snapshots retain ordinary task content, but their historical
-- scheduling-offset fields are redundant and may be stale or absent.

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
  _snapshot jsonb := _revision.prototype_snapshot;
  _root jsonb;
  _item jsonb;
  _task_id uuid := gen_random_uuid();
  _occurrence_id uuid := gen_random_uuid();
  _item_id uuid;
  _start_date date;
  _deadline date;
  _planning_date date;
BEGIN
  SELECT occurrence.* INTO _existing
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.recurrence_id = _definition.id
    AND occurrence.logical_key = _logical_key;
  IF FOUND THEN RETURN _existing; END IF;

  _snapshot := tasks_private.normalize_recurrence_snapshot(_snapshot);
  _root := _snapshot -> 'root';
  _start_date := tasks_private.recurrence_spawn_date(
    _scheduled_date,
    _revision.deadline_offset_days
  );
  _deadline := CASE
    WHEN _revision.deadline_offset_days IS NULL THEN NULL
    ELSE _scheduled_date
  END;
  _planning_date := (
    clock_timestamp() AT TIME ZONE _revision.planning_timezone
  )::date;

  INSERT INTO public.tasks_todos (
    id, owner_id, title, notes, lifecycle, completed_at, canceled_at,
    disposition, deleted_at, destination, order_key, upcoming_order_key,
    entry_channel, source_kind, source_url, source_title, source_external_id,
    revision, client_mutation_id, created_at, updated_at,
    last_mutation_channel, last_actor_type, start_date, deadline,
    today_section, area_id, hierarchy_order_key, actionability, primary_link
  ) VALUES (
    _task_id, _owner_id, _root ->> 'title', COALESCE(_root ->> 'notes', ''),
    'open', NULL, NULL, 'present', NULL, 'anytime',
    COALESCE(NULLIF(_root ->> 'order_key', ''), 'a0'),
    COALESCE(
      _definition.upcoming_order_key,
      NULLIF(_root ->> 'order_key', ''),
      'a0'
    ),
    _entry_channel, NULL, NULL, NULL, NULL, 1, gen_random_uuid(),
    clock_timestamp(), clock_timestamp(), _entry_channel, _actor_type,
    _start_date,
    _deadline,
    CASE WHEN _start_date IS NOT NULL AND _start_date <= _planning_date
      THEN 'inbox' ELSE NULL END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.tasks_areas AS area
      WHERE area.id = _revision.target_area_id
        AND area.owner_id = _owner_id
        AND area.disposition = 'present'
    ) THEN _revision.target_area_id ELSE NULL END,
    NULL,
    COALESCE(_root ->> 'actionability', 'actionable'),
    CASE WHEN NULLIF(btrim(_root ->> 'primary_link'), '') IS NULL
      THEN NULL ELSE _root ->> 'primary_link' END
  );

  FOR _item IN
    SELECT value FROM jsonb_array_elements(_snapshot #> '{root,checklist}')
  LOOP
    _item_id := gen_random_uuid();
    INSERT INTO public.tasks_checklist_items (
      id, owner_id, task_id, title, completed, completed_at, order_key,
      disposition, deleted_at, entry_channel, last_mutation_channel,
      last_actor_type, revision, client_mutation_id, created_at, updated_at
    ) VALUES (
      _item_id, _owner_id, _task_id, _item ->> 'title',
      COALESCE((_item ->> 'completed')::boolean, false),
      CASE WHEN COALESCE((_item ->> 'completed')::boolean, false)
        THEN clock_timestamp() ELSE NULL END,
      COALESCE(NULLIF(_item ->> 'order_key', ''), 'a0'),
      'present', NULL, _entry_channel, _entry_channel, _actor_type,
      1, gen_random_uuid(), clock_timestamp(), clock_timestamp()
    );
  END LOOP;

  INSERT INTO public.tasks_recurrence_occurrences (
    id, owner_id, recurrence_id, recurrence_revision, logical_key,
    scheduled_date, predecessor_occurrence_id,
    root_type, root_id, client_mutation_id, generated_at, origin
  ) VALUES (
    _occurrence_id, _owner_id, _definition.id, _revision.revision,
    _logical_key, _scheduled_date, _predecessor_occurrence_id,
    'todo', _task_id, _occurrence_id, clock_timestamp(), 'generated'
  ) RETURNING * INTO _occurrence;

  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (pg_backend_pid(), txid_current(), _owner_id)
  ON CONFLICT DO NOTHING;
  UPDATE public.tasks_todos
  SET recurrence_definition_id = _definition.id,
      recurrence_revision = _revision.revision,
      recurrence_occurrence_id = _occurrence.id,
      recurrence_logical_key = _logical_key,
      revision = revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = _entry_channel,
      last_actor_type = _actor_type,
      updated_at = clock_timestamp()
  WHERE id = _task_id AND owner_id = _owner_id;
  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  IF _revision.reminder_local_time IS NOT NULL
    AND auth.uid() IS NOT DISTINCT FROM _owner_id THEN
    PERFORM public.tasks_save_start_reminder(
      NULL, NULL, 'todo', _task_id,
      to_char(_revision.reminder_local_time, 'HH24:MI'),
      _revision.planning_timezone, 'earlier', gen_random_uuid(),
      _entry_channel, _actor_type
    );
  END IF;
  RETURN _occurrence;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.instantiate_recurrence_occurrence(
  uuid, public.tasks_recurrence_definitions,
  public.tasks_recurrence_revisions, date, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;
