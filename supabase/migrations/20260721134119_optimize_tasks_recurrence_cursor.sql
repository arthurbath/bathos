-- Derive calendar recurrence bounds from the durable evaluation cursor instead
-- of walking every interval from the original start date on each request.

CREATE OR REPLACE FUNCTION tasks_private.first_recurrence_step_after(
  _start_date date,
  _frequency text,
  _interval_count integer,
  _after_date date
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _step integer;
  _candidate date;
  _adjustments integer := 0;
BEGIN
  IF _interval_count < 1
    OR _frequency NOT IN ('daily', 'weekly', 'monthly', 'yearly') THEN
    RAISE EXCEPTION 'Recurrence interval input is invalid' USING ERRCODE = '22023';
  END IF;
  IF _after_date < _start_date THEN
    RETURN 0;
  END IF;

  _step := CASE _frequency
    WHEN 'daily' THEN ((_after_date - _start_date) / _interval_count)
    WHEN 'weekly' THEN ((_after_date - _start_date) / (7 * _interval_count))
    WHEN 'monthly' THEN (
      (
        (date_part('year', _after_date)::integer - date_part('year', _start_date)::integer) * 12
        + date_part('month', _after_date)::integer
        - date_part('month', _start_date)::integer
      ) / _interval_count
    )
    ELSE (
      (date_part('year', _after_date)::integer - date_part('year', _start_date)::integer)
      / _interval_count
    )
  END;
  _step := greatest(_step, 0);

  LOOP
    _candidate := tasks_private.add_recurrence_interval(
      _start_date,
      _frequency,
      _interval_count,
      _step
    );
    EXIT WHEN _candidate <= _after_date;
    EXIT WHEN _step = 0;
    _step := _step - 1;
    _adjustments := _adjustments + 1;
    IF _adjustments > 8 THEN
      RAISE EXCEPTION 'Recurrence cursor adjustment exceeded its safety bound'
        USING ERRCODE = '54000';
    END IF;
  END LOOP;

  LOOP
    _candidate := tasks_private.add_recurrence_interval(
      _start_date,
      _frequency,
      _interval_count,
      _step
    );
    EXIT WHEN _candidate > _after_date;
    _step := _step + 1;
    _adjustments := _adjustments + 1;
    IF _adjustments > 8 THEN
      RAISE EXCEPTION 'Recurrence cursor adjustment exceeded its safety bound'
        USING ERRCODE = '54000';
    END IF;
  END LOOP;

  RETURN _step;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.first_recurrence_step_after(
  date, text, integer, date
) FROM PUBLIC, anon, authenticated;

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
  _first_step integer;
  _last_step integer;
  _due_count integer := 0;
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
    RAISE EXCEPTION 'Recurrence evaluation input is invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_owner_id::text || E'\x1f' || _request_id::text, 0)
  );
  SELECT evaluation.* INTO _existing
  FROM public.tasks_recurrence_evaluations AS evaluation
  WHERE evaluation.id = _request_id AND evaluation.owner_id = _owner_id;
  IF FOUND THEN
    IF _existing.recurrence_id IS DISTINCT FROM _recurrence_id
      OR _existing.through_date IS DISTINCT FROM _through_date THEN
      RAISE EXCEPTION 'The request identifier belongs to a different recurrence evaluation'
        USING ERRCODE = '23505';
    END IF;
    RETURN _existing.result || jsonb_build_object('outcome', 'already_applied');
  END IF;

  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.id = _recurrence_id AND definition.owner_id = _owner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The recurrence definition is unavailable' USING ERRCODE = '22023';
  END IF;
  SELECT revision.* INTO _revision
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.recurrence_id = _definition.id
    AND revision.revision = _definition.current_revision;

  IF _definition.status = 'active' THEN
    IF _revision.rule_mode = 'after_completion' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.tasks_recurrence_occurrences AS occurrence
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
      _first_step := CASE
        WHEN _definition.evaluated_through_date IS NULL
          OR _definition.evaluated_through_date < _revision.start_date THEN 0
        ELSE tasks_private.first_recurrence_step_after(
          _revision.start_date,
          _revision.frequency,
          _revision.interval_count,
          _definition.evaluated_through_date
        )
      END;
      _last_step := tasks_private.first_recurrence_step_after(
        _revision.start_date,
        _revision.frequency,
        _revision.interval_count,
        _through_date
      ) - 1;

      IF _last_step >= _first_step THEN
        _due_count := _last_step - _first_step + 1;
        IF _revision.missed_policy = 'all' THEN
          IF _due_count > _revision.catch_up_limit THEN
            RAISE EXCEPTION 'Recurrence catch-up exceeds its safety limit'
              USING ERRCODE = '54000';
          END IF;
          FOR _step IN _first_step.._last_step LOOP
            _selected_dates := array_append(
              _selected_dates,
              tasks_private.add_recurrence_interval(
                _revision.start_date,
                _revision.frequency,
                _revision.interval_count,
                _step
              )
            );
          END LOOP;
        ELSE
          _candidate := tasks_private.add_recurrence_interval(
            _revision.start_date,
            _revision.frequency,
            _revision.interval_count,
            _last_step
          );
          IF _revision.missed_policy = 'latest'
            OR (_revision.missed_policy = 'skip' AND _candidate = _through_date) THEN
            _selected_dates := ARRAY[_candidate];
          END IF;
        END IF;
      END IF;
    END IF;

    FOREACH _candidate IN ARRAY _selected_dates LOOP
      _occurrence := tasks_private.instantiate_recurrence_occurrence(
        _owner_id, _definition, _revision, _candidate,
        CASE WHEN _revision.rule_mode = 'calendar'
          THEN 'calendar:' || _candidate::text
          ELSE 'initial:' || _candidate::text END,
        NULL, _entry_channel, _actor_type
      );
      _occurrence_ids := _occurrence_ids || jsonb_build_array(_occurrence.id);
    END LOOP;
    UPDATE public.tasks_recurrence_definitions
    SET evaluated_through_date = greatest(
          COALESCE(evaluated_through_date, _through_date), _through_date
        ),
        record_revision = record_revision + 1,
        last_mutation_channel = _entry_channel,
        last_actor_type = _actor_type,
        client_mutation_id = _request_id
    WHERE id = _definition.id AND owner_id = _owner_id
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
    id, owner_id, recurrence_id, through_date, result, client_mutation_id
  ) VALUES (
    _request_id, _owner_id, _definition.id, _through_date, _result, _request_id
  );
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_evaluate_recurrence(
  uuid, date, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_evaluate_recurrence(
  uuid, date, uuid, text, text
) TO authenticated;
