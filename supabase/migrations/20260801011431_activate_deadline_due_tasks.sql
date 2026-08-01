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
  _task record;
  _planning_date date;
  _planning_midnight timestamptz;
  _last_rollover_date date;
  _next_order_key text;
  _rollover_count integer := 0;
  _owner_rollover_count integer := 0;
  _todo_count integer := 0;
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

    IF _planning_date > _last_rollover_date THEN
      PERFORM set_config('garden.bath.tasks_rollover', 'on', true);
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
        task.order_key,
        task.id
      FOR UPDATE
    LOOP
      _next_order_key := CASE
        WHEN _next_order_key IS NULL THEN 'a0'
        ELSE tasks_private.next_task_order_key(_next_order_key)
      END;
      UPDATE public.tasks_todos AS task
      SET start_date = NULL,
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
    'evaluated_at', _now
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.activate_due_roots(timestamptz, uuid)
FROM PUBLIC, anon, authenticated, service_role;
