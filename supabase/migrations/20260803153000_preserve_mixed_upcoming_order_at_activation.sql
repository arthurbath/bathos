-- Preserve the deliberate Upcoming order when a reached date promotes a mix
-- of ordinary tasks and newly generated recurrence instances into Today.

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
  _generated_task_ids uuid[] := ARRAY[]::uuid[];
  _new_generated_task_ids uuid[];
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
    _generated_task_ids := ARRAY[]::uuid[];
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
        AND NOT (
          task.last_actor_type = 'system'
          AND task.last_mutation_channel = 'native'
          AND task.updated_at >= _planning_midnight
        )
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
            last_actor_type = 'automation',
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

      SELECT COALESCE(
        array_agg(occurrence.root_id ORDER BY occurrence.id),
        ARRAY[]::uuid[]
      )
      INTO _new_generated_task_ids
      FROM public.tasks_recurrence_occurrences AS occurrence
      JOIN jsonb_array_elements_text(
        COALESCE(_recurrence_result -> 'occurrence_ids', '[]'::jsonb)
      ) AS generated(occurrence_id)
        ON occurrence.id = generated.occurrence_id::uuid
      WHERE occurrence.owner_id = _settings.owner_id
        AND occurrence.root_type = 'todo';

      _generated_task_ids := _generated_task_ids || _new_generated_task_ids;
    END LOOP;

    -- Existing and rolled-over Inbox tasks retain their relative placement.
    -- Newly generated recurrence roots are excluded because they still carry
    -- prototype order keys and must be ranked with the ordinary reached tasks.
    SELECT task.order_key
    INTO _next_order_key
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _settings.owner_id
      AND task.destination = 'anytime'
      AND task.lifecycle = 'open'
      AND task.disposition = 'present'
      AND task.today_section = 'inbox'
      AND NOT (task.id = ANY(_generated_task_ids))
      AND NOT (
        task.last_actor_type = 'system'
        AND task.last_mutation_channel = 'native'
        AND task.updated_at >= _planning_midnight
      )
    ORDER BY task.order_key DESC, task.id DESC
    LIMIT 1;

    FOR _task IN
      SELECT
        task.id,
        task.id = ANY(_generated_task_ids) AS generated_recurrence,
        (
          task.today_section = 'inbox'
          AND task.last_actor_type = 'system'
          AND task.last_mutation_channel = 'native'
          AND task.updated_at >= _planning_midnight
        ) AS locally_activated
      FROM public.tasks_todos AS task
      WHERE task.owner_id = _settings.owner_id
        AND task.destination = 'anytime'
        AND task.lifecycle = 'open'
        AND task.disposition = 'present'
        AND (
          task.id = ANY(_generated_task_ids)
          OR (
            task.today_section = 'inbox'
            AND task.last_actor_type = 'system'
            AND task.last_mutation_channel = 'native'
            AND task.updated_at >= _planning_midnight
          )
          OR (
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
        COALESCE(task.start_date, task.deadline, _planning_date),
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
            WHEN _task.generated_recurrence OR _task.locally_activated
              THEN task.start_date
            WHEN task.start_date IS NULL THEN _planning_date
            ELSE NULL
          END,
          today_section = 'inbox',
          order_key = _next_order_key,
          revision = task.revision + 1,
          client_mutation_id = gen_random_uuid(),
          last_mutation_channel = 'native',
          last_actor_type = 'automation',
          undo_source_event_id = NULL,
          updated_at = _now
      WHERE task.id = _task.id;
      IF NOT _task.generated_recurrence THEN
        _todo_count := _todo_count + 1;
      END IF;
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
