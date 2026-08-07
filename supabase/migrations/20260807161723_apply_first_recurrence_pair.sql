-- Make the first accepted Start/Deadline pair authoritative for both v2 entry
-- points. Creation adopts the source task instead of deleting it, while an
-- edit whose Start has reached today materializes that occurrence before the
-- save transaction returns.

CREATE OR REPLACE FUNCTION public.tasks_create_recurrence_from_task_v2(
  _task_id uuid,
  _rule_mode text,
  _frequency text,
  _interval_count integer,
  _next_start_date date,
  _date_basis text,
  _rule_config jsonb,
  _end_mode text,
  _end_after_count integer,
  _end_on_date date,
  _reminder_local_time time,
  _deadline_after_start_days integer,
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
  _planning_timezone text;
  _planning_date date;
  _snapshot jsonb;
  _anchor date;
  _first_start date;
  _first_deadline date;
  _legacy_offset integer;
  _logical_key text;
  _prior_activation text := current_setting(
    'garden.bath.tasks_activation', true
  );
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _task_id IS NULL OR _mutation_id IS NULL
    OR _date_basis NOT IN ('start', 'deadline')
    OR _next_start_date IS NULL
    OR _rule_mode NOT IN ('calendar', 'after_completion')
    OR _frequency NOT IN ('daily', 'weekly', 'monthly', 'yearly')
    OR _interval_count NOT BETWEEN 1 AND 1000
    OR COALESCE(_deadline_after_start_days, 0) < 0
    OR (_date_basis = 'deadline' AND _deadline_after_start_days IS NULL)
    OR NOT tasks_private.recurrence_rule_config_v2_is_valid(
      _frequency, _rule_config
    )
    OR _end_mode NOT IN ('never', 'after', 'on_date')
    OR (_end_mode = 'after' AND COALESCE(_end_after_count, 0) < 1)
    OR (_end_mode = 'on_date' AND _end_on_date IS NULL) THEN
    RAISE EXCEPTION 'Version 2 recurrence input is invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT settings.planning_timezone,
    (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date
  INTO _planning_timezone, _planning_date
  FROM public.tasks_user_settings AS settings
  WHERE settings.owner_id = _owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task planning settings are unavailable'
      USING ERRCODE = '22023';
  END IF;
  IF _next_start_date < _planning_date THEN
    RAISE EXCEPTION 'The first recurrence Start cannot be in the past'
      USING ERRCODE = '22023';
  END IF;

  _anchor := CASE WHEN _date_basis = 'deadline'
    THEN _next_start_date + _deadline_after_start_days
    ELSE _next_start_date
  END;
  _first_start := _next_start_date;
  _first_deadline := CASE WHEN _deadline_after_start_days IS NULL
    THEN NULL ELSE _next_start_date + _deadline_after_start_days
  END;
  _legacy_offset := CASE WHEN _date_basis = 'deadline'
    THEN _deadline_after_start_days ELSE NULL
  END;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _mutation_id::text, 0)
  );
  SELECT occurrence.* INTO _occurrence
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.client_mutation_id = _mutation_id;
  IF FOUND THEN
    SELECT definition.* INTO _definition
    FROM public.tasks_recurrence_definitions AS definition
    WHERE definition.owner_id = _owner_id
      AND definition.id = _occurrence.recurrence_id;
    SELECT revision.* INTO _revision
    FROM public.tasks_recurrence_revisions AS revision
    WHERE revision.owner_id = _owner_id
      AND revision.recurrence_id = _definition.id
      AND revision.revision = _occurrence.recurrence_revision;
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'definition', to_jsonb(_definition) - 'owner_id',
      'revision', to_jsonb(_revision) - 'owner_id',
      'occurrence', to_jsonb(_occurrence) - 'owner_id'
    );
  END IF;

  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id
    AND task.id = _task_id
    AND task.disposition = 'present'
    AND task.lifecycle = 'open'
    AND task.recurrence_definition_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The task is unavailable for recurrence'
      USING ERRCODE = '22023';
  END IF;

  _snapshot := tasks_private.recurrence_snapshot_from_todo(
    _owner_id, _task_id, _anchor
  );
  _snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(_snapshot, '{root,destination}', '"anytime"'::jsonb),
      '{root,today_section}', 'null'::jsonb
    ),
    '{root,start_offset_days}',
    to_jsonb(_first_start - _anchor)
  );
  _snapshot := jsonb_set(
    _snapshot,
    '{root,deadline_offset_days}',
    CASE WHEN _first_deadline IS NULL THEN 'null'::jsonb
      ELSE to_jsonb(_first_deadline - _anchor)
    END
  );

  PERFORM set_config('garden.bath.tasks_recurrence_v2', 'on', true);
  PERFORM set_config(
    'garden.bath.tasks_recurrence_date_basis', _date_basis, true
  );
  PERFORM set_config(
    'garden.bath.tasks_recurrence_deadline_days',
    COALESCE(_deadline_after_start_days::text, ''),
    true
  );

  INSERT INTO public.tasks_recurrence_definitions (
    owner_id, name, status, current_revision, record_revision,
    evaluated_through_date, next_occurrence_date, upcoming_order_key,
    last_mutation_channel, last_actor_type, client_mutation_id,
    created_at, updated_at
  ) VALUES (
    _owner_id, _task.title, 'active', 1, 1,
    _planning_date, NULL,
    COALESCE(_task.upcoming_order_key, _task.order_key, 'a0'),
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
    _owner_id, _definition.id, 1, _task.title,
    _rule_mode, _frequency, _interval_count, _anchor, _planning_timezone,
    'latest', 100, _task.area_id, _mutation_id, clock_timestamp(),
    _rule_config, _end_mode,
    CASE WHEN _end_mode = 'after' THEN _end_after_count ELSE NULL END,
    CASE WHEN _end_mode = 'on_date' THEN _end_on_date ELSE NULL END,
    _reminder_local_time, _legacy_offset, _snapshot
  ) RETURNING * INTO _revision;

  _logical_key := CASE WHEN _rule_mode = 'calendar'
    THEN 'calendar:' || _anchor::text
    ELSE 'initial:' || _anchor::text
  END;
  INSERT INTO public.tasks_recurrence_occurrences (
    owner_id, recurrence_id, recurrence_revision, logical_key,
    scheduled_date, predecessor_occurrence_id,
    root_type, root_id, client_mutation_id, generated_at, origin
  ) VALUES (
    _owner_id, _definition.id, 1, _logical_key,
    _anchor, NULL, 'todo', _task_id, _mutation_id,
    clock_timestamp(), 'adopted'
  ) RETURNING * INTO _occurrence;

  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (pg_backend_pid(), txid_current(), _owner_id)
  ON CONFLICT DO NOTHING;
  PERFORM set_config('garden.bath.tasks_activation', 'on', true);
  UPDATE public.tasks_todos
  SET destination = 'anytime',
      start_date = _first_start,
      deadline = _first_deadline,
      today_section = CASE WHEN _first_start <= _planning_date
        THEN 'inbox' ELSE NULL
      END,
      recurrence_definition_id = _definition.id,
      recurrence_revision = 1,
      recurrence_occurrence_id = _occurrence.id,
      recurrence_logical_key = _logical_key,
      revision = revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type,
      updated_at = clock_timestamp()
  WHERE id = _task_id AND owner_id = _owner_id;
  PERFORM set_config(
    'garden.bath.tasks_activation',
    COALESCE(NULLIF(_prior_activation, ''), 'off'),
    true
  );
  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  IF _reminder_local_time IS NOT NULL THEN
    PERFORM public.tasks_save_start_reminder(
      NULL, NULL, 'todo', _task_id,
      to_char(_reminder_local_time, 'HH24:MI'),
      _planning_timezone, 'earlier', gen_random_uuid(),
      _mutation_channel, _actor_type
    );
  END IF;

  UPDATE public.tasks_recurrence_definitions
  SET next_occurrence_date = CASE WHEN _rule_mode = 'calendar'
        THEN tasks_private.recurrence_next_date_after(_revision, _anchor)
        ELSE NULL
      END,
      record_revision = record_revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type,
      updated_at = clock_timestamp()
  WHERE id = _definition.id AND owner_id = _owner_id
  RETURNING * INTO _definition;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'definition', to_jsonb(_definition) - 'owner_id',
    'revision', to_jsonb(_revision) - 'owner_id',
    'occurrence', to_jsonb(_occurrence) - 'owner_id'
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_create_recurrence_from_task_v2(
  uuid, text, text, integer, date, text, jsonb, text, integer, date,
  time, integer, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_recurrence_from_task_v2(
  uuid, text, text, integer, date, text, jsonb, text, integer, date,
  time, integer, uuid, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_edit_recurrence_v2(
  _recurrence_id uuid,
  _expected_record_revision bigint,
  _rule_mode text,
  _frequency text,
  _interval_count integer,
  _next_start_date date,
  _date_basis text,
  _planning_timezone text,
  _missed_policy text,
  _catch_up_limit integer,
  _target_area_id uuid,
  _rule_config jsonb,
  _end_mode text,
  _end_after_count integer,
  _end_on_date date,
  _reminder_local_time time,
  _deadline_after_start_days integer,
  _prototype_snapshot jsonb,
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
  _definition public.tasks_recurrence_definitions;
  _current public.tasks_recurrence_revisions;
  _revision public.tasks_recurrence_revisions;
  _snapshot jsonb;
  _name text;
  _anchor date;
  _legacy_offset integer;
  _planning_date date;
  _result jsonb;
  _evaluation jsonb := NULL;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to edit recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _date_basis NOT IN ('start', 'deadline')
    OR _next_start_date IS NULL
    OR COALESCE(_deadline_after_start_days, 0) < 0
    OR (_date_basis = 'deadline' AND _deadline_after_start_days IS NULL)
    OR NOT tasks_private.recurrence_rule_config_v2_is_valid(
      _frequency, _rule_config
    ) THEN
    RAISE EXCEPTION 'Version 2 recurrence input is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names
    WHERE name = _planning_timezone
  ) THEN
    RAISE EXCEPTION 'The recurrence planning time zone is invalid'
      USING ERRCODE = '22023';
  END IF;
  _planning_date := (
    clock_timestamp() AT TIME ZONE _planning_timezone
  )::date;
  IF _next_start_date < _planning_date THEN
    RAISE EXCEPTION 'The next recurrence Start cannot be in the past'
      USING ERRCODE = '22023';
  END IF;

  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.owner_id = _owner_id AND definition.id = _recurrence_id;
  SELECT revision.* INTO _current
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.recurrence_id = _recurrence_id
    AND revision.revision = _definition.current_revision;
  _snapshot := tasks_private.normalize_recurrence_snapshot(
    COALESCE(_prototype_snapshot, _current.prototype_snapshot)
  );
  _name := NULLIF(btrim(_snapshot #>> '{root,title}'), '');
  IF _name IS NULL THEN _name := _definition.name; END IF;
  _anchor := CASE WHEN _date_basis = 'deadline'
    THEN _next_start_date + _deadline_after_start_days
    ELSE _next_start_date
  END;
  _legacy_offset := CASE WHEN _date_basis = 'deadline'
    THEN _deadline_after_start_days ELSE NULL
  END;

  PERFORM set_config('garden.bath.tasks_recurrence_v2', 'on', true);
  PERFORM set_config(
    'garden.bath.tasks_recurrence_date_basis', _date_basis, true
  );
  PERFORM set_config(
    'garden.bath.tasks_recurrence_deadline_days',
    COALESCE(_deadline_after_start_days::text, ''),
    true
  );
  _result := public.tasks_edit_recurrence(
    _recurrence_id, _expected_record_revision, _name, _rule_mode,
    _frequency, _interval_count, _anchor, _planning_timezone,
    _missed_policy, _catch_up_limit, _target_area_id, _rule_config,
    _end_mode, _end_after_count, _end_on_date, _reminder_local_time,
    _legacy_offset, _snapshot, _mutation_id, _mutation_channel, _actor_type
  );
  IF _result ->> 'outcome' = 'conflict' THEN RETURN _result; END IF;

  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.owner_id = _owner_id AND definition.id = _recurrence_id;
  SELECT revision.* INTO _revision
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.recurrence_id = _recurrence_id
    AND revision.revision = _definition.current_revision;

  IF _next_start_date = _planning_date THEN
    IF _rule_mode = 'calendar' THEN
      UPDATE public.tasks_recurrence_definitions
      SET next_occurrence_date = _anchor,
          record_revision = record_revision + 1,
          client_mutation_id = gen_random_uuid(),
          last_mutation_channel = _mutation_channel,
          last_actor_type = _actor_type,
          updated_at = clock_timestamp()
      WHERE owner_id = _owner_id AND id = _recurrence_id
      RETURNING * INTO _definition;
    END IF;
    IF _definition.next_occurrence_date IS NOT NULL
      AND tasks_private.recurrence_spawn_date(
        _definition.next_occurrence_date, _revision.deadline_offset_days
      ) <= _planning_date THEN
      _evaluation := tasks_private.evaluate_recurrence_for_owner(
        _owner_id, _recurrence_id, _planning_date, gen_random_uuid(),
        _mutation_channel, _actor_type
      );
      SELECT definition.* INTO _definition
      FROM public.tasks_recurrence_definitions AS definition
      WHERE definition.owner_id = _owner_id AND definition.id = _recurrence_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'outcome', _result ->> 'outcome',
    'definition', to_jsonb(_definition) - 'owner_id',
    'revision', to_jsonb(_revision) - 'owner_id',
    'generated_count', COALESCE(
      (_evaluation ->> 'generated_count')::integer, 0
    ),
    'occurrence_ids', COALESCE(
      _evaluation -> 'occurrence_ids', '[]'::jsonb
    )
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_edit_recurrence_v2(
  uuid, bigint, text, text, integer, date, text, text, text, integer,
  uuid, jsonb, text, integer, date, time, integer, jsonb, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_edit_recurrence_v2(
  uuid, bigint, text, text, integer, date, text, text, text, integer,
  uuid, jsonb, text, integer, date, time, integer, jsonb, uuid, text, text
) TO authenticated;
