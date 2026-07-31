CREATE OR REPLACE FUNCTION tasks_private.next_task_order_key(_key text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
DECLARE
  _digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  _heads constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  _head text := left(_key, 1);
  _head_index integer := strpos(_heads, _head) - 1;
  _half integer := char_length(_heads) / 2;
  _integer_length integer;
  _integer_part text;
  _fraction_part text;
  _position integer;
  _digit_index integer;
  _next_head text;
  _next_length integer;
  _trailing text := '';
  _prefix text := '';
BEGIN
  IF _head_index < 0 THEN
    RAISE EXCEPTION 'The task order key head is invalid';
  END IF;
  _integer_length := CASE
    WHEN _head_index < _half THEN _half - _head_index + 1
    ELSE _head_index - _half + 2
  END;
  IF char_length(_key) < _integer_length THEN
    RAISE EXCEPTION 'The task order key is invalid';
  END IF;
  _integer_part := left(_key, _integer_length);
  _fraction_part := substring(_key FROM _integer_length + 1);

  FOR _position IN REVERSE _integer_length..2 LOOP
    _digit_index := strpos(
      _digits,
      substring(_integer_part FROM _position FOR 1)
    ) - 1;
    IF _digit_index < 0 THEN
      RAISE EXCEPTION 'The task order key is invalid';
    END IF;
    IF _digit_index + 1 < char_length(_digits) THEN
      RETURN _head
        || substring(_integer_part FROM 2 FOR _position - 2)
        || substring(_digits FROM _digit_index + 2 FOR 1)
        || _trailing;
    END IF;
    _trailing := '0' || _trailing;
  END LOOP;

  IF _head_index + 1 < char_length(_heads) THEN
    _next_head := substring(_heads FROM _head_index + 2 FOR 1);
    _next_length := CASE
      WHEN _head_index + 1 < _half THEN _half - (_head_index + 1) + 1
      ELSE (_head_index + 1) - _half + 2
    END;
    IF _next_length > _integer_length THEN
      _trailing := _trailing || repeat('0', _next_length - _integer_length);
    ELSIF _next_length < _integer_length THEN
      _trailing := left(
        _trailing,
        char_length(_trailing) - (_integer_length - _next_length)
      );
    END IF;
    RETURN _next_head || _trailing;
  END IF;

  LOOP
    _digit_index := CASE
      WHEN _fraction_part = '' THEN 0
      ELSE strpos(_digits, left(_fraction_part, 1)) - 1
    END;
    IF _digit_index < 0 THEN
      RAISE EXCEPTION 'The task order key is invalid';
    END IF;
    IF char_length(_digits) - _digit_index > 1 THEN
      RETURN _integer_part
        || _prefix
        || substring(
          _digits
          FROM floor((_digit_index + char_length(_digits) + 1) / 2.0)::integer + 1
          FOR 1
        );
    END IF;
    _prefix := _prefix || left(_fraction_part, 1);
    _fraction_part := substring(_fraction_part FROM 2);
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.next_task_order_key(text)
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
        AND task.start_date IS NOT NULL
        AND task.start_date <= _planning_date
      ORDER BY task.start_date, task.order_key, task.id
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
