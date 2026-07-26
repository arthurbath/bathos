-- Reset unfinished prior-day Today tasks to Inbox before activating future
-- Starts that reach the new owner-local planning date.

CREATE TABLE tasks_private.today_rollover_state (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  planning_date date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

REVOKE ALL ON TABLE tasks_private.today_rollover_state
FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO tasks_private.today_rollover_state (
  owner_id,
  planning_date,
  updated_at
)
SELECT
  settings.owner_id,
  (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date,
  clock_timestamp()
FROM public.tasks_user_settings AS settings
ON CONFLICT (owner_id) DO NOTHING;

CREATE OR REPLACE FUNCTION tasks_private.initialize_today_rollover_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO tasks_private.today_rollover_state (
    owner_id,
    planning_date,
    updated_at
  ) VALUES (
    NEW.owner_id,
    (clock_timestamp() AT TIME ZONE NEW.planning_timezone)::date,
    clock_timestamp()
  )
  ON CONFLICT (owner_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.initialize_today_rollover_state()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER tasks_user_settings_initialize_today_rollover_state
AFTER INSERT ON public.tasks_user_settings
FOR EACH ROW
EXECUTE FUNCTION tasks_private.initialize_today_rollover_state();

CREATE OR REPLACE FUNCTION tasks_private.rebind_root_reminder_to_start_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _reminder public.tasks_reminders;
  _effective_date date;
  _resolved_at timestamptz;
  _resolution_kind text;
  _mutation_id uuid;
  _automatic_activation boolean := COALESCE(
    current_setting('garden.bath.tasks_activation', true), ''
  ) = 'on';
  _automatic_rollover boolean := COALESCE(
    current_setting('garden.bath.tasks_rollover', true), ''
  ) = 'on';
BEGIN
  IF NEW.start_date IS NOT DISTINCT FROM OLD.start_date
    AND NEW.today_section IS NOT DISTINCT FROM OLD.today_section THEN
    RETURN NEW;
  END IF;

  -- Daily horizon reset is a planning prompt, not a new reminder request.
  -- Retain the original reminder date, occurrence, and delivery state.
  IF _automatic_rollover THEN
    RETURN NEW;
  END IF;

  _effective_date := tasks_private.root_effective_reminder_date(
    NEW.owner_id,
    CASE WHEN TG_TABLE_NAME = 'tasks_todos' THEN 'todo' ELSE 'project' END,
    NEW.id
  );
  IF _automatic_activation
    AND OLD.start_date IS NOT NULL
    AND NEW.start_date IS NULL
    AND NEW.today_section IS NOT NULL THEN
    _effective_date := OLD.start_date;
  END IF;

  FOR _reminder IN
    SELECT reminder.*
    FROM public.tasks_reminders AS reminder
    WHERE reminder.owner_id = NEW.owner_id
      AND reminder.status = 'active'
      AND (
        (TG_TABLE_NAME = 'tasks_todos' AND reminder.task_id = NEW.id)
        OR (TG_TABLE_NAME = 'tasks_projects' AND reminder.project_id = NEW.id)
      )
    FOR UPDATE
  LOOP
    IF _effective_date IS NOT NULL
      AND _effective_date = _reminder.local_date THEN
      CONTINUE;
    END IF;

    _mutation_id := gen_random_uuid();
    UPDATE public.tasks_reminder_occurrences
    SET status = 'canceled'
    WHERE owner_id = NEW.owner_id
      AND reminder_id = _reminder.id
      AND status = 'scheduled';

    UPDATE public.tasks_reminder_deliveries AS delivery
    SET status = 'canceled', updated_at = clock_timestamp()
    FROM public.tasks_reminder_occurrences AS occurrence
    WHERE occurrence.id = delivery.occurrence_id
      AND occurrence.owner_id = delivery.owner_id
      AND occurrence.owner_id = NEW.owner_id
      AND occurrence.reminder_id = _reminder.id
      AND delivery.status NOT IN ('acknowledged', 'canceled');

    IF _effective_date IS NULL THEN
      UPDATE public.tasks_reminders
      SET status = 'canceled',
          record_revision = record_revision + 1,
          last_mutation_channel = NEW.last_mutation_channel,
          last_actor_type = 'system',
          client_mutation_id = _mutation_id,
          updated_at = clock_timestamp()
      WHERE id = _reminder.id AND owner_id = NEW.owner_id;
      CONTINUE;
    END IF;

    SELECT resolution.resolved_at, resolution.resolution_kind
    INTO _resolved_at, _resolution_kind
    FROM tasks_private.resolve_reminder_instant(
      _effective_date,
      _reminder.local_time,
      _reminder.time_zone,
      _reminder.ambiguity_choice
    ) AS resolution;

    UPDATE public.tasks_reminders
    SET local_date = _effective_date,
        resolved_at = _resolved_at,
        resolution_kind = _resolution_kind,
        record_revision = record_revision + 1,
        last_mutation_channel = NEW.last_mutation_channel,
        last_actor_type = 'system',
        client_mutation_id = _mutation_id,
        updated_at = clock_timestamp()
    WHERE id = _reminder.id AND owner_id = NEW.owner_id
    RETURNING * INTO _reminder;

    INSERT INTO public.tasks_reminder_occurrences (
      owner_id, reminder_id, reminder_revision, resolved_at, client_mutation_id
    ) VALUES (
      NEW.owner_id, _reminder.id, _reminder.record_revision,
      _reminder.resolved_at, _mutation_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.rebind_root_reminder_to_start_date()
FROM PUBLIC, anon, authenticated, service_role;

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
      today_section = 'next',
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
