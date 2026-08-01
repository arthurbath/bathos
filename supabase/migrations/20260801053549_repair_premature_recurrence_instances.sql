-- Keep recurrence prototypes virtual until their owner-local spawn date and
-- repair the prematurely adopted future projections preserved by the
-- template-free conversion.

DO $$
DECLARE
  _candidate_count integer;
  _candidate_owner_count integer;
  _candidate_definition_count integer;
  _same_revision_count integer;
  _definition_count integer;
  _adopted_count integer;
  _generated_count integer;
  _future_generated_count integer;
BEGIN
  WITH owner_dates AS (
    SELECT settings.owner_id,
      (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date
        AS planning_date
    FROM public.tasks_user_settings AS settings
  ), candidates AS (
    SELECT occurrence.owner_id,
      occurrence.recurrence_id,
      occurrence.recurrence_revision,
      definition.current_revision
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN owner_dates ON owner_dates.owner_id = occurrence.owner_id
    JOIN public.tasks_todos AS task
      ON task.owner_id = occurrence.owner_id
     AND task.id = occurrence.root_id
    JOIN public.tasks_recurrence_definitions AS definition
      ON definition.owner_id = occurrence.owner_id
     AND definition.id = occurrence.recurrence_id
    WHERE occurrence.origin = 'adopted'
      AND occurrence.scheduled_date > owner_dates.planning_date
      AND task.lifecycle = 'open'
      AND task.disposition = 'present'
  )
  SELECT count(*), count(DISTINCT owner_id),
    count(DISTINCT recurrence_id),
    count(*) FILTER (WHERE recurrence_revision = current_revision)
  INTO _candidate_count, _candidate_owner_count,
    _candidate_definition_count, _same_revision_count
  FROM candidates;

  IF _candidate_count = 0 THEN
    RETURN;
  END IF;

  IF _candidate_count <> 54
    OR _candidate_owner_count <> 1
    OR _candidate_definition_count <> 54
    OR _same_revision_count <> 53 THEN
    RAISE EXCEPTION
      'Premature recurrence repair preflight changed: candidates %, owners %, definitions %, same revision %',
      _candidate_count, _candidate_owner_count,
      _candidate_definition_count, _same_revision_count
      USING ERRCODE = 'P0001';
  END IF;

  WITH candidate_owner AS (
    SELECT occurrence.owner_id
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_user_settings AS settings
      ON settings.owner_id = occurrence.owner_id
    JOIN public.tasks_todos AS task
      ON task.owner_id = occurrence.owner_id
     AND task.id = occurrence.root_id
    WHERE occurrence.origin = 'adopted'
      AND occurrence.scheduled_date >
        (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date
      AND task.lifecycle = 'open'
      AND task.disposition = 'present'
    LIMIT 1
  )
  SELECT
    (SELECT count(*)
     FROM public.tasks_recurrence_definitions AS definition
     JOIN candidate_owner ON candidate_owner.owner_id = definition.owner_id),
    (SELECT count(*)
     FROM public.tasks_recurrence_occurrences AS occurrence
     JOIN candidate_owner ON candidate_owner.owner_id = occurrence.owner_id
     WHERE occurrence.origin = 'adopted'),
    (SELECT count(*)
     FROM public.tasks_recurrence_occurrences AS occurrence
     JOIN candidate_owner ON candidate_owner.owner_id = occurrence.owner_id
     WHERE occurrence.origin = 'generated'),
    (SELECT count(*)
     FROM public.tasks_recurrence_occurrences AS occurrence
     JOIN candidate_owner ON candidate_owner.owner_id = occurrence.owner_id
     JOIN public.tasks_user_settings AS settings
       ON settings.owner_id = occurrence.owner_id
     JOIN public.tasks_todos AS task
       ON task.owner_id = occurrence.owner_id
      AND task.id = occurrence.root_id
     WHERE occurrence.origin = 'generated'
       AND occurrence.scheduled_date >
         (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date
       AND task.lifecycle = 'open'
       AND task.disposition = 'present')
  INTO _definition_count, _adopted_count,
    _generated_count, _future_generated_count;

  IF _definition_count <> 60
    OR _adopted_count <> 60
    OR _generated_count <> 1
    OR _future_generated_count <> 0 THEN
    RAISE EXCEPTION
      'Premature recurrence repair owner preflight changed: definitions %, adopted %, generated %, future generated %',
      _definition_count, _adopted_count,
      _generated_count, _future_generated_count
      USING ERRCODE = 'P0001';
  END IF;
END
$$;

CREATE TEMP TABLE tasks_recurrence_premature_adopted ON COMMIT DROP AS
SELECT occurrence.id AS occurrence_id,
  occurrence.owner_id,
  occurrence.recurrence_id,
  occurrence.recurrence_revision,
  occurrence.root_id,
  occurrence.scheduled_date,
  definition.current_revision,
  (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date
    AS planning_date
FROM public.tasks_recurrence_occurrences AS occurrence
JOIN public.tasks_user_settings AS settings
  ON settings.owner_id = occurrence.owner_id
JOIN public.tasks_todos AS task
  ON task.owner_id = occurrence.owner_id
 AND task.id = occurrence.root_id
JOIN public.tasks_recurrence_definitions AS definition
  ON definition.owner_id = occurrence.owner_id
 AND definition.id = occurrence.recurrence_id
WHERE occurrence.origin = 'adopted'
  AND occurrence.scheduled_date >
    (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date
  AND task.lifecycle = 'open'
  AND task.disposition = 'present';

INSERT INTO tasks_private.recurrence_contexts (
  backend_pid, transaction_id, owner_id
)
SELECT DISTINCT pg_backend_pid(), txid_current(), owner_id
FROM tasks_recurrence_premature_adopted
ON CONFLICT DO NOTHING;

-- Preserve edits made directly to an unreached projection unless a newer
-- recurrence revision already owns an independently edited prototype.
UPDATE public.tasks_recurrence_revisions AS revision
SET prototype_snapshot = tasks_private.normalize_recurrence_snapshot(
  tasks_private.recurrence_snapshot_from_todo(
    projection.owner_id,
    projection.root_id,
    projection.scheduled_date
  )
)
FROM tasks_recurrence_premature_adopted AS projection
WHERE revision.owner_id = projection.owner_id
  AND revision.recurrence_id = projection.recurrence_id
  AND revision.revision = projection.recurrence_revision
  AND projection.recurrence_revision = projection.current_revision;

UPDATE public.tasks_recurrence_definitions AS definition
SET next_occurrence_date = projection.scheduled_date,
    evaluated_through_date = projection.planning_date,
    record_revision = definition.record_revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'web',
    last_actor_type = 'system',
    updated_at = clock_timestamp()
FROM tasks_recurrence_premature_adopted AS projection
WHERE definition.owner_id = projection.owner_id
  AND definition.id = projection.recurrence_id;

DELETE FROM public.tasks_checklist_items AS item
USING tasks_recurrence_premature_adopted AS projection
WHERE item.owner_id = projection.owner_id
  AND item.task_id = projection.root_id;

DELETE FROM public.tasks_todos AS task
USING tasks_recurrence_premature_adopted AS projection
WHERE task.owner_id = projection.owner_id
  AND task.id = projection.root_id;

DELETE FROM public.tasks_recurrence_occurrences AS occurrence
USING tasks_recurrence_premature_adopted AS projection
WHERE occurrence.owner_id = projection.owner_id
  AND occurrence.id = projection.occurrence_id;

DELETE FROM tasks_private.recurrence_contexts
WHERE backend_pid = pg_backend_pid()
  AND transaction_id = txid_current();

DO $$
DECLARE
  _remaining_tasks integer;
  _remaining_occurrences integer;
  _rewound_definitions integer;
BEGIN
  SELECT count(*) INTO _remaining_tasks
  FROM public.tasks_todos AS task
  JOIN tasks_recurrence_premature_adopted AS projection
    ON projection.owner_id = task.owner_id
   AND projection.root_id = task.id;

  SELECT count(*) INTO _remaining_occurrences
  FROM public.tasks_recurrence_occurrences AS occurrence
  JOIN tasks_recurrence_premature_adopted AS projection
    ON projection.owner_id = occurrence.owner_id
   AND projection.occurrence_id = occurrence.id;

  SELECT count(*) INTO _rewound_definitions
  FROM public.tasks_recurrence_definitions AS definition
  JOIN tasks_recurrence_premature_adopted AS projection
    ON projection.owner_id = definition.owner_id
   AND projection.recurrence_id = definition.id
  WHERE definition.next_occurrence_date = projection.scheduled_date
    AND definition.evaluated_through_date = projection.planning_date;

  IF _remaining_tasks <> 0
    OR _remaining_occurrences <> 0
    OR _rewound_definitions <>
      (SELECT count(*) FROM tasks_recurrence_premature_adopted) THEN
    RAISE EXCEPTION
      'Premature recurrence repair postflight failed: tasks %, occurrences %, rewound %',
      _remaining_tasks, _remaining_occurrences, _rewound_definitions
      USING ERRCODE = 'P0001';
  END IF;
END
$$;

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
  IF FOUND THEN
    RETURN _existing;
  END IF;

  _snapshot := tasks_private.normalize_recurrence_snapshot(_snapshot);
  _root := _snapshot -> 'root';
  _start_date := CASE
    WHEN _root -> 'start_offset_days' IS NULL
      OR _root -> 'start_offset_days' = 'null'::jsonb THEN NULL
    ELSE _scheduled_date + (_root ->> 'start_offset_days')::integer
  END;
  _deadline := CASE
    WHEN _root -> 'deadline_offset_days' IS NULL
      OR _root -> 'deadline_offset_days' = 'null'::jsonb THEN NULL
    ELSE _scheduled_date + (_root ->> 'deadline_offset_days')::integer
  END;
  _planning_date := (
    clock_timestamp() AT TIME ZONE _revision.planning_timezone
  )::date;

  INSERT INTO public.tasks_todos (
    id, owner_id, title, notes, lifecycle, completed_at, canceled_at,
    disposition, deleted_at, destination, order_key, entry_channel,
    source_kind, source_url, source_title, source_external_id,
    revision, client_mutation_id, created_at, updated_at,
    last_mutation_channel, last_actor_type, start_date, deadline,
    today_section, area_id, hierarchy_order_key, actionability,
    primary_link
  ) VALUES (
    _task_id,
    _owner_id,
    _root ->> 'title',
    COALESCE(_root ->> 'notes', ''),
    'open', NULL, NULL, 'present', NULL,
    'anytime',
    COALESCE(NULLIF(_root ->> 'order_key', ''), 'a0'),
    _entry_channel,
    NULL, NULL, NULL, NULL,
    1,
    gen_random_uuid(),
    clock_timestamp(),
    clock_timestamp(),
    _entry_channel,
    _actor_type,
    CASE WHEN _start_date > _planning_date THEN _start_date ELSE NULL END,
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
    SELECT value
    FROM jsonb_array_elements(_snapshot #> '{root,checklist}')
  LOOP
    _item_id := gen_random_uuid();
    INSERT INTO public.tasks_checklist_items (
      id, owner_id, task_id, title, completed, completed_at, order_key,
      disposition, deleted_at, entry_channel, last_mutation_channel,
      last_actor_type, revision, client_mutation_id, created_at, updated_at
    ) VALUES (
      _item_id,
      _owner_id,
      _task_id,
      _item ->> 'title',
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
  )
  RETURNING * INTO _occurrence;

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

CREATE OR REPLACE FUNCTION public.tasks_create_recurrence_from_task(
  _task_id uuid,
  _name text,
  _rule_mode text,
  _frequency text,
  _interval_count integer,
  _schedule_date date,
  _rule_config jsonb,
  _end_mode text,
  _end_after_count integer,
  _end_on_date date,
  _reminder_local_time time,
  _deadline_offset_days integer,
  _mutation_id uuid,
  _mutation_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _task public.tasks_todos;
  _definition public.tasks_recurrence_definitions;
  _revision public.tasks_recurrence_revisions;
  _occurrence public.tasks_recurrence_occurrences;
  _timezone text;
  _planning_date date;
  _snapshot jsonb;
  _logical_key text;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _task_id IS NULL OR _mutation_id IS NULL
    OR NULLIF(btrim(_name), '') IS NULL
    OR _rule_mode NOT IN ('calendar', 'after_completion')
    OR _frequency NOT IN ('daily', 'weekly', 'monthly', 'yearly')
    OR _interval_count NOT BETWEEN 1 AND 1000
    OR _schedule_date IS NULL
    OR jsonb_typeof(COALESCE(_rule_config, '{}'::jsonb)) <> 'object'
    OR _end_mode NOT IN ('never', 'after', 'on_date')
    OR (_end_mode = 'after' AND COALESCE(_end_after_count, 0) < 1)
    OR (_end_mode = 'on_date' AND _end_on_date IS NULL)
    OR COALESCE(_deadline_offset_days, 0) < 0 THEN
    RAISE EXCEPTION 'Recurrence input is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT settings.planning_timezone,
    (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date
  INTO _timezone, _planning_date
  FROM public.tasks_user_settings AS settings
  WHERE settings.owner_id = _owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task planning settings are unavailable'
      USING ERRCODE = '22023';
  END IF;
  IF _schedule_date < _planning_date THEN
    RAISE EXCEPTION 'The first recurrence date cannot be in the past'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _mutation_id::text, 0)
  );
  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.owner_id = _owner_id
    AND definition.client_mutation_id = _mutation_id;
  IF NOT FOUND THEN
    SELECT occurrence.* INTO _occurrence
    FROM public.tasks_recurrence_occurrences AS occurrence
    WHERE occurrence.owner_id = _owner_id
      AND occurrence.client_mutation_id = _mutation_id;
    IF FOUND THEN
      SELECT definition.* INTO _definition
      FROM public.tasks_recurrence_definitions AS definition
      WHERE definition.owner_id = _owner_id
        AND definition.id = _occurrence.recurrence_id;
    END IF;
  END IF;
  IF FOUND THEN
    SELECT revision.* INTO _revision
    FROM public.tasks_recurrence_revisions AS revision
    WHERE revision.owner_id = _owner_id
      AND revision.recurrence_id = _definition.id
      AND revision.revision = _definition.current_revision;
    IF _occurrence.id IS NULL THEN
      SELECT occurrence.* INTO _occurrence
      FROM public.tasks_recurrence_occurrences AS occurrence
      WHERE occurrence.owner_id = _owner_id
        AND occurrence.recurrence_id = _definition.id
        AND occurrence.client_mutation_id = _mutation_id;
    END IF;
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'definition', to_jsonb(_definition) - 'owner_id',
      'revision', to_jsonb(_revision) - 'owner_id',
      'occurrence', CASE WHEN _occurrence.id IS NULL
        THEN 'null'::jsonb
        ELSE to_jsonb(_occurrence) - 'owner_id'
      END
    );
  END IF;

  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.id = _task_id
    AND task.owner_id = _owner_id
    AND task.disposition = 'present'
    AND task.lifecycle = 'open'
    AND task.recurrence_definition_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The task is unavailable for recurrence'
      USING ERRCODE = '22023';
  END IF;

  _snapshot := tasks_private.recurrence_snapshot_from_todo(
    _owner_id, _task_id, _schedule_date
  );
  _snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(_snapshot, '{root,destination}', '"anytime"'::jsonb),
      '{root,today_section}', 'null'::jsonb
    ),
    '{root,start_offset_days}',
    to_jsonb(CASE WHEN _deadline_offset_days IS NULL
      THEN 0 ELSE -_deadline_offset_days END)
  );
  _snapshot := jsonb_set(
    _snapshot,
    '{root,deadline_offset_days}',
    CASE WHEN _deadline_offset_days IS NULL
      THEN 'null'::jsonb ELSE '0'::jsonb END
  );

  INSERT INTO public.tasks_recurrence_definitions (
    owner_id, name, status, current_revision, record_revision,
    evaluated_through_date, next_occurrence_date,
    last_mutation_channel, last_actor_type, client_mutation_id,
    created_at, updated_at
  ) VALUES (
    _owner_id, btrim(_name), 'active', 1, 1, _planning_date,
    CASE WHEN _schedule_date > _planning_date
      THEN _schedule_date ELSE NULL END,
    _mutation_channel, _actor_type, _mutation_id,
    clock_timestamp(), clock_timestamp()
  ) RETURNING * INTO _definition;

  INSERT INTO public.tasks_recurrence_revisions (
    owner_id, recurrence_id, revision, name,
    rule_mode, frequency, interval_count, start_date, planning_timezone,
    missed_policy, catch_up_limit, target_area_id, client_mutation_id,
    created_at, rule_config, end_mode, end_after_count, end_on_date,
    reminder_local_time, deadline_offset_days, prototype_snapshot
  ) VALUES (
    _owner_id, _definition.id, 1, btrim(_name),
    _rule_mode, _frequency, _interval_count, _schedule_date, _timezone,
    'latest', 100, _task.area_id, _mutation_id, clock_timestamp(),
    COALESCE(_rule_config, '{}'::jsonb), _end_mode,
    CASE WHEN _end_mode = 'after' THEN _end_after_count ELSE NULL END,
    CASE WHEN _end_mode = 'on_date' THEN _end_on_date ELSE NULL END,
    _reminder_local_time, _deadline_offset_days, _snapshot
  ) RETURNING * INTO _revision;

  IF _schedule_date > _planning_date THEN
    DELETE FROM public.tasks_checklist_items
    WHERE owner_id = _owner_id AND task_id = _task_id;
    DELETE FROM public.tasks_todos
    WHERE owner_id = _owner_id AND id = _task_id;
    RETURN jsonb_build_object(
      'outcome', 'accepted',
      'definition', to_jsonb(_definition) - 'owner_id',
      'revision', to_jsonb(_revision) - 'owner_id',
      'occurrence', 'null'::jsonb
    );
  END IF;

  _logical_key := CASE WHEN _rule_mode = 'calendar'
    THEN 'calendar:' || _schedule_date::text
    ELSE 'initial:' || _schedule_date::text END;
  INSERT INTO public.tasks_recurrence_occurrences (
    owner_id, recurrence_id, recurrence_revision, logical_key,
    scheduled_date, predecessor_occurrence_id,
    root_type, root_id, client_mutation_id, generated_at, origin
  ) VALUES (
    _owner_id, _definition.id, 1, _logical_key,
    _schedule_date, NULL, 'todo', _task_id, _mutation_id,
    clock_timestamp(), 'adopted'
  ) RETURNING * INTO _occurrence;

  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (pg_backend_pid(), txid_current(), _owner_id)
  ON CONFLICT DO NOTHING;
  UPDATE public.tasks_todos
  SET recurrence_definition_id = _definition.id,
      recurrence_revision = 1,
      recurrence_occurrence_id = _occurrence.id,
      recurrence_logical_key = _logical_key,
      start_date = NULL,
      today_section = 'inbox',
      revision = revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type,
      updated_at = clock_timestamp()
  WHERE id = _task_id AND owner_id = _owner_id;
  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  IF _rule_mode = 'calendar' THEN
    UPDATE public.tasks_recurrence_definitions
    SET next_occurrence_date = tasks_private.recurrence_next_date_after(
          _revision, _schedule_date
        ),
        record_revision = record_revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = _mutation_channel,
        last_actor_type = _actor_type,
        updated_at = clock_timestamp()
    WHERE id = _definition.id AND owner_id = _owner_id
    RETURNING * INTO _definition;
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'definition', to_jsonb(_definition) - 'owner_id',
    'revision', to_jsonb(_revision) - 'owner_id',
    'occurrence', to_jsonb(_occurrence) - 'owner_id'
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_create_recurrence_from_task(
  uuid, text, text, text, integer, date, jsonb, text, integer, date,
  time, integer, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_recurrence_from_task(
  uuid, text, text, text, integer, date, jsonb, text, integer, date,
  time, integer, uuid, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_evaluate_recurrence(
  _recurrence_id uuid,
  _through_date date,
  _request_id uuid,
  _entry_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _definition public.tasks_recurrence_definitions;
  _revision public.tasks_recurrence_revisions;
  _existing public.tasks_recurrence_evaluations;
  _occurrence public.tasks_recurrence_occurrences;
  _planning_date date;
  _candidate date;
  _next_candidate date;
  _selected_dates date[] := ARRAY[]::date[];
  _occurrence_ids jsonb := '[]'::jsonb;
  _result jsonb;
  _predecessor_id uuid;
  _loop_count integer := 0;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to evaluate recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _through_date IS NULL OR _request_id IS NULL THEN
    RAISE EXCEPTION 'Recurrence evaluation input is invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date
  INTO _planning_date
  FROM public.tasks_user_settings AS settings
  WHERE settings.owner_id = _owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task planning settings are unavailable'
      USING ERRCODE = '22023';
  END IF;
  IF _through_date > _planning_date THEN
    RAISE EXCEPTION 'Recurrence cannot be evaluated beyond the planning date'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _request_id::text, 0)
  );
  SELECT evaluation.* INTO _existing
  FROM public.tasks_recurrence_evaluations AS evaluation
  WHERE evaluation.id = _request_id
    AND evaluation.owner_id = _owner_id;
  IF FOUND THEN
    IF _existing.recurrence_id IS DISTINCT FROM _recurrence_id
      OR _existing.through_date IS DISTINCT FROM _through_date THEN
      RAISE EXCEPTION
        'The request identifier belongs to a different recurrence evaluation'
        USING ERRCODE = '23505';
    END IF;
    RETURN _existing.result || jsonb_build_object(
      'outcome', 'already_applied'
    );
  END IF;

  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.id = _recurrence_id
    AND definition.owner_id = _owner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The recurrence definition is unavailable'
      USING ERRCODE = '22023';
  END IF;
  SELECT revision.* INTO _revision
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.recurrence_id = _definition.id
    AND revision.revision = _definition.current_revision;

  _next_candidate := _definition.next_occurrence_date;

  IF _definition.status = 'active'
    AND _definition.next_occurrence_date IS NOT NULL THEN
    IF _revision.rule_mode = 'calendar' THEN
      _next_candidate := _definition.next_occurrence_date;
      WHILE _next_candidate IS NOT NULL AND _next_candidate <= _through_date LOOP
        IF _revision.missed_policy = 'all' THEN
          _selected_dates := array_append(_selected_dates, _next_candidate);
          IF cardinality(_selected_dates) > _revision.catch_up_limit THEN
            RAISE EXCEPTION 'Recurrence catch-up exceeds its safety limit'
              USING ERRCODE = '54000';
          END IF;
        ELSIF _revision.missed_policy = 'latest' THEN
          _selected_dates := ARRAY[_next_candidate];
        ELSIF _next_candidate = _through_date THEN
          _selected_dates := ARRAY[_next_candidate];
        END IF;
        _next_candidate := tasks_private.recurrence_next_date_after(
          _revision, _next_candidate
        );
        _loop_count := _loop_count + 1;
        IF _loop_count > 100000 THEN
          RAISE EXCEPTION 'Recurrence evaluation range is too large'
            USING ERRCODE = '54000';
        END IF;
      END LOOP;
      FOREACH _candidate IN ARRAY _selected_dates LOOP
        _occurrence := tasks_private.instantiate_recurrence_occurrence(
          _owner_id, _definition, _revision, _candidate,
          'calendar:' || _candidate::text, NULL, _entry_channel, _actor_type
        );
        _occurrence_ids := _occurrence_ids || jsonb_build_array(_occurrence.id);
      END LOOP;
    ELSIF _definition.next_occurrence_date <= _through_date THEN
      SELECT occurrence.id INTO _predecessor_id
      FROM public.tasks_recurrence_occurrences AS occurrence
      WHERE occurrence.owner_id = _owner_id
        AND occurrence.recurrence_id = _definition.id
      ORDER BY occurrence.generated_at DESC, occurrence.id DESC
      LIMIT 1;
      _occurrence := tasks_private.instantiate_recurrence_occurrence(
        _owner_id, _definition, _revision,
        _definition.next_occurrence_date,
        'after:' || COALESCE(_predecessor_id::text, 'initial'),
        _predecessor_id, _entry_channel, _actor_type
      );
      _occurrence_ids := jsonb_build_array(_occurrence.id);
      _next_candidate := NULL;
    END IF;
  END IF;

  UPDATE public.tasks_recurrence_definitions
  SET next_occurrence_date = _next_candidate,
      evaluated_through_date = greatest(
        COALESCE(evaluated_through_date, _through_date), _through_date
      ),
      record_revision = record_revision + 1,
      last_mutation_channel = _entry_channel,
      last_actor_type = _actor_type,
      client_mutation_id = _request_id,
      updated_at = clock_timestamp()
  WHERE id = _definition.id AND owner_id = _owner_id
  RETURNING * INTO _definition;

  _result := jsonb_build_object(
    'outcome', 'accepted',
    'status', _definition.status,
    'through_date', _through_date,
    'generated_count', jsonb_array_length(_occurrence_ids),
    'occurrence_ids', _occurrence_ids,
    'definition', to_jsonb(_definition) - 'owner_id'
  );
  INSERT INTO public.tasks_recurrence_evaluations (
    id, owner_id, recurrence_id, through_date, result, client_mutation_id
  ) VALUES (
    _request_id, _owner_id, _definition.id, _through_date, _result, _request_id
  );
  RETURN _result;
END
$$;

REVOKE ALL ON FUNCTION public.tasks_evaluate_recurrence(
  uuid, date, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_evaluate_recurrence(
  uuid, date, uuid, text, text
) TO authenticated;
