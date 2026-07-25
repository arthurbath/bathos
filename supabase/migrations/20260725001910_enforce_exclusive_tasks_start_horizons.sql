-- Treat a future Start and a Today horizon as mutually exclusive planning
-- states. Reached Starts activate into Today Next.

ALTER TABLE public.tasks_todos
  DROP CONSTRAINT tasks_todos_planning_placement_valid;

ALTER TABLE public.tasks_projects
  DROP CONSTRAINT tasks_projects_planning_placement_valid;

-- Close the race between release preflight and migration execution by activating
-- any open present Starts that reached their owner-local date in that interval.
SELECT tasks_private.activate_due_roots(clock_timestamp(), NULL);

CREATE OR REPLACE FUNCTION tasks_private.normalize_root_planning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _planning_date date;
BEGIN
  IF NEW.destination = 'someday' THEN
    NEW.start_date := NULL;
    NEW.today_section := NULL;
    RETURN NEW;
  END IF;

  IF NEW.start_date IS NOT NULL THEN
    -- Retained terminal history may contain the Start that was meaningful when
    -- the work was active. Future-only validation governs active present work,
    -- while every state still enforces Start/horizon exclusivity.
    IF NEW.lifecycle = 'open' AND NEW.disposition = 'present' THEN
      SELECT (clock_timestamp() AT TIME ZONE COALESCE(settings.planning_timezone, 'UTC'))::date
      INTO _planning_date
      FROM public.tasks_user_settings AS settings
      WHERE settings.owner_id = NEW.owner_id;
      _planning_date := COALESCE(
        _planning_date,
        (clock_timestamp() AT TIME ZONE 'UTC')::date
      );
      IF NEW.start_date <= _planning_date THEN
        RAISE EXCEPTION 'Start must be later than today in the owner planning time zone'
          USING ERRCODE = '22023';
      END IF;
    END IF;
    NEW.today_section := NULL;
  ELSIF NEW.today_section IS NOT NULL THEN
    NEW.start_date := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_root_planning()
FROM PUBLIC, anon, authenticated;

UPDATE public.tasks_todos AS task
SET today_section = NULL,
    revision = task.revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'native',
    last_actor_type = 'system',
    undo_source_event_id = NULL,
    updated_at = clock_timestamp()
WHERE task.start_date IS NOT NULL
  AND task.today_section IS NOT NULL;

UPDATE public.tasks_projects AS project
SET today_section = NULL,
    revision = project.revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'native',
    last_actor_type = 'system',
    updated_at = clock_timestamp()
WHERE project.start_date IS NOT NULL
  AND project.today_section IS NOT NULL;

ALTER TABLE public.tasks_todos
  ADD CONSTRAINT tasks_todos_planning_placement_valid CHECK (
    (destination = 'someday' AND start_date IS NULL AND today_section IS NULL)
    OR
    (
      destination = 'anytime'
      AND NOT (start_date IS NOT NULL AND today_section IS NOT NULL)
    )
  );

ALTER TABLE public.tasks_projects
  ADD CONSTRAINT tasks_projects_planning_placement_valid CHECK (
    (destination = 'someday' AND start_date IS NULL AND today_section IS NULL)
    OR
    (
      destination = 'anytime'
      AND NOT (start_date IS NOT NULL AND today_section IS NOT NULL)
    )
  );

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
  _todo_count integer := 0;
  _project_count integer := 0;
