-- Explicit yearly recurrence patterns.
-- Canonicalized to the production migration ledger version.
-- No table is added, so the exact 20-table PowerSync publication is unchanged.

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
  _month_step integer;
  _matched_months integer;
  _year_step integer;
  _matched_years integer;
  _year integer;
  _type_count integer;
  _day integer;
  _ordinal integer;
  _weekday integer;
  _day_type text;
  _first_weekday integer;
  _last_day integer;
BEGIN
  IF _step < 0 THEN
    RAISE EXCEPTION 'Recurrence step is invalid' USING ERRCODE = '22023';
  END IF;
  IF _revision.end_mode = 'after' AND _step >= _revision.end_after_count THEN
    RETURN NULL;
  END IF;

  IF _revision.frequency = 'daily' THEN
    _candidate := tasks_private.add_recurrence_interval(
      _revision.start_date, _revision.frequency, _revision.interval_count, _step
    );
  ELSIF _revision.frequency = 'yearly' THEN
    _matched_years := -1;
    FOR _year_step IN 0..1200 LOOP
      _candidate := NULL;
      _year := extract(year FROM _revision.start_date)::integer
        + (_revision.interval_count * _year_step);
      _day := COALESCE(
        (_revision.rule_config ->> 'month')::integer,
        extract(month FROM _revision.start_date)::integer
      );
      IF _day NOT BETWEEN 1 AND 12 THEN
        RAISE EXCEPTION 'Yearly recurrence month is invalid'
          USING ERRCODE = '22023';
      END IF;
      _month := make_date(_year, _day, 1);
      _last_day := extract(day FROM (_month + interval '1 month - 1 day'))::integer;

      IF _revision.rule_config ->> 'yearly_kind' = 'last_day' THEN
        _candidate := _month + (_last_day - 1);
      ELSIF _revision.rule_config ->> 'yearly_kind' = 'ordinal_weekday' THEN
        _ordinal := COALESCE((_revision.rule_config ->> 'ordinal')::integer, 1);
        _weekday := COALESCE(
          (_revision.rule_config ->> 'weekday')::integer,
          extract(isodow FROM _revision.start_date)::integer
        );
        IF _ordinal NOT IN (-1, 1, 2, 3, 4, 5)
          OR _weekday NOT BETWEEN 1 AND 7 THEN
          RAISE EXCEPTION 'Yearly recurrence pattern is invalid'
            USING ERRCODE = '22023';
        END IF;
        IF _ordinal = -1 THEN
          _candidate := _month + (_last_day - 1);
          _candidate := _candidate
            - ((extract(isodow FROM _candidate)::integer - _weekday + 7) % 7);
        ELSE
          _first_weekday := extract(isodow FROM _month)::integer;
          _day := 1 + ((_weekday - _first_weekday + 7) % 7) + ((_ordinal - 1) * 7);
          IF _day <= _last_day THEN
            _candidate := _month + (_day - 1);
          END IF;
        END IF;
      ELSE
        _day := COALESCE(
          (_revision.rule_config ->> 'month_day')::integer,
          extract(day FROM _revision.start_date)::integer
        );
        _candidate := _month + (least(greatest(_day, 1), _last_day) - 1);
      END IF;

      IF _candidate IS NULL OR _candidate < _revision.start_date THEN
        CONTINUE;
      END IF;
      _matched_years := _matched_years + 1;
      EXIT WHEN _matched_years = _step;
    END LOOP;
    IF _matched_years < _step THEN RETURN NULL; END IF;
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
    _matched_months := -1;
    FOR _month_step IN 0..1200 LOOP
      _candidate := NULL;
      _month := (
        date_trunc('month', _revision.start_date)::date
        + make_interval(months => _revision.interval_count * _month_step)
      )::date;
      _last_day := extract(day FROM (_month + interval '1 month - 1 day'))::integer;
      IF _revision.rule_config ->> 'monthly_kind' = 'last_day' THEN
        _candidate := _month + (_last_day - 1);
      ELSIF _revision.rule_config ->> 'monthly_kind' = 'ordinal_weekday' THEN
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
          IF _day <= _last_day THEN
            _candidate := _month + (_day - 1);
          END IF;
        END IF;
      ELSIF _revision.rule_config ->> 'monthly_kind' = 'ordinal_day_type' THEN
        _ordinal := COALESCE((_revision.rule_config ->> 'ordinal')::integer, 1);
        _day_type := COALESCE(_revision.rule_config ->> 'day_type', 'weekday');
        IF _ordinal NOT IN (-1, 1, 2, 3, 4, 5)
          OR _day_type NOT IN ('weekday', 'weekend_day') THEN
          RAISE EXCEPTION 'Monthly recurrence pattern is invalid'
            USING ERRCODE = '22023';
        END IF;
        _type_count := 0;
        IF _ordinal = -1 THEN
          FOR _day IN REVERSE _last_day..1 LOOP
            _candidate := _month + (_day - 1);
            IF (
              (_day_type = 'weekday' AND extract(isodow FROM _candidate)::integer <= 5)
              OR (
                _day_type = 'weekend_day'
                AND extract(isodow FROM _candidate)::integer >= 6
              )
            ) THEN
              EXIT;
            END IF;
          END LOOP;
        ELSE
          FOR _day IN 1.._last_day LOOP
            _candidate := _month + (_day - 1);
            IF (
              (_day_type = 'weekday' AND extract(isodow FROM _candidate)::integer <= 5)
              OR (
                _day_type = 'weekend_day'
                AND extract(isodow FROM _candidate)::integer >= 6
              )
            ) THEN
              _type_count := _type_count + 1;
              EXIT WHEN _type_count = _ordinal;
            END IF;
          END LOOP;
          IF _type_count < _ordinal THEN
            _candidate := NULL;
          END IF;
        END IF;
      ELSE
        _day := COALESCE(
          (_revision.rule_config ->> 'month_day')::integer,
          extract(day FROM _revision.start_date)::integer
        );
        _candidate := _month + (least(greatest(_day, 1), _last_day) - 1);
      END IF;

      IF _candidate IS NULL OR _candidate < _revision.start_date THEN
        CONTINUE;
      END IF;
      _matched_months := _matched_months + 1;
      EXIT WHEN _matched_months = _step;
    END LOOP;
    IF _matched_months < _step THEN RETURN NULL; END IF;
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
