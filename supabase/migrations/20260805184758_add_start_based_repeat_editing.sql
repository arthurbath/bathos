-- Add explicit recurrence date bases without changing any existing cadence,
-- occurrence identity, prototype placement, or generated ordinary task.

CREATE TEMP TABLE recurrence_projection_before ON COMMIT DROP AS
SELECT revision_row.id AS revision_id, step.value AS step,
  tasks_private.recurrence_date_for_step(revision_row, step.value) AS anchor_date
FROM public.tasks_recurrence_revisions AS revision_row
CROSS JOIN generate_series(0, 49) AS step(value);

ALTER TABLE public.tasks_recurrence_revisions
  ADD COLUMN date_basis text,
  ADD COLUMN deadline_after_start_days integer;

-- Existing revisions are immutable during ordinary application writes. This
-- named trigger is suspended only for the one-time compatibility backfill and
-- is restored before any new write path is installed.
ALTER TABLE public.tasks_recurrence_revisions
  DISABLE TRIGGER tasks_recurrence_revisions_immutable;

UPDATE public.tasks_recurrence_revisions
SET date_basis = CASE
      WHEN deadline_offset_days IS NULL THEN 'start'
      ELSE 'deadline'
    END,
    deadline_after_start_days = deadline_offset_days;

ALTER TABLE public.tasks_recurrence_revisions
  ENABLE TRIGGER tasks_recurrence_revisions_immutable;

ALTER TABLE public.tasks_recurrence_revisions
  ALTER COLUMN date_basis SET NOT NULL,
  ADD CONSTRAINT tasks_recurrence_revisions_date_basis_check
    CHECK (date_basis IN ('start', 'deadline')),
  ADD CONSTRAINT tasks_recurrence_revisions_deadline_after_start_check
    CHECK (
      deadline_after_start_days IS NULL
      OR deadline_after_start_days >= 0
    ),
  ADD CONSTRAINT tasks_recurrence_revisions_deadline_basis_check
    CHECK (date_basis <> 'deadline' OR deadline_after_start_days IS NOT NULL);

COMMENT ON COLUMN public.tasks_recurrence_revisions.date_basis IS
  'Immutable cadence anchor for this revision: start or deadline.';
COMMENT ON COLUMN public.tasks_recurrence_revisions.deadline_after_start_days IS
  'Canonical nonnegative Deadline offset from the generated Start.';