BEGIN
  PERFORM set_config('garden.bath.tasks_activation', 'on', true);

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
    'activated_todos', _todo_count,
    'activated_projects', _project_count,
    'evaluated_at', _now
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.activate_due_roots(timestamptz, uuid)
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_snapshot_v7(_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _destination text;
  _start_date text;
  _today_section text;
  _primary_link text;
BEGIN
  IF _snapshot IS NULL OR _snapshot = 'null'::jsonb THEN
    RETURN NULL;
  END IF;
  _destination := CASE
    WHEN _snapshot ->> 'destination' IN ('inbox', 'today') THEN 'anytime'
    ELSE COALESCE(_snapshot ->> 'destination', 'anytime')
  END;
  _start_date := _snapshot ->> 'start_date';
  _today_section := CASE _snapshot ->> 'today_section'
    WHEN 'inbox' THEN 'inbox'
    WHEN 'now' THEN 'now'
    WHEN 'next' THEN 'next'
    WHEN 'later' THEN 'later'
    WHEN 'evening' THEN 'later'
    ELSE NULL
  END;
  IF _destination = 'someday' THEN
    _start_date := NULL;
    _today_section := NULL;
  ELSIF _start_date IS NOT NULL THEN
    _today_section := NULL;
  END IF;
  _primary_link := NULLIF(btrim(_snapshot ->> 'primary_link'), '');
  RETURN jsonb_build_object(
    'title', _snapshot -> 'title',
    'notes', COALESCE(_snapshot -> 'notes', '""'::jsonb),
    'lifecycle', COALESCE(_snapshot -> 'lifecycle', '"open"'::jsonb),
    'completed_at', _snapshot -> 'completed_at',
    'canceled_at', _snapshot -> 'canceled_at',
    'disposition', COALESCE(_snapshot -> 'disposition', '"present"'::jsonb),
    'deleted_at', _snapshot -> 'deleted_at',
    'deletion_root_id', _snapshot -> 'deletion_root_id',
    'destination', to_jsonb(_destination),
    'today_section', to_jsonb(_today_section),
    'order_key', _snapshot -> 'order_key',
    'area_id', _snapshot -> 'area_id',
    'project_id', _snapshot -> 'project_id',
    'hierarchy_order_key', _snapshot -> 'hierarchy_order_key',
    'start_date', to_jsonb(_start_date),
    'deadline', _snapshot -> 'deadline',
    'source_kind', COALESCE(_snapshot -> 'source_kind', '"manual"'::jsonb),
    'source_url', _snapshot -> 'source_url',
    'source_title', _snapshot -> 'source_title',
    'source_external_id', _snapshot -> 'source_external_id',
    'primary_link', to_jsonb(_primary_link),
    'actionability', to_jsonb(COALESCE(_snapshot ->> 'actionability', 'actionable'))
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_todo_snapshot_v7(jsonb)
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
      _horizon := 'next';
    ELSIF _start_date IS NOT NULL THEN
      _horizon := NULL;
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
    _normalized := _normalized || jsonb_build_object(
      'primary_link',
      to_jsonb(_primary_link)
    );
  END IF;
  RETURN _normalized;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_export_v12_record(text, jsonb, date)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v12(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _records jsonb;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export'
    OR _envelope ->> 'schema_version' IS DISTINCT FROM '12'
    OR _envelope #> '{manifest,collections}' IS DISTINCT FROM to_jsonb(_collections)
    OR _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256' THEN
    RAISE EXCEPTION 'Task export v12 manifest is invalid' USING ERRCODE = '22023';
  END IF;
  FOREACH _collection IN ARRAY _collections LOOP
    _records := _envelope #> ARRAY['data', _collection];
    IF jsonb_typeof(_records) IS DISTINCT FROM 'array'
      OR (_envelope #>> ARRAY['manifest', 'counts', _collection])::integer
        <> jsonb_array_length(_records)
      OR _envelope #>> ARRAY['manifest', 'checksums', _collection]
        IS DISTINCT FROM tasks_private.export_checksum(_records) THEN
      RAISE EXCEPTION 'Task export v12 collection % is invalid', _collection
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS item(value)
    WHERE item.value ? 'heading_id'
      OR (item.value ->> 'actionability') NOT IN ('actionable', 'waiting', 'rechecking')
      OR char_length(COALESCE(item.value ->> 'primary_link', '')) > 8000
      OR (
        (item.value ->> 'start_date') IS NOT NULL
        AND (item.value ->> 'today_section') IS NOT NULL
      )
      OR (
        item.value ->> 'destination' = 'someday'
        AND (
          (item.value ->> 'start_date') IS NOT NULL
          OR (item.value ->> 'today_section') IS NOT NULL
        )
      )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_projects}') AS item(value)
    WHERE (
      (item.value ->> 'start_date') IS NOT NULL
      AND (item.value ->> 'today_section') IS NOT NULL
    ) OR (
      item.value ->> 'destination' = 'someday'
      AND (
        (item.value ->> 'start_date') IS NOT NULL
        OR (item.value ->> 'today_section') IS NOT NULL
      )
    )
  ) THEN
    RAISE EXCEPTION 'Task export v12 contains invalid planning data'
      USING ERRCODE = '22023';
  END IF;
  PERFORM tasks_private.validate_export_v10(
    tasks_private.export_v12_as_v10_for_validation(_envelope)
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v12(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.resolve_template_planning(
  _source_destination text,
  _source_today_section text,
  _start_offset_days integer,
  _deadline_offset_days integer,
  _anchor_date date,
  _planning_date date,
  _allow_inbox boolean
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _destination text := CASE
    WHEN _source_destination IN ('inbox', 'today') THEN 'anytime'
    ELSE _source_destination
  END;
  _today_section text := CASE
    WHEN _source_destination = 'inbox' THEN 'inbox'
    WHEN _source_destination = 'today' AND _source_today_section = 'evening' THEN 'later'
    WHEN _source_destination = 'today'
      AND _source_today_section IN ('inbox', 'now', 'next', 'later')
      THEN _source_today_section
    WHEN _source_destination = 'today' THEN 'next'
    WHEN _source_today_section IN ('inbox', 'now', 'next', 'later')
      THEN _source_today_section
    ELSE NULL
  END;
  _start_date date := CASE
    WHEN _start_offset_days IS NULL THEN NULL
    ELSE _anchor_date + _start_offset_days
  END;
  _deadline date := CASE
    WHEN _deadline_offset_days IS NULL THEN NULL
    ELSE _anchor_date + _deadline_offset_days
  END;
BEGIN
  PERFORM _allow_inbox;
  IF _destination = 'someday' THEN
    _start_date := NULL;
    _today_section := NULL;
  ELSIF _destination <> 'anytime' THEN
    RAISE EXCEPTION 'Template planning destination is invalid'
      USING ERRCODE = '22023';
  ELSIF _start_date IS NOT NULL AND _start_date <= _planning_date THEN
    _start_date := NULL;
    _today_section := 'next';
  ELSIF _start_date IS NOT NULL THEN
    _today_section := NULL;
  END IF;
  RETURN jsonb_build_object(
    'destination', _destination,
    'today_section', _today_section,
    'start_date', _start_date,
    'deadline', _deadline
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.resolve_template_planning(
  text, text, integer, integer, date, date, boolean
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_mail_capture(
  _idempotency_key uuid,
  _task_id uuid,
  _title text,
  _notes text,
  _start_date date,
  _order_key text,
  _hierarchy_order_key text,
  _account_identifier text,
  _mailbox_identifier text,
  _message_identifier text,
  _deep_link text,
  _retirement_destination_identifier text,
  _source_title text DEFAULT NULL,
  _area_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _task public.tasks_todos;
  _source public.tasks_mail_sources;
  _event public.tasks_history_events;
  _outcome text;
  _timestamp timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to capture Mail tasks'
      USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(_title), '') IS NULL OR char_length(btrim(_title)) > 500 THEN
    RAISE EXCEPTION 'Mail task title is required and cannot exceed 500 characters'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(_notes, '')) > 100000 THEN
    RAISE EXCEPTION 'Mail task notes cannot exceed 100000 characters'
      USING ERRCODE = '22023';
  END IF;
  IF _start_date IS NOT NULL THEN
    RAISE EXCEPTION 'Mail capture always starts in Today Inbox'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(_order_key), '') IS NULL OR char_length(_order_key) > 255 THEN
    RAISE EXCEPTION 'Mail capture requires a valid planning order key'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(_account_identifier), '') IS NULL
    OR NULLIF(btrim(_mailbox_identifier), '') IS NULL
    OR NULLIF(btrim(_message_identifier), '') IS NULL
    OR NULLIF(btrim(_deep_link), '') IS NULL
    OR _deep_link NOT LIKE 'message://%'
    OR NULLIF(btrim(_retirement_destination_identifier), '') IS NULL THEN
    RAISE EXCEPTION 'Mail capture requires complete structured source identity'
      USING ERRCODE = '22023';
  END IF;
  IF _area_id IS NULL AND _hierarchy_order_key IS NOT NULL THEN
    RAISE EXCEPTION 'Unassigned Mail capture cannot have hierarchy order'
      USING ERRCODE = '22023';
  END IF;
  IF _area_id IS NOT NULL AND NULLIF(btrim(_hierarchy_order_key), '') IS NULL THEN
    RAISE EXCEPTION 'Area-assigned Mail capture requires hierarchy order'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    _owner_id::text || E'\x1f' || btrim(_account_identifier)
      || E'\x1f' || btrim(_message_identifier), 0
  ));

  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id
    AND task.client_mutation_id = _idempotency_key;

  IF _task.id IS NOT NULL THEN
    SELECT source.* INTO _source
    FROM public.tasks_mail_sources AS source
    WHERE source.task_id = _task.id AND source.owner_id = _owner_id;
    IF _task.title IS DISTINCT FROM btrim(_title)
      OR _task.notes IS DISTINCT FROM COALESCE(_notes, '')
      OR _task.destination IS DISTINCT FROM 'anytime'
      OR _task.today_section IS DISTINCT FROM 'inbox'
      OR _task.start_date IS NOT NULL
      OR _task.area_id IS DISTINCT FROM _area_id
      OR _task.source_kind IS DISTINCT FROM 'mail_message'
      OR _task.source_url IS DISTINCT FROM _deep_link
      OR _task.source_title IS DISTINCT FROM NULLIF(btrim(_source_title), '')
      OR _task.source_external_id IS DISTINCT FROM btrim(_message_identifier)
      OR _source.account_identifier IS DISTINCT FROM btrim(_account_identifier)
      OR _source.mailbox_identifier IS DISTINCT FROM btrim(_mailbox_identifier)
      OR _source.deep_link IS DISTINCT FROM _deep_link
      OR _source.retirement_destination_identifier
        IS DISTINCT FROM btrim(_retirement_destination_identifier) THEN
      RAISE EXCEPTION 'The idempotency key belongs to a different Mail capture request'
        USING ERRCODE = '23505';
    END IF;
    _outcome := 'already_applied';
  ELSE
    SELECT source.* INTO _source
    FROM public.tasks_mail_sources AS source
    WHERE source.owner_id = _owner_id
      AND source.account_identifier = btrim(_account_identifier)
      AND source.message_identifier = btrim(_message_identifier);

    IF _source.task_id IS NOT NULL THEN
      SELECT task.* INTO _task
      FROM public.tasks_todos AS task
      WHERE task.id = _source.task_id AND task.owner_id = _owner_id;
      IF _source.mailbox_identifier IS DISTINCT FROM btrim(_mailbox_identifier)
        OR _source.deep_link IS DISTINCT FROM _deep_link
        OR _source.retirement_destination_identifier
          IS DISTINCT FROM btrim(_retirement_destination_identifier) THEN
        RAISE EXCEPTION 'The Mail message identity is already captured with different source data'
          USING ERRCODE = '23505';
      END IF;
      _outcome := 'source_already_applied';
    ELSE
      INSERT INTO public.tasks_todos (
        id, owner_id, area_id, project_id, title, notes,
        lifecycle, completed_at, canceled_at, disposition, deleted_at,
        deletion_root_id, destination, today_section, order_key,
        hierarchy_order_key, start_date, deadline, entry_channel,
        last_mutation_channel, last_actor_type, undo_source_event_id,
        source_kind, source_url, source_title, source_external_id,
        revision, client_mutation_id, created_at, updated_at
      ) VALUES (
        _task_id, _owner_id, _area_id, NULL, btrim(_title), COALESCE(_notes, ''),
        'open', NULL, NULL, 'present', NULL,
        NULL, 'anytime', 'inbox', _order_key,
        _hierarchy_order_key, NULL, NULL, 'mail_automation',
        'mail_automation', 'automation', NULL,
        'mail_message', _deep_link, NULLIF(btrim(_source_title), ''),
        btrim(_message_identifier), 1, _idempotency_key, _timestamp, _timestamp
      ) RETURNING * INTO _task;

      INSERT INTO public.tasks_mail_sources (
        task_id, owner_id, account_identifier, mailbox_identifier,
        message_identifier, deep_link, retirement_destination_identifier,
        lifecycle, retirement_attempted_at, retired_at, last_error_code,
        revision, client_mutation_id, created_at, updated_at
      ) VALUES (
        _task_id, _owner_id, btrim(_account_identifier), btrim(_mailbox_identifier),
        btrim(_message_identifier), _deep_link,
        btrim(_retirement_destination_identifier),
        'retained', NULL, NULL, NULL, 1, _idempotency_key, _timestamp, _timestamp
      ) RETURNING * INTO _source;
      _outcome := 'created';
    END IF;
  END IF;

  SELECT event.* INTO _event
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id
    AND event.task_id = _task.id
    AND event.transition = 'create'
  ORDER BY event.occurred_at, event.id
  LIMIT 1;

  RETURN jsonb_build_object(
    'idempotency_outcome', _outcome,
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
    'task', to_jsonb(_task) - 'owner_id',
    'mail_source', to_jsonb(_source) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_mail_capture(
  uuid, uuid, text, text, date, text, text, text, text, text, text, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_mail_capture(
  uuid, uuid, text, text, date, text, text, text, text, text, text, text, text, uuid
) TO authenticated;
