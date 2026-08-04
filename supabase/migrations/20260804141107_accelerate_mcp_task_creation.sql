CREATE OR REPLACE FUNCTION public.tasks_create_mcp_task(
  _idempotency_key uuid,
  _title text,
  _notes text,
  _destination text,
  _requested_today_section text,
  _actionability text,
  _entry_channel text,
  _requested_start_date date,
  _placement_was_implicit boolean,
  _deadline date,
  _area_id uuid,
  _source_kind text,
  _source_url text,
  _source_title text,
  _source_external_id text,
  _primary_link text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _task public.tasks_todos;
  _event public.tasks_history_events;
  _planning_timezone text;
  _planning_date date;
  _start_date date;
  _today_section text;
  _last_order_key text;
  _last_hierarchy_order_key text;
  _order_key text;
  _hierarchy_order_key text;
  _timestamp timestamptz := clock_timestamp();
  _order_inputs text[];
  _order_outputs text[] := ARRAY[NULL::text, NULL::text];
  _current_key text;
  _computed_key text;
  _digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  _heads constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  _head text;
  _head_index integer;
  _half constant integer := char_length(_heads) / 2;
  _integer_length integer;
  _integer_part text;
  _fraction_part text;
  _digit_index integer;
  _next_head text;
  _next_length integer;
  _trailing text;
  _prefix text;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create Tasks work'
      USING ERRCODE = '42501';
  END IF;
  IF _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Task creation requires an idempotency key'
      USING ERRCODE = '22023';
  END IF;

  _title := btrim(COALESCE(_title, ''));
  _notes := COALESCE(_notes, '');
  _source_url := NULLIF(btrim(_source_url), '');
  _source_title := NULLIF(btrim(_source_title), '');
  _source_external_id := NULLIF(btrim(_source_external_id), '');
  _primary_link := NULLIF(btrim(_primary_link), '');

  IF _title = '' OR char_length(_title) > 500 THEN
    RAISE EXCEPTION 'Task title is required and cannot exceed 500 characters'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(_notes) > 100000 THEN
    RAISE EXCEPTION 'Task notes cannot exceed 100000 characters'
      USING ERRCODE = '22023';
  END IF;
  IF _destination NOT IN ('anytime', 'someday') THEN
    RAISE EXCEPTION 'Task destination is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF _requested_today_section IS NOT NULL
    AND _requested_today_section NOT IN ('inbox', 'now', 'next', 'later') THEN
    RAISE EXCEPTION 'Task Today horizon is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF _actionability NOT IN ('actionable', 'waiting', 'rechecking') THEN
    RAISE EXCEPTION 'Task actionability is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF _entry_channel NOT IN (
    'mcp', 'raycast', 'browser_capture', 'mail_automation', 'native'
  ) THEN
    RAISE EXCEPTION 'Task entry channel is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF _placement_was_implicit IS NULL THEN
    RAISE EXCEPTION 'Task placement identity is required'
      USING ERRCODE = '22023';
  END IF;
  IF _destination = 'someday'
    AND (_requested_today_section IS NOT NULL OR _requested_start_date IS NOT NULL) THEN
    RAISE EXCEPTION 'Someday work cannot retain a Start or day horizon'
      USING ERRCODE = '22023';
  END IF;
  IF _placement_was_implicit
    AND (
      _destination <> 'anytime'
      OR _requested_today_section IS NOT NULL
      OR _requested_start_date IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Implicit task placement is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF _source_kind IS NOT NULL
    AND _source_kind NOT IN (
      'webpage', 'mail_message', 'file', 'reading_item', 'other'
    ) THEN
    RAISE EXCEPTION 'Task source kind is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF _source_kind IS NULL
    AND (
      _source_url IS NOT NULL
      OR _source_title IS NOT NULL
      OR _source_external_id IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Task source fields require a source kind'
      USING ERRCODE = '22023';
  END IF;
  IF _source_kind IN ('webpage', 'reading_item')
    AND (
      _source_url IS NULL
      OR _source_url !~* '^https?://[^[:space:]]+$'
    ) THEN
    RAISE EXCEPTION 'Webpage and reading-item sources require a valid HTTP or HTTPS URL'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(_source_url, '')) > 8000
    OR char_length(COALESCE(_primary_link, '')) > 8000
    OR char_length(COALESCE(_source_title, '')) > 1000
    OR char_length(COALESCE(_source_external_id, '')) > 2000 THEN
    RAISE EXCEPTION 'Task source or Primary Link exceeds its maximum length'
      USING ERRCODE = '22023';
  END IF;

  _start_date := CASE
    WHEN _destination = 'someday' THEN NULL
    ELSE _requested_start_date
  END;
  _today_section := CASE
    WHEN _destination = 'someday' OR _start_date IS NOT NULL THEN NULL
    WHEN _placement_was_implicit THEN 'next'
    ELSE _requested_today_section
  END;

  IF _start_date IS NOT NULL THEN
    SELECT settings.planning_timezone
    INTO _planning_timezone
    FROM public.tasks_user_settings AS settings
    WHERE settings.owner_id = _owner_id;
    IF _planning_timezone IS NULL THEN
      RAISE EXCEPTION 'Task planning settings are not initialized. Open the Tasks module once.'
        USING ERRCODE = '22023';
    END IF;
    _planning_date := (_timestamp AT TIME ZONE _planning_timezone)::date;
    IF _start_date <= _planning_date THEN
      RAISE EXCEPTION 'Start must be later than today in the owner planning time zone'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      _owner_id::text || E'\x1fcreate\x1f' || _idempotency_key::text,
      0
    )
  );

  SELECT event.* INTO _event
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id
    AND event.client_mutation_id = _idempotency_key
    AND event.transition = 'create';

  IF _event.id IS NOT NULL THEN
    IF _event.after_state ->> 'title' IS DISTINCT FROM _title
      OR _event.after_state ->> 'notes' IS DISTINCT FROM _notes
      OR _event.after_state ->> 'destination' IS DISTINCT FROM _destination
      OR _event.after_state ->> 'today_section' IS DISTINCT FROM _today_section
      OR _event.after_state ->> 'actionability' IS DISTINCT FROM _actionability
      OR _event.mutation_channel IS DISTINCT FROM _entry_channel
      OR _event.after_state ->> 'start_date'
        IS DISTINCT FROM _start_date::text
      OR _event.after_state ->> 'deadline'
        IS DISTINCT FROM _deadline::text
      OR _event.after_state ->> 'area_id'
        IS DISTINCT FROM _area_id::text
      OR _event.after_state ->> 'source_kind' IS DISTINCT FROM _source_kind
      OR _event.after_state ->> 'source_url' IS DISTINCT FROM _source_url
      OR _event.after_state ->> 'source_title' IS DISTINCT FROM _source_title
      OR _event.after_state ->> 'source_external_id'
        IS DISTINCT FROM _source_external_id
      OR _event.after_state ->> 'primary_link' IS DISTINCT FROM _primary_link THEN
      RAISE EXCEPTION
        'The idempotency key was already used for a different task creation request'
        USING ERRCODE = '23505';
    END IF;

    SELECT task.* INTO _task
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id
      AND task.id = _event.task_id;
    IF _task.id IS NULL THEN
      RAISE EXCEPTION 'The idempotent task creation record is unavailable'
        USING ERRCODE = '55000';
    END IF;

    RETURN jsonb_build_object(
      'idempotency_outcome', 'already_applied',
      'receipt', jsonb_build_object(
        'client_mutation_id', _event.client_mutation_id,
        'actor_type', _event.actor_type,
        'mutation_channel', _event.mutation_channel,
        'affected_ids', _event.affected_ids,
        'base_revision', _event.base_revision,
        'result_revision', _event.result_revision,
        'transition', _event.transition,
        'occurred_at', _event.occurred_at,
        'outcome', _event.outcome,
        'code', NULL
      ),
      'task', to_jsonb(_task) - 'owner_id'
    );
  END IF;

  IF _area_id IS NOT NULL THEN
    PERFORM 1
    FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id
      AND area.id = _area_id
      AND area.disposition = 'present';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The task area is unavailable'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      _owner_id::text || E'\x1fplanning\x1f' || _destination,
      0
    )
  );
  IF _area_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        _owner_id::text || E'\x1fhierarchy\x1f' || _area_id::text,
        0
      )
    );
  END IF;

  SELECT task.order_key INTO _last_order_key
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id
    AND task.destination = _destination
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
  ORDER BY task.order_key COLLATE "C" DESC, task.id DESC
  LIMIT 1;

  IF _area_id IS NOT NULL THEN
    SELECT task.hierarchy_order_key INTO _last_hierarchy_order_key
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id
      AND task.area_id = _area_id
      AND task.lifecycle = 'open'
      AND task.disposition = 'present'
      AND task.hierarchy_order_key IS NOT NULL
    ORDER BY task.hierarchy_order_key COLLATE "C" DESC, task.id DESC
    LIMIT 1;
  END IF;

  _order_inputs := ARRAY[_last_order_key, _last_hierarchy_order_key];
  FOR _order_index IN 1..2 LOOP
    IF _order_index = 2 AND _area_id IS NULL THEN
      CONTINUE;
    END IF;
    _current_key := _order_inputs[_order_index];
    IF _current_key IS NULL THEN
      _order_outputs[_order_index] := 'a0';
      CONTINUE;
    END IF;

    _head := left(_current_key, 1);
    _head_index := strpos(_heads, _head) - 1;
    IF _head_index < 0 THEN
      RAISE EXCEPTION 'The stored task order key is invalid'
        USING ERRCODE = '23514';
    END IF;
    _integer_length := CASE
      WHEN _head_index < _half THEN _half - _head_index + 1
      ELSE _head_index - _half + 2
    END;
    IF char_length(_current_key) < _integer_length THEN
      RAISE EXCEPTION 'The stored task order key is invalid'
        USING ERRCODE = '23514';
    END IF;

    _integer_part := left(_current_key, _integer_length);
    _fraction_part := substring(_current_key FROM _integer_length + 1);
    _computed_key := NULL;
    _trailing := '';
    FOR _position IN REVERSE _integer_length..2 LOOP
      _digit_index := strpos(
        _digits,
        substring(_integer_part FROM _position FOR 1)
      ) - 1;
      IF _digit_index < 0 THEN
        RAISE EXCEPTION 'The stored task order key is invalid'
          USING ERRCODE = '23514';
      END IF;
      IF _digit_index + 1 < char_length(_digits) THEN
        _computed_key := _head
          || substring(_integer_part FROM 2 FOR _position - 2)
          || substring(_digits FROM _digit_index + 2 FOR 1)
          || _trailing;
        EXIT;
      END IF;
      _trailing := '0' || _trailing;
    END LOOP;

    IF _computed_key IS NULL AND _head_index + 1 < char_length(_heads) THEN
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
      _computed_key := _next_head || _trailing;
    END IF;

    IF _computed_key IS NULL THEN
      _prefix := '';
      LOOP
        _digit_index := CASE
          WHEN _fraction_part = '' THEN 0
          ELSE strpos(_digits, left(_fraction_part, 1)) - 1
        END;
        IF _digit_index < 0 THEN
          RAISE EXCEPTION 'The stored task order key is invalid'
            USING ERRCODE = '23514';
        END IF;
        IF char_length(_digits) - _digit_index > 1 THEN
          _computed_key := _integer_part
            || _prefix
            || substring(
              _digits
              FROM floor(
                (_digit_index + char_length(_digits) + 1) / 2.0
              )::integer + 1
              FOR 1
            );
          EXIT;
        END IF;
        _prefix := _prefix || left(_fraction_part, 1);
        _fraction_part := substring(_fraction_part FROM 2);
      END LOOP;
    END IF;
    _order_outputs[_order_index] := _computed_key;
  END LOOP;

  _order_key := _order_outputs[1];
  _hierarchy_order_key := _order_outputs[2];

  INSERT INTO public.tasks_todos (
    id, owner_id, area_id, title, notes, lifecycle, completed_at,
    canceled_at, disposition, deleted_at, deletion_root_id, destination,
    today_section, actionability, order_key, hierarchy_order_key, start_date,
    deadline, entry_channel, last_mutation_channel, last_actor_type,
    undo_source_event_id, source_kind, source_url, source_title,
    source_external_id, primary_link, revision, client_mutation_id,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), _owner_id, _area_id, _title, _notes, 'open', NULL,
    NULL, 'present', NULL, NULL, _destination, _today_section, _actionability,
    _order_key, _hierarchy_order_key, _start_date, _deadline, _entry_channel,
    _entry_channel, 'automation', NULL, _source_kind, _source_url,
    _source_title, _source_external_id, _primary_link, 1,
    _idempotency_key, _timestamp, _timestamp
  )
  RETURNING * INTO _task;

  SELECT event.* INTO _event
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id
    AND event.task_id = _task.id
    AND event.client_mutation_id = _idempotency_key
    AND event.transition = 'create';
  IF _event.id IS NULL THEN
    RAISE EXCEPTION 'The accepted task creation receipt is unavailable'
      USING ERRCODE = '55000';
  END IF;

  RETURN jsonb_build_object(
    'idempotency_outcome', 'created',
    'receipt', jsonb_build_object(
      'client_mutation_id', _event.client_mutation_id,
      'actor_type', _event.actor_type,
      'mutation_channel', _event.mutation_channel,
      'affected_ids', _event.affected_ids,
      'base_revision', _event.base_revision,
      'result_revision', _event.result_revision,
      'transition', _event.transition,
      'occurred_at', _event.occurred_at,
      'outcome', _event.outcome,
      'code', NULL
    ),
    'task', to_jsonb(_task) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_mcp_task(
  uuid, text, text, text, text, text, text, date, boolean, date, uuid,
  text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.tasks_create_mcp_task(
  uuid, text, text, text, text, text, text, date, boolean, date, uuid,
  text, text, text, text, text
) TO authenticated;
