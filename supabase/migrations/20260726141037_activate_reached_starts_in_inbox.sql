-- Newly reached task Starts join the new day's Inbox for deliberate re-planning.
-- This migration replaces executable policy only and performs no immediate
-- task-row rewrite.

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
  _planning_date date;
  _planning_midnight timestamptz;
  _last_rollover_date date;
  _rollover_count integer := 0;
  _owner_rollover_count integer := 0;
  _todo_count integer := 0;
  _project_count integer := 0;
  _changed_count integer := 0;
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
      owner_id,
      planning_date,
      updated_at
    ) VALUES (
      _settings.owner_id,
      _planning_date,
      _now
    )
    ON CONFLICT (owner_id) DO NOTHING;

    SELECT state.planning_date
    INTO _last_rollover_date
    FROM tasks_private.today_rollover_state AS state
    WHERE state.owner_id = _settings.owner_id
    FOR UPDATE;

    IF _planning_date > _last_rollover_date THEN
      PERFORM set_config('garden.bath.tasks_rollover', 'on', true);

      UPDATE public.tasks_todos AS task
      SET today_section = 'inbox',
          revision = task.revision + 1,
          client_mutation_id = gen_random_uuid(),
          last_mutation_channel = 'native',
          last_actor_type = 'system',
          undo_source_event_id = NULL,
          updated_at = _now
      WHERE task.owner_id = _settings.owner_id
        AND task.destination = 'anytime'
        AND task.lifecycle = 'open'
        AND task.disposition = 'present'
        AND task.start_date IS NULL
        AND task.today_section IS NOT NULL
        AND task.today_section IS DISTINCT FROM 'inbox'
        AND task.updated_at < _planning_midnight;
      GET DIAGNOSTICS _changed_count = ROW_COUNT;
      _rollover_count := _rollover_count + _changed_count;

      PERFORM set_config('garden.bath.tasks_rollover', 'off', true);

      UPDATE tasks_private.today_rollover_state
      SET planning_date = _planning_date,
          updated_at = _now
      WHERE owner_id = _settings.owner_id;
      _owner_rollover_count := _owner_rollover_count + 1;
    END IF;
  END LOOP;

  UPDATE public.tasks_todos AS task
  SET start_date = NULL,
      today_section = 'inbox',
      revision = task.revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = 'native',
      last_actor_type = 'system',
      undo_source_event_id = NULL,
      updated_at = _now
  FROM public.tasks_user_settings AS settings
  WHERE settings.owner_id = task.owner_id
    AND (_owner_id IS NULL OR task.owner_id = _owner_id)
    AND task.destination = 'anytime'
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
    AND task.start_date IS NOT NULL
    AND task.start_date <= (_now AT TIME ZONE settings.planning_timezone)::date;
  GET DIAGNOSTICS _todo_count = ROW_COUNT;

  UPDATE public.tasks_projects AS project
  SET start_date = NULL,
      today_section = 'next',
      revision = project.revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = 'native',
      last_actor_type = 'system',
      updated_at = _now
  FROM public.tasks_user_settings AS settings
  WHERE settings.owner_id = project.owner_id
    AND (_owner_id IS NULL OR project.owner_id = _owner_id)
    AND project.destination = 'anytime'
    AND project.lifecycle = 'open'
    AND project.disposition = 'present'
    AND project.start_date IS NOT NULL
    AND project.start_date <= (_now AT TIME ZONE settings.planning_timezone)::date;
  GET DIAGNOSTICS _project_count = ROW_COUNT;

  PERFORM set_config('garden.bath.tasks_activation', 'off', true);
  RETURN jsonb_build_object(
    'rolled_over_todos', _rollover_count,
    'rolled_over_owners', _owner_rollover_count,
    'activated_todos', _todo_count,
    'activated_projects', _project_count,
    'evaluated_at', _now
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.activate_due_roots(timestamptz, uuid)
FROM PUBLIC, anon, authenticated, service_role;