CREATE OR REPLACE FUNCTION tasks_private.recurrence_positioned_date(
  _year integer,
  _month_number integer,
  _position text,
  _day_type text
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _month date;
  _last_day integer;
  _candidate date;
  _count integer := 0;
  _wanted integer;
  _weekday integer;
  _matches boolean;
BEGIN
  IF _month_number NOT BETWEEN 1 AND 12
    OR _day_type NOT IN (
      'day', 'weekday', 'weekend_day', 'monday', 'tuesday', 'wednesday',
      'thursday', 'friday', 'saturday', 'sunday'
    )
    OR (_position <> 'last' AND (_position !~ '^[0-9]+$' OR _position::integer < 1)) THEN
    RAISE EXCEPTION 'Canonical recurrence position is invalid'
      USING ERRCODE = '22023';
  END IF;
  _month := make_date(_year, _month_number, 1);
  _last_day := extract(day FROM (_month + interval '1 month - 1 day'))::integer;
  IF _day_type = 'day' THEN
    RETURN _month + (
      CASE WHEN _position = 'last' THEN _last_day
        ELSE least(_position::integer, _last_day) END - 1
    );
  END IF;
  _wanted := CASE _day_type
    WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3
    WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6
    WHEN 'sunday' THEN 7 ELSE NULL END;
  IF _position = 'last' THEN
    FOR _day IN REVERSE _last_day..1 LOOP
      _candidate := _month + (_day - 1);
      _weekday := extract(isodow FROM _candidate)::integer;
      _matches := CASE
        WHEN _day_type = 'weekday' THEN _weekday <= 5
        WHEN _day_type = 'weekend_day' THEN _weekday >= 6
        ELSE _weekday = _wanted END;
      IF _matches THEN RETURN _candidate; END IF;
    END LOOP;
    RETURN NULL;
  END IF;
  FOR _day IN 1.._last_day LOOP
    _candidate := _month + (_day - 1);
    _weekday := extract(isodow FROM _candidate)::integer;
    _matches := CASE
      WHEN _day_type = 'weekday' THEN _weekday <= 5
      WHEN _day_type = 'weekend_day' THEN _weekday >= 6
      ELSE _weekday = _wanted END;
    IF _matches THEN
      _count := _count + 1;
      IF _count = _position::integer THEN RETURN _candidate; END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.recurrence_positioned_date(
  integer, integer, text, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION tasks_private.recurrence_rule_config_v2_is_valid(
  _frequency text,
  _rule_config jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH normalized AS (
    SELECT
      _rule_config ->> 'day_type' AS day_type,
      _rule_config ->> 'position' AS position,
      CASE _rule_config ->> 'day_type'
        WHEN 'day' THEN 31
        WHEN 'weekday' THEN 23
        WHEN 'weekend_day' THEN 10
        WHEN 'monday' THEN 5 WHEN 'tuesday' THEN 5 WHEN 'wednesday' THEN 5
        WHEN 'thursday' THEN 5 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 5
        WHEN 'sunday' THEN 5
        ELSE 0
      END AS maximum_position
  )
  SELECT jsonb_typeof(_rule_config) = 'object'
    AND (_rule_config ->> 'version')::integer = 2
    AND CASE _frequency
      WHEN 'daily' THEN true
      WHEN 'weekly' THEN jsonb_typeof(_rule_config -> 'weekdays') = 'array'
        AND jsonb_array_length(_rule_config -> 'weekdays') > 0
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(_rule_config -> 'weekdays') AS item
          WHERE item.value !~ '^[1-7]$'
        )
      WHEN 'monthly' THEN EXISTS (
        SELECT 1 FROM normalized
        WHERE maximum_position > 0
          AND (position = 'last' OR (
            position ~ '^[0-9]+$'
            AND position::integer BETWEEN 1 AND maximum_position
          ))
      )
      WHEN 'yearly' THEN jsonb_typeof(_rule_config -> 'months') = 'array'
        AND jsonb_array_length(_rule_config -> 'months') > 0
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(_rule_config -> 'months') AS item
          WHERE item.value !~ '^([1-9]|1[0-2])$'
        )
        AND EXISTS (
          SELECT 1 FROM normalized
          WHERE maximum_position > 0
            AND (position = 'last' OR (
              position ~ '^[0-9]+$'
              AND position::integer BETWEEN 1 AND maximum_position
            ))
        )
      ELSE false
    END
$$;

REVOKE ALL ON FUNCTION tasks_private.recurrence_rule_config_v2_is_valid(
  text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION tasks_private.recurrence_date_for_step(
  _revision public.tasks_recurrence_revisions,
  _step integer
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _candidate date;
  _count integer := -1;
  _year integer;
  _month_number integer;
  _months integer[];
  _weekdays integer[];
  _position text;
  _day_type text;
  _legacy_weekday integer;
BEGIN
  IF _step < 0 THEN
    RAISE EXCEPTION 'Recurrence step is invalid' USING ERRCODE = '22023';
  END IF;
  IF _revision.end_mode = 'after' AND _step >= _revision.end_after_count THEN
    RETURN NULL;
  END IF;

  IF _revision.frequency = 'daily' THEN
    _candidate := _revision.start_date + (_revision.interval_count * _step);
  ELSIF _revision.frequency = 'weekly' THEN
    SELECT COALESCE(array_agg(value::integer ORDER BY value::integer), ARRAY[]::integer[])
    INTO _weekdays
    FROM jsonb_array_elements_text(
      COALESCE(_revision.rule_config -> 'weekdays', '[]'::jsonb)
    ) AS value
    WHERE value::integer BETWEEN 1 AND 7;
    IF cardinality(_weekdays) = 0 THEN
      _weekdays := ARRAY[extract(isodow FROM _revision.start_date)::integer];
    END IF;
    _candidate := _revision.start_date - 1;
    LOOP
      _candidate := _candidate + 1;
      IF (
        ((date_trunc('week', _candidate)::date
          - date_trunc('week', _revision.start_date)::date) / 7)
        % _revision.interval_count = 0
        AND extract(isodow FROM _candidate)::integer = ANY(_weekdays)
      ) THEN
        _count := _count + 1;
        EXIT WHEN _count = _step;
      END IF;
      IF _candidate > _revision.start_date + 366000 THEN
        RAISE EXCEPTION 'Recurrence evaluation range is too large'
          USING ERRCODE = '54000';
      END IF;
    END LOOP;
  ELSIF _revision.frequency = 'monthly' THEN
    IF (_revision.rule_config ->> 'version')::integer = 2 THEN
      _position := COALESCE(
        _revision.rule_config ->> 'position',
        extract(day FROM _revision.start_date)::integer::text
      );
      _day_type := COALESCE(_revision.rule_config ->> 'day_type', 'day');
    ELSIF _revision.rule_config ->> 'monthly_kind' = 'last_day' THEN
      _position := 'last'; _day_type := 'day';
    ELSIF _revision.rule_config ->> 'monthly_kind' = 'ordinal_weekday' THEN
      _position := CASE WHEN (_revision.rule_config ->> 'ordinal')::integer = -1
        THEN 'last' ELSE COALESCE(_revision.rule_config ->> 'ordinal', '1') END;
      _legacy_weekday := COALESCE(
        (_revision.rule_config ->> 'weekday')::integer,
        extract(isodow FROM _revision.start_date)::integer
      );
      _day_type := (ARRAY[
        'monday','tuesday','wednesday','thursday','friday','saturday','sunday'
      ])[_legacy_weekday];
    ELSIF _revision.rule_config ->> 'monthly_kind' = 'ordinal_day_type' THEN
      _position := CASE WHEN (_revision.rule_config ->> 'ordinal')::integer = -1
        THEN 'last' ELSE COALESCE(_revision.rule_config ->> 'ordinal', '1') END;
      _day_type := COALESCE(_revision.rule_config ->> 'day_type', 'weekday');
    ELSE
      _position := COALESCE(
        _revision.rule_config ->> 'month_day',
        extract(day FROM _revision.start_date)::integer::text
      );
      _day_type := 'day';
    END IF;
    FOR _month_step IN 0..1200 LOOP
      _year := extract(year FROM _revision.start_date)::integer
        + ((extract(month FROM _revision.start_date)::integer - 1
          + _revision.interval_count * _month_step) / 12);
      _month_number := ((extract(month FROM _revision.start_date)::integer - 1
        + _revision.interval_count * _month_step) % 12) + 1;
      _candidate := tasks_private.recurrence_positioned_date(
        _year, _month_number, _position, _day_type
      );
      IF _candidate IS NULL OR _candidate < _revision.start_date THEN CONTINUE; END IF;
      _count := _count + 1;
      EXIT WHEN _count = _step;
    END LOOP;
    IF _count < _step THEN RETURN NULL; END IF;
  ELSIF _revision.frequency = 'yearly' THEN
    IF (_revision.rule_config ->> 'version')::integer = 2 THEN
      SELECT COALESCE(array_agg(value::integer ORDER BY value::integer), ARRAY[]::integer[])
      INTO _months
      FROM jsonb_array_elements_text(
        COALESCE(_revision.rule_config -> 'months', '[]'::jsonb)
      ) AS value
      WHERE value::integer BETWEEN 1 AND 12;
      IF cardinality(_months) = 0 THEN
        _months := ARRAY[extract(month FROM _revision.start_date)::integer];
      END IF;
      _position := COALESCE(
        _revision.rule_config ->> 'position',
        extract(day FROM _revision.start_date)::integer::text
      );
      _day_type := COALESCE(_revision.rule_config ->> 'day_type', 'day');
    ELSE
      _months := ARRAY[COALESCE(
        (_revision.rule_config ->> 'month')::integer,
        extract(month FROM _revision.start_date)::integer
      )];
      IF _revision.rule_config ->> 'yearly_kind' = 'last_day' THEN
        _position := 'last'; _day_type := 'day';
      ELSIF _revision.rule_config ->> 'yearly_kind' = 'ordinal_weekday' THEN
        _position := CASE WHEN (_revision.rule_config ->> 'ordinal')::integer = -1
          THEN 'last' ELSE COALESCE(_revision.rule_config ->> 'ordinal', '1') END;
        _legacy_weekday := COALESCE(
          (_revision.rule_config ->> 'weekday')::integer,
          extract(isodow FROM _revision.start_date)::integer
        );
        _day_type := (ARRAY[
          'monday','tuesday','wednesday','thursday','friday','saturday','sunday'
        ])[_legacy_weekday];
      ELSE
        _position := COALESCE(
          _revision.rule_config ->> 'month_day',
          extract(day FROM _revision.start_date)::integer::text
        );
        _day_type := 'day';
      END IF;
    END IF;
    FOR _year_step IN 0..1200 LOOP
      _year := extract(year FROM _revision.start_date)::integer
        + (_revision.interval_count * _year_step);
      FOREACH _month_number IN ARRAY _months LOOP
        _candidate := tasks_private.recurrence_positioned_date(
          _year, _month_number, _position, _day_type
        );
        IF _candidate IS NULL OR _candidate < _revision.start_date THEN CONTINUE; END IF;
        _count := _count + 1;
        EXIT WHEN _count = _step;
      END LOOP;
      EXIT WHEN _count = _step;
    END LOOP;
    IF _count < _step THEN RETURN NULL; END IF;
  ELSE
    RAISE EXCEPTION 'Recurrence frequency is invalid' USING ERRCODE = '22023';
  END IF;

  IF _revision.end_mode = 'on_date' AND _candidate > _revision.end_on_date THEN
    RETURN NULL;
  END IF;
  RETURN _candidate;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.recurrence_date_for_step(
  public.tasks_recurrence_revisions, integer
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION tasks_private.prepare_recurrence_revision_basis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _current public.tasks_recurrence_revisions;
  _v2_write boolean := current_setting(
    'garden.bath.tasks_recurrence_v2', true
  ) = 'on';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.date_basis IS DISTINCT FROM OLD.date_basis AND NOT _v2_write THEN
      RAISE EXCEPTION 'Recurrence date basis is immutable within a revision'
        USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF _v2_write THEN
    NEW.date_basis := current_setting(
      'garden.bath.tasks_recurrence_date_basis', true
    );
    NEW.deadline_after_start_days := NULLIF(
      current_setting('garden.bath.tasks_recurrence_deadline_days', true), ''
    )::integer;
  END IF;
  IF NEW.date_basis IS NULL THEN
    SELECT revision.* INTO _current
    FROM public.tasks_recurrence_definitions AS definition
    JOIN public.tasks_recurrence_revisions AS revision
      ON revision.owner_id = definition.owner_id
     AND revision.recurrence_id = definition.id
     AND revision.revision = definition.current_revision
    WHERE definition.owner_id = NEW.owner_id
      AND definition.id = NEW.recurrence_id;
    IF FOUND
      AND _current.date_basis = 'start'
      AND COALESCE((_current.rule_config ->> 'version')::integer, 1) >= 2
      AND NOT _v2_write THEN
      RAISE EXCEPTION 'Refresh Tasks before editing this repeat'
        USING ERRCODE = '55000';
    END IF;
    NEW.date_basis := CASE WHEN NEW.deadline_offset_days IS NULL
      THEN 'start' ELSE 'deadline' END;
  END IF;
  NEW.deadline_after_start_days := COALESCE(
    NEW.deadline_after_start_days,
    NEW.deadline_offset_days
  );
  IF NEW.date_basis = 'start' THEN
    NEW.deadline_offset_days := NULL;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.prepare_recurrence_revision_basis()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER tasks_recurrence_revision_basis_prepare
BEFORE INSERT OR UPDATE OF date_basis, deadline_after_start_days
ON public.tasks_recurrence_revisions
FOR EACH ROW EXECUTE FUNCTION tasks_private.prepare_recurrence_revision_basis();

CREATE OR REPLACE FUNCTION tasks_private.prepare_recurrence_occurrence_v2_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('garden.bath.tasks_recurrence_v2', true) = 'on'
    AND current_setting('garden.bath.tasks_recurrence_date_basis', true) = 'start'
    AND NEW.logical_key LIKE 'calendar:%' THEN
    NEW.logical_key := 'calendar-v2-start:' || NEW.scheduled_date::text;
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.prepare_recurrence_occurrence_v2_key()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER tasks_recurrence_occurrence_v2_key_prepare
BEFORE INSERT ON public.tasks_recurrence_occurrences
FOR EACH ROW EXECUTE FUNCTION tasks_private.prepare_recurrence_occurrence_v2_key();

CREATE OR REPLACE FUNCTION tasks_private.prepare_recurrence_todo_v2_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('garden.bath.tasks_recurrence_v2', true) = 'on'
    AND current_setting('garden.bath.tasks_recurrence_date_basis', true) = 'start'
    AND NEW.recurrence_logical_key LIKE 'calendar:%' THEN
    NEW.recurrence_logical_key := 'calendar-v2-start:'
      || substring(NEW.recurrence_logical_key FROM length('calendar:') + 1);
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.prepare_recurrence_todo_v2_key()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER tasks_recurrence_todo_v2_key_prepare
BEFORE UPDATE OF recurrence_logical_key ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.prepare_recurrence_todo_v2_key();

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
  IF _revision.date_basis = 'start'
    AND (_revision.rule_config ->> 'version')::integer = 2
    AND _logical_key LIKE 'calendar:%' THEN
    _logical_key := 'calendar-v2-start:' || _scheduled_date::text;
  END IF;
  SELECT occurrence.* INTO _existing
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.recurrence_id = _definition.id
    AND occurrence.logical_key = _logical_key;
  IF FOUND THEN RETURN _existing; END IF;

  _snapshot := tasks_private.normalize_recurrence_snapshot(_snapshot);
  _root := _snapshot -> 'root';
  IF _revision.date_basis = 'deadline' THEN
    _deadline := _scheduled_date;
    _start_date := _scheduled_date - _revision.deadline_after_start_days;
  ELSE
    _start_date := _scheduled_date;
    _deadline := CASE WHEN _revision.deadline_after_start_days IS NULL
      THEN NULL ELSE _scheduled_date + _revision.deadline_after_start_days END;
  END IF;
  _planning_date := (clock_timestamp() AT TIME ZONE _revision.planning_timezone)::date;

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
    COALESCE(_definition.upcoming_order_key, NULLIF(_root ->> 'order_key', ''), 'a0'),
    _entry_channel, NULL, NULL, NULL, NULL, 1, gen_random_uuid(),
    clock_timestamp(), clock_timestamp(), _entry_channel, _actor_type,
    _start_date, _deadline,
    CASE WHEN _start_date <= _planning_date THEN 'inbox' ELSE NULL END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.tasks_areas AS area
      WHERE area.id = _revision.target_area_id
        AND area.owner_id = _owner_id AND area.disposition = 'present'
    ) THEN _revision.target_area_id ELSE NULL END,
    NULL, COALESCE(_root ->> 'actionability', 'actionable'),
    NULLIF(btrim(_root ->> 'primary_link'), '')
  );

  FOR _item IN SELECT value FROM jsonb_array_elements(_snapshot #> '{root,checklist}') LOOP
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
    scheduled_date, predecessor_occurrence_id, root_type, root_id,
    client_mutation_id, generated_at, origin
  ) VALUES (
    _occurrence_id, _owner_id, _definition.id, _revision.revision,
    _logical_key, _scheduled_date, _predecessor_occurrence_id,
    'todo', _task_id, _occurrence_id, clock_timestamp(), 'generated'
  ) RETURNING * INTO _occurrence;

  INSERT INTO tasks_private.recurrence_contexts (backend_pid, transaction_id, owner_id)
  VALUES (pg_backend_pid(), txid_current(), _owner_id) ON CONFLICT DO NOTHING;
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
  WHERE backend_pid = pg_backend_pid() AND transaction_id = txid_current()
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
  uuid, public.tasks_recurrence_definitions, public.tasks_recurrence_revisions,
  date, text, uuid, text, text
) FROM PUBLIC, anon, authenticated, service_role;

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
  _result jsonb;
  _definition public.tasks_recurrence_definitions;
  _revision public.tasks_recurrence_revisions;
  _occurrence public.tasks_recurrence_occurrences;
  _anchor date;
  _legacy_offset integer;
BEGIN
  IF _date_basis NOT IN ('start', 'deadline')
    OR _next_start_date IS NULL
    OR COALESCE(_deadline_after_start_days, 0) < 0
    OR (_date_basis = 'deadline' AND _deadline_after_start_days IS NULL)
    OR NOT tasks_private.recurrence_rule_config_v2_is_valid(
      _frequency, _rule_config
    ) THEN
    RAISE EXCEPTION 'Version 2 recurrence input is invalid' USING ERRCODE = '22023';
  END IF;
  SELECT task.* INTO _task FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id AND task.id = _task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The task is unavailable for recurrence' USING ERRCODE = '22023';
  END IF;
  _anchor := CASE WHEN _date_basis = 'deadline'
    THEN _next_start_date + _deadline_after_start_days ELSE _next_start_date END;
  _legacy_offset := CASE WHEN _date_basis = 'deadline'
    THEN _deadline_after_start_days ELSE NULL END;
  PERFORM set_config('garden.bath.tasks_recurrence_v2', 'on', true);
  PERFORM set_config('garden.bath.tasks_recurrence_date_basis', _date_basis, true);
  PERFORM set_config(
    'garden.bath.tasks_recurrence_deadline_days',
    COALESCE(_deadline_after_start_days::text, ''),
    true
  );
  _result := public.tasks_create_recurrence_from_task(
    _task_id, _task.title, _rule_mode, _frequency, _interval_count,
    _anchor, _rule_config, _end_mode, _end_after_count, _end_on_date,
    _reminder_local_time, _legacy_offset, _mutation_id,
    _mutation_channel, _actor_type
  );
  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.owner_id = _owner_id
    AND definition.id = ((_result -> 'definition' ->> 'id')::uuid);
  SELECT revision.* INTO _revision
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = _owner_id AND revision.recurrence_id = _definition.id
    AND revision.revision = _definition.current_revision;
  SELECT occurrence.* INTO _occurrence
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.recurrence_id = _definition.id
    AND occurrence.client_mutation_id = _mutation_id;
  RETURN jsonb_build_object(
    'outcome', _result ->> 'outcome',
    'definition', to_jsonb(_definition) - 'owner_id',
    'revision', to_jsonb(_revision) - 'owner_id',
    'occurrence', CASE WHEN _occurrence.id IS NULL THEN 'null'::jsonb
      ELSE to_jsonb(_occurrence) - 'owner_id' END
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
  _result jsonb;
BEGIN
  IF _date_basis NOT IN ('start', 'deadline')
    OR _next_start_date IS NULL
    OR COALESCE(_deadline_after_start_days, 0) < 0
    OR (_date_basis = 'deadline' AND _deadline_after_start_days IS NULL)
    OR NOT tasks_private.recurrence_rule_config_v2_is_valid(
      _frequency, _rule_config
    ) THEN
    RAISE EXCEPTION 'Version 2 recurrence input is invalid' USING ERRCODE = '22023';
  END IF;
  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.owner_id = _owner_id AND definition.id = _recurrence_id;
  SELECT revision.* INTO _current
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = _owner_id AND revision.recurrence_id = _recurrence_id
    AND revision.revision = _definition.current_revision;
  _snapshot := tasks_private.normalize_recurrence_snapshot(
    COALESCE(_prototype_snapshot, _current.prototype_snapshot)
  );
  _name := NULLIF(btrim(_snapshot #>> '{root,title}'), '');
  IF _name IS NULL THEN _name := _definition.name; END IF;
  _anchor := CASE WHEN _date_basis = 'deadline'
    THEN _next_start_date + _deadline_after_start_days ELSE _next_start_date END;
  _legacy_offset := CASE WHEN _date_basis = 'deadline'
    THEN _deadline_after_start_days ELSE NULL END;
  PERFORM set_config('garden.bath.tasks_recurrence_v2', 'on', true);
  PERFORM set_config('garden.bath.tasks_recurrence_date_basis', _date_basis, true);
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
  WHERE revision.owner_id = _owner_id AND revision.recurrence_id = _recurrence_id
    AND revision.revision = _definition.current_revision;
  RETURN jsonb_build_object(
    'outcome', _result ->> 'outcome',
    'definition', to_jsonb(_definition) - 'owner_id',
    'revision', to_jsonb(_revision) - 'owner_id'
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tasks_recurrence_revisions
    WHERE deadline_after_start_days IS NOT NULL AND date_basis <> 'deadline'
      AND rule_config ->> 'version' IS DISTINCT FROM '2'
  ) THEN
    RAISE EXCEPTION 'A legacy deadline recurrence lost its Deadline basis';
  END IF;
  IF EXISTS (
    SELECT 1 FROM recurrence_projection_before AS before
    JOIN public.tasks_recurrence_revisions AS revision_row ON revision_row.id = before.revision_id
    WHERE tasks_private.recurrence_date_for_step(revision_row, before.step)
      IS DISTINCT FROM before.anchor_date
  ) THEN
    RAISE EXCEPTION 'Existing recurrence projections changed during basis migration';
  END IF;
END
$$;
