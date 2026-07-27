-- Rich task recurrence authoring and adopted first occurrences.
-- No table is added, so the exact 20-table PowerSync publication is unchanged.

ALTER TABLE public.tasks_recurrence_revisions
  ADD COLUMN rule_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN end_mode text NOT NULL DEFAULT 'never',
  ADD COLUMN end_after_count integer,
  ADD COLUMN end_on_date date,
  ADD COLUMN reminder_local_time time,
  ADD COLUMN deadline_offset_days integer;

ALTER TABLE public.tasks_recurrence_revisions
  ADD CONSTRAINT tasks_recurrence_revisions_rule_config_object
    CHECK (jsonb_typeof(rule_config) = 'object'),
  ADD CONSTRAINT tasks_recurrence_revisions_end_mode_valid
    CHECK (end_mode IN ('never', 'after', 'on_date')),
  ADD CONSTRAINT tasks_recurrence_revisions_end_value_valid
    CHECK (
      (end_mode = 'never' AND end_after_count IS NULL AND end_on_date IS NULL)
      OR (end_mode = 'after' AND end_after_count > 0 AND end_on_date IS NULL)
      OR (end_mode = 'on_date' AND end_after_count IS NULL AND end_on_date IS NOT NULL)
    ),
  ADD CONSTRAINT tasks_recurrence_revisions_deadline_offset_valid
    CHECK (deadline_offset_days IS NULL OR deadline_offset_days >= 0);

ALTER TABLE public.tasks_recurrence_occurrences
  ALTER COLUMN template_instantiation_id DROP NOT NULL,
  ADD COLUMN origin text NOT NULL DEFAULT 'generated';

ALTER TABLE public.tasks_recurrence_occurrences
  ADD CONSTRAINT tasks_recurrence_occurrences_origin_valid
    CHECK (origin IN ('adopted', 'generated')),
  ADD CONSTRAINT tasks_recurrence_occurrences_instantiation_origin_valid
    CHECK (
      (origin = 'adopted' AND template_instantiation_id IS NULL)
      OR (origin = 'generated' AND template_instantiation_id IS NOT NULL)
    );

