-- Preserve explicit Primary Link clearing and let reminders follow either a
-- future Start Date or an active Today horizon.

CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_primary_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.primary_link := NULLIF(btrim(NEW.primary_link), '');
  IF TG_OP = 'INSERT'
    AND NEW.primary_link IS NULL
    AND NEW.entry_channel = 'mail_automation'
    AND NEW.source_kind = 'mail_message'
    AND NEW.source_url LIKE 'message://%' THEN
    NEW.primary_link := NEW.source_url;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_todo_primary_link()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.normalize_export_v12_record(
  _collection text,
  _record jsonb,
  _planning_date date
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _normalized jsonb := tasks_private.normalize_export_v12_record_start_dependent(
    _collection, _record, _planning_date
  );
  _start_date date;
  _horizon text;
  _primary_link text;
BEGIN
  IF _collection IN ('tasks_todos', 'tasks_projects') THEN
    _start_date := NULLIF(_normalized ->> 'start_date', '')::date;
    _horizon := _normalized ->> 'today_section';
    IF _normalized ->> 'destination' = 'someday' THEN
      _start_date := NULL;
      _horizon := NULL;
    ELSIF _start_date IS NOT NULL AND _start_date <= _planning_date THEN
      _start_date := NULL;
      _horizon := COALESCE(_horizon, 'next');
    ELSIF _start_date IS NOT NULL THEN
      _horizon := COALESCE(_horizon, 'next');
    END IF;
    _normalized := _normalized || jsonb_build_object(
      'start_date', to_jsonb(_start_date),
      'today_section', to_jsonb(_horizon)
    );
  END IF;
  IF _collection = 'tasks_todos' THEN
    IF _record ? 'primary_link' THEN
      _primary_link := NULLIF(btrim(_record ->> 'primary_link'), '');
    ELSIF (
      _normalized ->> 'source_url' LIKE 'message://%'
      OR _normalized ->> 'source_url' LIKE 'http://%'
      OR _normalized ->> 'source_url' LIKE 'https://%'
    ) THEN
      _primary_link := _normalized ->> 'source_url';
    END IF;
    _normalized := _normalized || jsonb_build_object('primary_link', to_jsonb(_primary_link));
  END IF;
  RETURN _normalized;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_export_v12_record(text, jsonb, date)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.root_effective_reminder_date(
  _owner_id uuid,
  _root_type text,
  _root_id uuid
)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _start_date date;
  _today_section text;
  _planning_date date;
BEGIN
  IF _root_type = 'todo' THEN
    SELECT task.start_date, task.today_section
    INTO _start_date, _today_section
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id
      AND task.id = _root_id
      AND task.disposition = 'present'
      AND task.lifecycle = 'open';
  ELSIF _root_type = 'project' THEN
    SELECT project.start_date, project.today_section
    INTO _start_date, _today_section
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id
      AND project.id = _root_id
      AND project.disposition = 'present'
      AND project.lifecycle = 'open';
  ELSE
    RETURN NULL;
  END IF;

  IF _start_date IS NOT NULL THEN
    RETURN _start_date;
  END IF;
  IF _today_section IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT (
    clock_timestamp() AT TIME ZONE COALESCE(settings.planning_timezone, 'UTC')
  )::date
  INTO _planning_date
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.tasks_user_settings AS settings
    ON settings.owner_id = _owner_id;
  RETURN _planning_date;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.root_effective_reminder_date(uuid, text, uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.anchor_reminder_to_root_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _effective_date date;
  _resolved_at timestamptz;
  _resolution_kind text;
BEGIN
  _effective_date := tasks_private.root_effective_reminder_date(
    NEW.owner_id,
    NEW.root_type,
    COALESCE(NEW.task_id, NEW.project_id)
  );
  IF _effective_date IS NULL AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'A reminder requires a Start date or Today horizon'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'active' THEN
    SELECT resolution.resolved_at, resolution.resolution_kind
    INTO _resolved_at, _resolution_kind
    FROM tasks_private.resolve_reminder_instant(
      _effective_date, NEW.local_time, NEW.time_zone, NEW.ambiguity_choice
    ) AS resolution;
    NEW.local_date := _effective_date;
    NEW.resolved_at := _resolved_at;
    NEW.resolution_kind := _resolution_kind;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.anchor_reminder_to_root_start()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_save_start_reminder(
  _reminder_id uuid,
  _expected_record_revision bigint,
  _root_type text,
  _root_id uuid,
  _local_time text,
  _time_zone text,
  _ambiguity_choice text,
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
  _effective_date date;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save reminders'
      USING ERRCODE = '42501';
  END IF;
  IF _root_type NOT IN ('todo', 'project') THEN
    RAISE EXCEPTION 'The reminder request is invalid' USING ERRCODE = '22023';
  END IF;

  _effective_date := tasks_private.root_effective_reminder_date(
    _owner_id, _root_type, _root_id
  );
  IF _effective_date IS NULL THEN
    RAISE EXCEPTION 'A reminder requires a Start date or Today horizon'
      USING ERRCODE = '22023';
  END IF;

  RETURN public.tasks_save_reminder(
    _reminder_id,
    _expected_record_revision,
    _root_type,
    _root_id,
    _effective_date,
    _local_time,
    _time_zone,
    _ambiguity_choice,
    _mutation_id,
    _mutation_channel,
    _actor_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_save_start_reminder(
  uuid, bigint, text, uuid, text, text, text, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_save_start_reminder(
  uuid, bigint, text, uuid, text, text, text, uuid, text, text
) TO authenticated;

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
BEGIN
  IF NEW.start_date IS NOT DISTINCT FROM OLD.start_date
    AND NEW.today_section IS NOT DISTINCT FROM OLD.today_section THEN
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

DROP TRIGGER IF EXISTS tasks_todos_rebind_reminder_to_start_date
ON public.tasks_todos;
CREATE TRIGGER tasks_todos_rebind_reminder_to_start_date
AFTER UPDATE OF start_date, today_section ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.rebind_root_reminder_to_start_date();

DROP TRIGGER IF EXISTS tasks_projects_rebind_reminder_to_start_date
ON public.tasks_projects;
CREATE TRIGGER tasks_projects_rebind_reminder_to_start_date
AFTER UPDATE OF start_date, today_section ON public.tasks_projects
FOR EACH ROW EXECUTE FUNCTION tasks_private.rebind_root_reminder_to_start_date();

REVOKE ALL ON FUNCTION tasks_private.rebind_root_reminder_to_start_date()
FROM PUBLIC, anon, authenticated;
