-- Spawn recurring work from its projected Start date, not only from the later
-- cadence date used as a repeating Deadline. The existing owner-local minute
-- activation job becomes authoritative for recurrence generation.

CREATE OR REPLACE FUNCTION tasks_private.recurrence_spawn_date(
  _scheduled_date date,
  _deadline_offset_days integer
)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN _scheduled_date IS NULL THEN NULL
    WHEN _deadline_offset_days IS NULL THEN _scheduled_date
    ELSE _scheduled_date - _deadline_offset_days
  END
$$;

REVOKE ALL ON FUNCTION tasks_private.recurrence_spawn_date(
  date, integer
) FROM PUBLIC, anon, authenticated, service_role;

-- Generated reached instances retain their projected Start alongside Today
-- Inbox. The planning trigger permits this dual system state only while the
-- authoritative activation context is enabled.
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

CREATE OR REPLACE FUNCTION tasks_private.evaluate_recurrence_for_owner(
  _owner_id uuid,
  _recurrence_id uuid,
  _through_date date,
  _request_id uuid,
  _entry_channel text,
  _actor_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _definition public.tasks_recurrence_definitions;
  _revision public.tasks_recurrence_revisions;
  _existing public.tasks_recurrence_evaluations;
  _occurrence public.tasks_recurrence_occurrences;
  _candidate date;
  _next_candidate date;
  _selected_dates date[] := ARRAY[]::date[];
  _occurrence_ids jsonb := '[]'::jsonb;
  _result jsonb;
  _predecessor_id uuid;
  _loop_count integer := 0;
  _prior_activation text := current_setting(
    'garden.bath.tasks_activation', true
  );
  _prior_auth_sub text := current_setting('request.jwt.claim.sub', true);
  _supplied_system_identity boolean := false;
BEGIN
  IF _owner_id IS NULL OR _through_date IS NULL OR _request_id IS NULL THEN
    RAISE EXCEPTION 'Recurrence evaluation input is invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _recurrence_id::text, 0)
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The recurrence revision is unavailable'
      USING ERRCODE = '22023';
  END IF;

  IF auth.uid() IS NULL THEN
    PERFORM set_config('request.jwt.claim.sub', _owner_id::text, true);
    _supplied_system_identity := true;
  END IF;
  PERFORM set_config('garden.bath.tasks_activation', 'on', true);
  _next_candidate := _definition.next_occurrence_date;

  IF _definition.status = 'active'
    AND _definition.next_occurrence_date IS NOT NULL THEN
    IF _revision.rule_mode = 'calendar' THEN
      _next_candidate := _definition.next_occurrence_date;
      WHILE _next_candidate IS NOT NULL
        AND tasks_private.recurrence_spawn_date(
          _next_candidate, _revision.deadline_offset_days
        ) <= _through_date LOOP
        IF _revision.missed_policy = 'all' THEN
          _selected_dates := array_append(_selected_dates, _next_candidate);
          IF cardinality(_selected_dates) > _revision.catch_up_limit THEN
            RAISE EXCEPTION 'Recurrence catch-up exceeds its safety limit'
              USING ERRCODE = '54000';
          END IF;
        ELSIF _revision.missed_policy = 'latest' THEN
          _selected_dates := ARRAY[_next_candidate];
        ELSIF tasks_private.recurrence_spawn_date(
          _next_candidate, _revision.deadline_offset_days
        ) = _through_date THEN
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
    ELSIF tasks_private.recurrence_spawn_date(
      _definition.next_occurrence_date, _revision.deadline_offset_days
    ) <= _through_date THEN
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
  PERFORM set_config(
    'garden.bath.tasks_activation',
    COALESCE(NULLIF(_prior_activation, ''), 'off'),
    true
  );
  IF _supplied_system_identity THEN
    PERFORM set_config(
      'request.jwt.claim.sub', COALESCE(_prior_auth_sub, ''), true
    );
  END IF;
  RETURN _result;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.evaluate_recurrence_for_owner(
  uuid, uuid, date, uuid, text, text
) FROM PUBLIC, anon, authenticated, service_role;

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
  _planning_date date;
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

  RETURN tasks_private.evaluate_recurrence_for_owner(
    _owner_id, _recurrence_id, _through_date, _request_id,
    _entry_channel, _actor_type
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_evaluate_recurrence(
  uuid, date, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_evaluate_recurrence(
  uuid, date, uuid, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.activate_due_roots(
  _now timestamptz DEFAULT clock_timestamp(),
  _owner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _settings record;
  _recurrence record;
  _recurrence_result jsonb;
  _task record;
  _planning_date date;
  _planning_midnight timestamptz;
  _last_rollover_date date;
  _next_order_key text;
  _rollover_count integer := 0;
  _owner_rollover_count integer := 0;
  _todo_count integer := 0;
  _recurrence_count integer := 0;
BEGIN
  PERFORM set_config('garden.bath.tasks_activation', 'on', true);
  FOR _settings IN
    SELECT settings.owner_id, settings.planning_timezone
    FROM public.tasks_user_settings AS settings
    WHERE _owner_id IS NULL OR settings.owner_id = _owner_id
    ORDER BY settings.owner_id
  LOOP
    _planning_date := (_now AT TIME ZONE _settings.planning_timezone)::date;
    _planning_midnight := (
      _planning_date::timestamp AT TIME ZONE _settings.planning_timezone
    );
    INSERT INTO tasks_private.today_rollover_state (
      owner_id, planning_date, updated_at
    ) VALUES (
      _settings.owner_id, _planning_date, _now
    ) ON CONFLICT (owner_id) DO NOTHING;
    SELECT state.planning_date
    INTO _last_rollover_date
    FROM tasks_private.today_rollover_state AS state
    WHERE state.owner_id = _settings.owner_id
    FOR UPDATE;

    IF _planning_date > _last_rollover_date THEN
      PERFORM set_config('garden.bath.tasks_rollover', 'on', true);
      SELECT task.order_key
      INTO _next_order_key
      FROM public.tasks_todos AS task
      WHERE task.owner_id = _settings.owner_id
        AND task.destination = 'anytime'
        AND task.lifecycle = 'open'
        AND task.disposition = 'present'
        AND task.start_date IS NULL
        AND task.today_section = 'inbox'
      ORDER BY task.order_key DESC, task.id DESC
      LIMIT 1;
      FOR _task IN
        SELECT task.id
        FROM public.tasks_todos AS task
        WHERE task.owner_id = _settings.owner_id
          AND task.destination = 'anytime'
          AND task.lifecycle = 'open'
          AND task.disposition = 'present'
          AND task.start_date IS NULL
          AND task.today_section IS NOT NULL
          AND task.today_section IS DISTINCT FROM 'inbox'
          AND task.updated_at < _planning_midnight
        ORDER BY
          CASE task.today_section
            WHEN 'now' THEN 1
            WHEN 'next' THEN 2
            WHEN 'later' THEN 3
            ELSE 4
          END,
          task.order_key,
          task.id
        FOR UPDATE
      LOOP
        _next_order_key := CASE
          WHEN _next_order_key IS NULL THEN 'a0'
          ELSE tasks_private.next_task_order_key(_next_order_key)
        END;
        UPDATE public.tasks_todos AS task
        SET today_section = 'inbox',
            order_key = _next_order_key,
            revision = task.revision + 1,
            client_mutation_id = gen_random_uuid(),
            last_mutation_channel = 'native',
            last_actor_type = 'system',
            undo_source_event_id = NULL,
            updated_at = _now
        WHERE task.id = _task.id;
        _rollover_count := _rollover_count + 1;
      END LOOP;
      PERFORM set_config('garden.bath.tasks_rollover', 'off', true);
      UPDATE tasks_private.today_rollover_state
      SET planning_date = _planning_date, updated_at = _now
      WHERE owner_id = _settings.owner_id;
      _owner_rollover_count := _owner_rollover_count + 1;
    END IF;

    FOR _recurrence IN
      SELECT definition.id
      FROM public.tasks_recurrence_definitions AS definition
      JOIN public.tasks_recurrence_revisions AS revision
        ON revision.owner_id = definition.owner_id
       AND revision.recurrence_id = definition.id
       AND revision.revision = definition.current_revision
      WHERE definition.owner_id = _settings.owner_id
        AND definition.status = 'active'
        AND definition.next_occurrence_date IS NOT NULL
        AND tasks_private.recurrence_spawn_date(
          definition.next_occurrence_date, revision.deadline_offset_days
        ) <= _planning_date
      ORDER BY
        tasks_private.recurrence_spawn_date(
          definition.next_occurrence_date, revision.deadline_offset_days
        ),
        definition.upcoming_order_key,
        definition.id
    LOOP
      _recurrence_result := tasks_private.evaluate_recurrence_for_owner(
        _settings.owner_id, _recurrence.id, _planning_date,
        gen_random_uuid(), 'native', 'system'
      );
      _recurrence_count := _recurrence_count + COALESCE(
        (_recurrence_result ->> 'generated_count')::integer, 0
      );
    END LOOP;

    SELECT task.order_key
    INTO _next_order_key
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _settings.owner_id
      AND task.destination = 'anytime'
      AND task.lifecycle = 'open'
      AND task.disposition = 'present'
      AND task.today_section = 'inbox'
    ORDER BY task.order_key DESC, task.id DESC
    LIMIT 1;

    FOR _task IN
      SELECT task.id
      FROM public.tasks_todos AS task
      WHERE task.owner_id = _settings.owner_id
        AND task.destination = 'anytime'
        AND task.lifecycle = 'open'
        AND task.disposition = 'present'
        AND (
          (
            task.start_date IS NOT NULL
            AND task.start_date <= _planning_date
            AND task.today_section IS NULL
          )
          OR (
            task.start_date IS NULL
            AND task.today_section IS NULL
            AND task.deadline IS NOT NULL
            AND task.deadline <= _planning_date
          )
        )
      ORDER BY
        COALESCE(task.start_date, task.deadline),
        COALESCE(task.upcoming_order_key, task.order_key),
        task.id
      FOR UPDATE
    LOOP
      _next_order_key := CASE
        WHEN _next_order_key IS NULL THEN 'a0'
        ELSE tasks_private.next_task_order_key(_next_order_key)
      END;
      UPDATE public.tasks_todos AS task
      SET start_date = CASE
            WHEN task.start_date IS NULL THEN _planning_date
            ELSE NULL
          END,
          today_section = 'inbox',
          order_key = _next_order_key,
          revision = task.revision + 1,
          client_mutation_id = gen_random_uuid(),
          last_mutation_channel = 'native',
          last_actor_type = 'system',
          undo_source_event_id = NULL,
          updated_at = _now
      WHERE task.id = _task.id;
      _todo_count := _todo_count + 1;
    END LOOP;
  END LOOP;
  PERFORM set_config('garden.bath.tasks_activation', 'off', true);
  RETURN jsonb_build_object(
    'rolled_over_todos', _rollover_count,
    'rolled_over_owners', _owner_rollover_count,
    'activated_todos', _todo_count,
    'generated_recurrence_instances', _recurrence_count,
    'evaluated_at', _now
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.activate_due_roots(timestamptz, uuid)
FROM PUBLIC, anon, authenticated, service_role;

-- Repair due production definitions through the same idempotent path used by
-- the minute activation job.
SELECT tasks_private.activate_due_roots(clock_timestamp(), NULL);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tasks_recurrence_definitions AS definition
    JOIN public.tasks_recurrence_revisions AS recurrence_revision
      ON recurrence_revision.owner_id = definition.owner_id
     AND recurrence_revision.recurrence_id = definition.id
     AND recurrence_revision.revision = definition.current_revision
    JOIN public.tasks_user_settings AS settings
      ON settings.owner_id = definition.owner_id
    WHERE definition.status = 'active'
      AND definition.next_occurrence_date IS NOT NULL
      AND tasks_private.recurrence_spawn_date(
        definition.next_occurrence_date,
        recurrence_revision.deadline_offset_days
      ) <= (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date
  ) THEN
    RAISE EXCEPTION 'Due recurrence prototypes remain after activation';
  END IF;
END
$$;