CREATE OR REPLACE FUNCTION tasks_private.reject_recurrence_immutable_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND EXISTS (
      SELECT 1
      FROM tasks_private.recurrence_contexts AS context
      WHERE context.backend_pid = pg_backend_pid()
        AND context.transaction_id = txid_current()
        AND context.owner_id = OLD.owner_id
    ) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' AND (SELECT auth.uid()) IS NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Recurrence revisions, occurrences, and evaluations are immutable'
    USING ERRCODE = '23514';
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.recurrence_date_for_step(
  _revision public.tasks_recurrence_revisions,
  _step integer
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _candidate date;
  _count integer := -1;
  _weekdays integer[];
  _month date;
  _day integer;
  _ordinal integer;
  _weekday integer;
  _first_weekday integer;
  _last_day integer;
BEGIN
  IF _step < 0 THEN
    RAISE EXCEPTION 'Recurrence step is invalid' USING ERRCODE = '22023';
  END IF;
  IF _revision.end_mode = 'after' AND _step >= _revision.end_after_count THEN
    RETURN NULL;
  END IF;

  IF _revision.frequency IN ('daily', 'yearly') THEN
    _candidate := tasks_private.add_recurrence_interval(
      _revision.start_date, _revision.frequency, _revision.interval_count, _step
    );
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
        AND extract(isodow FROM _candidate)::integer = ANY (_weekdays)
      ) THEN
        _count := _count + 1;
        EXIT WHEN _count = _step;
      END IF;
      IF _candidate > _revision.start_date + 366000 THEN
        RAISE EXCEPTION 'Recurrence evaluation range is too large'
          USING ERRCODE = '54000';
      END IF;
    END LOOP;
  ELSE
    _month := (
      date_trunc('month', _revision.start_date)::date
      + make_interval(months => _revision.interval_count * _step)
    )::date;
    _last_day := extract(day FROM (_month + interval '1 month - 1 day'))::integer;
    IF _revision.rule_config ->> 'monthly_kind' = 'ordinal_weekday' THEN
      _ordinal := COALESCE((_revision.rule_config ->> 'ordinal')::integer, 1);
      _weekday := COALESCE(
        (_revision.rule_config ->> 'weekday')::integer,
        extract(isodow FROM _revision.start_date)::integer
      );
      IF _ordinal = -1 THEN
        _candidate := _month + (_last_day - 1);
        _candidate := _candidate
          - ((extract(isodow FROM _candidate)::integer - _weekday + 7) % 7);
      ELSE
        _first_weekday := extract(isodow FROM _month)::integer;
        _day := 1 + ((_weekday - _first_weekday + 7) % 7) + ((_ordinal - 1) * 7);
        IF _day > _last_day THEN RETURN NULL; END IF;
        _candidate := _month + (_day - 1);
      END IF;
    ELSE
      _day := COALESCE(
        (_revision.rule_config ->> 'month_day')::integer,
        extract(day FROM _revision.start_date)::integer
      );
      _candidate := _month + (least(greatest(_day, 1), _last_day) - 1);
    END IF;
  END IF;

  IF _revision.end_mode = 'on_date' AND _candidate > _revision.end_on_date THEN
    RETURN NULL;
  END IF;
  RETURN _candidate;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.recurrence_date_for_step(
  public.tasks_recurrence_revisions, integer
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
  _source jsonb;
  _snapshot jsonb;
  _saved jsonb;
  _template_id uuid;
  _template_revision bigint;
  _definition public.tasks_recurrence_definitions;
  _revision public.tasks_recurrence_revisions;
  _occurrence public.tasks_recurrence_occurrences;
  _timezone text;
  _capture_mutation_id uuid := gen_random_uuid();
  _save_mutation_id uuid := gen_random_uuid();
  _logical_key text;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _task_id IS NULL OR _mutation_id IS NULL OR NULLIF(btrim(_name), '') IS NULL
    OR _rule_mode NOT IN ('calendar', 'after_completion')
    OR _frequency NOT IN ('daily', 'weekly', 'monthly', 'yearly')
    OR _interval_count NOT BETWEEN 1 AND 1000 OR _schedule_date IS NULL
    OR jsonb_typeof(COALESCE(_rule_config, '{}'::jsonb)) <> 'object'
    OR _end_mode NOT IN ('never', 'after', 'on_date')
    OR (_end_mode = 'after' AND COALESCE(_end_after_count, 0) < 1)
    OR (_end_mode = 'on_date' AND _end_on_date IS NULL)
    OR COALESCE(_deadline_offset_days, 0) < 0 THEN
    RAISE EXCEPTION 'Recurrence input is invalid' USING ERRCODE = '22023';
  END IF;

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
    WHERE definition.id = _occurrence.recurrence_id
      AND definition.owner_id = _owner_id;
    SELECT revision.* INTO _revision
    FROM public.tasks_recurrence_revisions AS revision
    WHERE revision.owner_id = _owner_id
      AND revision.recurrence_id = _occurrence.recurrence_id
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
  WHERE task.id = _task_id AND task.owner_id = _owner_id
    AND task.disposition = 'present' AND task.lifecycle = 'open'
    AND task.recurrence_definition_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The task is unavailable for recurrence'
      USING ERRCODE = '22023';
  END IF;
  SELECT planning_timezone INTO _timezone
  FROM public.tasks_user_settings WHERE owner_id = _owner_id;

  _source := tasks_private.capture_template_source(
    _owner_id, 'todo', _task_id, _schedule_date
  );
  _snapshot := jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(_source -> 'snapshot', '{root,destination}', '"anytime"'::jsonb),
        '{root,today_section}', 'null'::jsonb
      ),
      '{root,start_offset_days}',
      to_jsonb(CASE
        WHEN _deadline_offset_days IS NULL THEN 0
        ELSE -_deadline_offset_days
      END)
    ),
    '{root,deadline_offset_days}',
    CASE WHEN _deadline_offset_days IS NULL
      THEN 'null'::jsonb ELSE '0'::jsonb END
  );
  INSERT INTO public.tasks_templates (
    owner_id, kind, name, current_revision, record_revision,
    last_mutation_channel, last_actor_type, client_mutation_id,
    created_at, updated_at
  ) VALUES (
    _owner_id, 'todo', btrim(_name), 1, 1,
    _mutation_channel, _actor_type, _capture_mutation_id,
    clock_timestamp(), clock_timestamp()
  )
  RETURNING id, current_revision INTO _template_id, _template_revision;
  INSERT INTO public.tasks_template_revisions (
    owner_id, template_id, revision, name, source_type, source_id,
    source_revision, anchor_date, snapshot, client_mutation_id, created_at
  ) VALUES (
    _owner_id, _template_id, _template_revision, btrim(_name),
    'todo', _task_id, (_source ->> 'source_revision')::bigint,
    _schedule_date, _snapshot, _capture_mutation_id, clock_timestamp()
  );

  _saved := public.tasks_save_recurrence(
    NULL, NULL, btrim(_name), _template_id, _template_revision,
    _rule_mode, _frequency, _interval_count, _schedule_date, _timezone,
    'all', 100, _task.area_id, _save_mutation_id,
    _mutation_channel, _actor_type
  );
  _definition := jsonb_populate_record(
    NULL::public.tasks_recurrence_definitions,
    (_saved -> 'definition') || jsonb_build_object('owner_id', _owner_id)
  );
  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (pg_backend_pid(), txid_current(), _owner_id)
  ON CONFLICT DO NOTHING;
  UPDATE public.tasks_recurrence_revisions
  SET rule_config = COALESCE(_rule_config, '{}'::jsonb),
      end_mode = _end_mode,
      end_after_count = CASE WHEN _end_mode = 'after' THEN _end_after_count ELSE NULL END,
      end_on_date = CASE WHEN _end_mode = 'on_date' THEN _end_on_date ELSE NULL END,
      reminder_local_time = _reminder_local_time,
      deadline_offset_days = _deadline_offset_days
  WHERE owner_id = _owner_id
    AND recurrence_id = _definition.id
    AND revision = _definition.current_revision
  RETURNING * INTO _revision;

  _logical_key := CASE WHEN _rule_mode = 'calendar'
    THEN 'calendar:' || _schedule_date::text
    ELSE 'initial:' || _schedule_date::text END;
  INSERT INTO public.tasks_recurrence_occurrences (
    owner_id, recurrence_id, recurrence_revision, logical_key,
    scheduled_date, predecessor_occurrence_id, template_instantiation_id,
    root_type, root_id, client_mutation_id, generated_at, origin
  ) VALUES (
    _owner_id, _definition.id, _revision.revision, _logical_key,
    _schedule_date, NULL, NULL, 'todo', _task_id, _mutation_id,
    clock_timestamp(), 'adopted'
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
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type,
      updated_at = clock_timestamp()
  WHERE id = _task_id AND owner_id = _owner_id;
  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  UPDATE public.tasks_recurrence_definitions
  SET evaluated_through_date = _schedule_date,
      record_revision = record_revision + 1,
      client_mutation_id = _mutation_id,
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type
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

REVOKE ALL ON FUNCTION public.tasks_create_recurrence_from_task(
  uuid, text, text, text, integer, date, jsonb, text, integer, date,
  time, integer, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_recurrence_from_task(
  uuid, text, text, text, integer, date, jsonb, text, integer, date,
  time, integer, uuid, text, text
) TO authenticated;

-- Evaluate structured calendar rules without depending on the interval-only
-- step estimator used by the original recurrence foundation.
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
  _candidate date;
  _selected_dates date[] := ARRAY[]::date[];
  _occurrence_ids jsonb := '[]'::jsonb;
  _result jsonb;
  _step integer := 0;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to evaluate recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _through_date IS NULL OR _request_id IS NULL
    OR _entry_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    ) OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
    RAISE EXCEPTION 'Recurrence evaluation input is invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      _owner_id::text || E'\x1f' || _request_id::text,
      0
    )
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

  IF _definition.status = 'active' THEN
    IF _revision.rule_mode = 'after_completion' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.tasks_recurrence_occurrences AS occurrence
        WHERE occurrence.owner_id = _owner_id
          AND occurrence.recurrence_id = _definition.id
      ) AND _revision.start_date <= _through_date THEN
        _candidate := CASE
          WHEN _revision.missed_policy = 'skip'
            AND _revision.start_date < _through_date THEN NULL
          WHEN _revision.missed_policy = 'latest' THEN _through_date
          ELSE _revision.start_date
        END;
        IF _candidate IS NOT NULL THEN
          _selected_dates := ARRAY[_candidate];
        END IF;
      END IF;
    ELSE
      LOOP
        _candidate := tasks_private.recurrence_date_for_step(
          _revision,
          _step
        );
        EXIT WHEN _candidate IS NULL OR _candidate > _through_date;
        IF _definition.evaluated_through_date IS NULL
          OR _candidate > _definition.evaluated_through_date THEN
          IF _revision.missed_policy = 'all' THEN
            _selected_dates := array_append(_selected_dates, _candidate);
            IF cardinality(_selected_dates) > _revision.catch_up_limit THEN
              RAISE EXCEPTION
                'Recurrence catch-up exceeds its safety limit'
                USING ERRCODE = '54000';
            END IF;
          ELSIF _revision.missed_policy = 'latest' THEN
            _selected_dates := ARRAY[_candidate];
          ELSIF _candidate = _through_date THEN
            _selected_dates := ARRAY[_candidate];
          END IF;
        END IF;
        _step := _step + 1;
        IF _step > 100000 THEN
          RAISE EXCEPTION 'Recurrence evaluation range is too large'
            USING ERRCODE = '54000';
        END IF;
      END LOOP;
    END IF;

    FOREACH _candidate IN ARRAY _selected_dates LOOP
      _occurrence := tasks_private.instantiate_recurrence_occurrence(
        _owner_id,
        _definition,
        _revision,
        _candidate,
        CASE
          WHEN _revision.rule_mode = 'calendar'
            THEN 'calendar:' || _candidate::text
          ELSE 'initial:' || _candidate::text
        END,
        NULL,
        _entry_channel,
        _actor_type
      );
      _occurrence_ids := _occurrence_ids
        || jsonb_build_array(_occurrence.id);
    END LOOP;
    UPDATE public.tasks_recurrence_definitions
    SET evaluated_through_date = greatest(
          COALESCE(evaluated_through_date, _through_date),
          _through_date
        ),
        record_revision = record_revision + 1,
        last_mutation_channel = _entry_channel,
        last_actor_type = _actor_type,
        client_mutation_id = _request_id
    WHERE id = _definition.id
      AND owner_id = _owner_id
    RETURNING * INTO _definition;
  END IF;

  _result := jsonb_build_object(
    'outcome', 'accepted',
    'status', _definition.status,
    'through_date', _through_date,
    'generated_count', jsonb_array_length(_occurrence_ids),
    'occurrence_ids', _occurrence_ids,
    'definition', to_jsonb(_definition) - 'owner_id'
  );
  INSERT INTO public.tasks_recurrence_evaluations (
    id,
    owner_id,
    recurrence_id,
    through_date,
    result,
    client_mutation_id
  ) VALUES (
    _request_id,
    _owner_id,
    _definition.id,
    _through_date,
    _result,
    _request_id
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
  _instantiation_result jsonb;
  _instantiation_id uuid;
  _root_id uuid;
  _occurrence_id uuid := gen_random_uuid();
BEGIN
  SELECT occurrence.* INTO _existing
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.recurrence_id = _definition.id
    AND occurrence.logical_key = _logical_key;
  IF FOUND THEN
    RETURN _existing;
  END IF;

  _instantiation_result := public.tasks_instantiate_template(
    _revision.template_id,
    _revision.template_revision,
    _scheduled_date,
    _occurrence_id,
    _entry_channel,
    _actor_type,
    _revision.target_area_id
  );
  IF _instantiation_result #>> '{result,root_type}' <> 'todo' THEN
    RAISE EXCEPTION 'Recurrence templates must instantiate tasks'
      USING ERRCODE = '23514';
  END IF;
  _instantiation_id := (
    _instantiation_result #>> '{instantiation,id}'
  )::uuid;
  _root_id := (
    _instantiation_result #>> '{result,root_id}'
  )::uuid;

  INSERT INTO public.tasks_recurrence_occurrences (
    id,
    owner_id,
    recurrence_id,
    recurrence_revision,
    logical_key,
    scheduled_date,
    predecessor_occurrence_id,
    template_instantiation_id,
    root_type,
    root_id,
    client_mutation_id,
    generated_at,
    origin
  ) VALUES (
    _occurrence_id,
    _owner_id,
    _definition.id,
    _revision.revision,
    _logical_key,
    _scheduled_date,
    _predecessor_occurrence_id,
    _instantiation_id,
    'todo',
    _root_id,
    _occurrence_id,
    clock_timestamp(),
    'generated'
  )
  RETURNING * INTO _occurrence;

  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid,
    transaction_id,
    owner_id
  ) VALUES (
    pg_backend_pid(),
    txid_current(),
    _owner_id
  )
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
  WHERE id = _root_id
    AND owner_id = _owner_id;
  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  IF _revision.reminder_local_time IS NOT NULL
    AND auth.uid() IS NOT DISTINCT FROM _owner_id THEN
    PERFORM public.tasks_save_start_reminder(
      NULL,
      NULL,
      'todo',
      _root_id,
      to_char(_revision.reminder_local_time, 'HH24:MI'),
      _revision.planning_timezone,
      'earlier',
      gen_random_uuid(),
      _entry_channel,
      _actor_type
    );
  END IF;
  RETURN _occurrence;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.instantiate_recurrence_occurrence(
  uuid,
  public.tasks_recurrence_definitions,
  public.tasks_recurrence_revisions,
  date,
  text,
  uuid,
  text,
  text
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.advance_after_completion_recurrence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _definition public.tasks_recurrence_definitions;
  _revision public.tasks_recurrence_revisions;
  _scheduled_date date;
  _occurrence_count integer;
  _entry_channel text := COALESCE(
    NEW.last_mutation_channel,
    'web'
  );
  _actor_type text := COALESCE(NEW.last_actor_type, 'user');
BEGIN
  IF OLD.lifecycle <> 'open'
    OR NEW.lifecycle <> 'completed'
    OR NEW.recurrence_occurrence_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.id = NEW.recurrence_definition_id
    AND definition.owner_id = NEW.owner_id
  FOR UPDATE;
  IF NOT FOUND OR _definition.status <> 'active' THEN
    RETURN NEW;
  END IF;
  SELECT revision.* INTO _revision
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = NEW.owner_id
    AND revision.recurrence_id = _definition.id
    AND revision.revision = _definition.current_revision;
  IF _revision.rule_mode <> 'after_completion' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _occurrence_count
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = NEW.owner_id
    AND occurrence.recurrence_id = _definition.id;
  IF _revision.end_mode = 'after'
    AND _occurrence_count >= _revision.end_after_count THEN
    RETURN NEW;
  END IF;

  _scheduled_date := tasks_private.add_recurrence_interval(
    (
      NEW.completed_at
      AT TIME ZONE _revision.planning_timezone
    )::date,
    _revision.frequency,
    _revision.interval_count,
    1
  );
  IF _revision.end_mode = 'on_date'
    AND _scheduled_date > _revision.end_on_date THEN
    RETURN NEW;
  END IF;

  PERFORM tasks_private.instantiate_recurrence_occurrence(
    NEW.owner_id,
    _definition,
    _revision,
    _scheduled_date,
    'after:' || NEW.recurrence_occurrence_id::text,
    NEW.recurrence_occurrence_id,
    _entry_channel,
    _actor_type
  );
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.advance_after_completion_recurrence()
FROM PUBLIC, anon, authenticated;

-- Retained terminal tasks remain editable. Lifecycle and hierarchy recovery
-- still require their dedicated transition paths and constraints.
CREATE OR REPLACE FUNCTION tasks_private.prepare_todo_update_v8()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _history_source public.tasks_history_events;
  _source_before jsonb;
  _source_after jsonb;
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Task identifier is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Task owner is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Task creation time is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.entry_channel IS DISTINCT FROM OLD.entry_channel THEN
    RAISE EXCEPTION 'Task entry channel is immutable' USING ERRCODE = '23514';
  END IF;
  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Task owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Task revision must increment by exactly one'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.client_mutation_id = OLD.client_mutation_id THEN
    RAISE EXCEPTION 'Task updates require a new client mutation identifier'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.undo_source_event_id IS NOT NULL
    AND NEW.undo_source_event_id IS NOT DISTINCT FROM OLD.undo_source_event_id THEN
    SELECT event.* INTO _history_source
    FROM public.tasks_history_events AS event
    WHERE event.id = NEW.undo_source_event_id
      AND event.owner_id = NEW.owner_id
      AND event.task_id = NEW.id;

    _source_before := tasks_private.normalize_todo_snapshot_v7(
      _history_source.before_state
    );
    _source_after := tasks_private.normalize_todo_snapshot_v7(
      _history_source.after_state
    );

    IF NOT FOUND
      OR _history_source.transition IN (
        'baseline', 'create', 'undo', 'redo'
      )
      OR NOT (
        (
          tasks_private.todo_snapshot_v7(OLD)
            IS NOT DISTINCT FROM _source_after
          AND tasks_private.todo_snapshot_v7(NEW)
            IS NOT DISTINCT FROM _source_before
        )
        OR (
          tasks_private.todo_snapshot_v7(OLD)
            IS NOT DISTINCT FROM _source_before
          AND tasks_private.todo_snapshot_v7(NEW)
            IS NOT DISTINCT FROM _source_after
        )
      ) THEN
      NEW.undo_source_event_id := NULL;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;
