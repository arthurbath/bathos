-- Dedicated least-privilege authority for the native macOS Quick Entry panel.
-- Raw credentials are returned once by the Edge Function and are stored only
-- as SHA-256 hashes in the database.

CREATE TABLE tasks_private.native_quick_entry_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL,
  capability text NOT NULL DEFAULT 'native_quick_entry_v1',
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT native_quick_entry_credentials_owner_installation_key
    UNIQUE (owner_id, installation_id),
  CONSTRAINT native_quick_entry_credentials_capability_valid CHECK (
    capability = 'native_quick_entry_v1'
  ),
  CONSTRAINT native_quick_entry_credentials_expiry_valid CHECK (
    expires_at > created_at
  ),
  CONSTRAINT native_quick_entry_credentials_revocation_valid CHECK (
    revoked_at IS NULL OR revoked_at >= created_at
  )
);

ALTER TABLE tasks_private.native_quick_entry_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE tasks_private.native_quick_entry_credentials
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_issue_native_quick_entry_credential(
  _owner_id uuid,
  _installation_id uuid,
  _raw_token text,
  _expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _credential tasks_private.native_quick_entry_credentials;
BEGIN
  IF _owner_id IS NULL
    OR _installation_id IS NULL
    OR _raw_token IS NULL
    OR _raw_token !~ '^tqe_[A-Za-z0-9_-]{43}$'
    OR _expires_at <= clock_timestamp()
    OR _expires_at > clock_timestamp() + interval '31 days' THEN
    RAISE EXCEPTION 'Invalid native Quick Entry credential request'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO tasks_private.native_quick_entry_credentials (
    owner_id,
    installation_id,
    token_hash,
    expires_at
  ) VALUES (
    _owner_id,
    _installation_id,
    extensions.digest(convert_to(_raw_token, 'UTF8'), 'sha256'),
    _expires_at
  )
  ON CONFLICT (owner_id, installation_id) DO UPDATE
  SET token_hash = EXCLUDED.token_hash,
      expires_at = EXCLUDED.expires_at,
      revoked_at = NULL,
      last_used_at = NULL,
      updated_at = clock_timestamp()
  RETURNING * INTO _credential;

  RETURN jsonb_build_object(
    'outcome', 'issued',
    'credentialId', _credential.id,
    'ownerId', _credential.owner_id,
    'installationId', _credential.installation_id,
    'capability', _credential.capability,
    'expiresAt', _credential.expires_at
  );
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_revoke_native_quick_entry_credential(
  _raw_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _revoked_id uuid;
BEGIN
  IF _raw_token IS NULL OR _raw_token !~ '^tqe_[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object(
      'outcome', 'rejected',
      'code', 'invalid_credential'
    );
  END IF;

  UPDATE tasks_private.native_quick_entry_credentials
  SET revoked_at = COALESCE(revoked_at, clock_timestamp()),
      updated_at = clock_timestamp()
  WHERE token_hash = extensions.digest(
    convert_to(_raw_token, 'UTF8'),
    'sha256'
  )
  RETURNING id INTO _revoked_id;

  RETURN jsonb_build_object(
    'outcome', CASE WHEN _revoked_id IS NULL THEN 'noop' ELSE 'revoked' END
  );
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_read_native_quick_entry_bootstrap(
  _raw_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _credential tasks_private.native_quick_entry_credentials;
  _requested_at timestamptz := clock_timestamp();
  _time_zone text;
  _planning_date date;
  _areas jsonb;
BEGIN
  IF _raw_token IS NULL OR _raw_token !~ '^tqe_[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_credential');
  END IF;

  SELECT credential.* INTO _credential
  FROM tasks_private.native_quick_entry_credentials AS credential
  WHERE credential.token_hash = extensions.digest(
    convert_to(_raw_token, 'UTF8'),
    'sha256'
  )
  FOR UPDATE;

  IF NOT FOUND
    OR _credential.revoked_at IS NOT NULL
    OR _credential.expires_at <= _requested_at
    OR _credential.capability <> 'native_quick_entry_v1' THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_credential');
  END IF;

  UPDATE tasks_private.native_quick_entry_credentials
  SET last_used_at = _requested_at,
      updated_at = _requested_at
  WHERE id = _credential.id;

  SELECT COALESCE(settings.planning_timezone, 'UTC')
  INTO _time_zone
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.tasks_user_settings AS settings
    ON settings.owner_id = _credential.owner_id;
  _planning_date := (_requested_at AT TIME ZONE _time_zone)::date;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', area.id, 'name', area.title)
      ORDER BY area.order_key COLLATE "C", area.id
    ),
    '[]'::jsonb
  )
  INTO _areas
  FROM public.tasks_areas AS area
  WHERE area.owner_id = _credential.owner_id
    AND area.disposition = 'present';

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'type', 'nativeQuickEntryBootstrap',
    'schemaVersion', 1,
    'payloadSchemaVersion', 1,
    'contractFingerprint',
      '5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1',
    'capability', 'native_quick_entry_v1',
    'ownerId', _credential.owner_id,
    'generatedAt', _requested_at,
    'planningDate', _planning_date,
    'planningTimeZone', _time_zone,
    'areas', _areas,
    'limits', jsonb_build_object(
      'maximumChecklistItems', 200,
      'maximumPayloadBytes', 262144
    )
  );
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_create_from_native_quick_entry(
  _raw_token text,
  _payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _credential tasks_private.native_quick_entry_credentials;
  _requested_at timestamptz := clock_timestamp();
  _time_zone text;
  _planning_date date;
  _client_mutation_id uuid;
  _operation_id uuid;
  _summary text;
  _notes text;
  _primary_link text;
  _destination text;
  _today_section text;
  _start_date date;
  _deadline date;
  _area_id uuid;
  _actionability text;
  _reminder_time time(0) without time zone;
  _reminder_date date;
  _reminder_resolved_at timestamptz;
  _reminder_resolution_kind text;
  _task public.tasks_todos;
  _last_order_key text;
  _order_key text;
  _last_hierarchy_order_key text;
  _hierarchy_order_key text;
  _checklist_item jsonb;
  _checklist_count integer;
  _checklist_order_key text := 'a0';
  _reminder public.tasks_reminders;
BEGIN
  IF _raw_token IS NULL
    OR _raw_token !~ '^tqe_[A-Za-z0-9_-]{43}$'
    OR _payload IS NULL
    OR jsonb_typeof(_payload) <> 'object'
    OR octet_length(convert_to(_payload::text, 'UTF8')) > 262144 THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_request');
  END IF;

  SELECT credential.* INTO _credential
  FROM tasks_private.native_quick_entry_credentials AS credential
  WHERE credential.token_hash = extensions.digest(
    convert_to(_raw_token, 'UTF8'),
    'sha256'
  )
  FOR UPDATE;

  IF NOT FOUND
    OR _credential.revoked_at IS NOT NULL
    OR _credential.expires_at <= _requested_at
    OR _credential.capability <> 'native_quick_entry_v1' THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_credential');
  END IF;

  BEGIN
    _client_mutation_id := (_payload ->> 'clientMutationID')::uuid;
    _operation_id := (_payload ->> 'operationID')::uuid;
    _area_id := NULLIF(_payload ->> 'areaID', '')::uuid;
    _start_date := NULLIF(_payload ->> 'startDate', '')::date;
    _deadline := NULLIF(_payload ->> 'deadlineDate', '')::date;
    _reminder_time := NULLIF(_payload ->> 'reminderLocalTime', '')::time(0);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_request');
  END;

  _summary := btrim(COALESCE(_payload ->> 'summary', ''));
  _notes := COALESCE(NULLIF(btrim(_payload ->> 'notes'), ''), '');
  _primary_link := NULLIF(btrim(_payload ->> 'link'), '');
  _destination := _payload ->> 'destination';
  _today_section := NULLIF(_payload ->> 'todaySection', '');
  _actionability := _payload ->> 'actionability';

  IF (_payload ->> 'payloadSchemaVersion') IS DISTINCT FROM '1'
    OR (_payload ->> 'contractFingerprint') IS DISTINCT FROM
      '5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1'
    OR _client_mutation_id IS NULL
    OR _operation_id IS NULL
    OR _summary = ''
    OR char_length(_summary) > 500
    OR char_length(_notes) > 100000
    OR char_length(COALESCE(_primary_link, '')) > 8000
    OR _destination NOT IN ('anytime', 'someday')
    OR (_today_section IS NOT NULL AND _today_section NOT IN ('inbox', 'now', 'next', 'later'))
    OR _actionability NOT IN ('actionable', 'rechecking', 'waiting')
    OR jsonb_typeof(COALESCE(_payload -> 'checklist', '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_request');
  END IF;

  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _credential.owner_id
    AND task.client_mutation_id = _client_mutation_id;

  IF FOUND THEN
    IF _task.entry_channel = 'native'
      AND _task.last_operation_id = _operation_id THEN
      RETURN jsonb_build_object(
        'outcome', 'already_applied',
        'taskId', _task.id,
        'revision', _task.revision,
        'acceptedAt', _task.created_at
      );
    END IF;
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'idempotency_conflict');
  END IF;

  SELECT COALESCE(settings.planning_timezone, 'UTC')
  INTO _time_zone
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.tasks_user_settings AS settings
    ON settings.owner_id = _credential.owner_id;
  _planning_date := (_requested_at AT TIME ZONE _time_zone)::date;

  IF _destination = 'someday' THEN
    IF _start_date IS NOT NULL OR _today_section IS NOT NULL OR _reminder_time IS NOT NULL THEN
      RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_placement');
    END IF;
  ELSIF _start_date IS NOT NULL THEN
    IF _start_date < _planning_date OR _today_section IS NOT NULL THEN
      RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_placement');
    END IF;
    IF _start_date = _planning_date THEN
      _today_section := 'inbox';
    END IF;
  END IF;

  IF _reminder_time IS NOT NULL
    AND _start_date IS NULL
    AND _today_section IS NULL THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_reminder');
  END IF;

  IF _area_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.tasks_areas AS area
    WHERE area.id = _area_id
      AND area.owner_id = _credential.owner_id
      AND area.disposition = 'present'
  ) THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_area');
  END IF;

  _checklist_count := jsonb_array_length(COALESCE(_payload -> 'checklist', '[]'::jsonb));
  IF _checklist_count > 200 OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(_payload -> 'checklist', '[]'::jsonb)) AS item(value)
    WHERE jsonb_typeof(item.value) <> 'object'
      OR COALESCE(NULLIF(btrim(item.value ->> 'title'), ''), '') = ''
      OR char_length(btrim(item.value ->> 'title')) > 500
      OR COALESCE(item.value ->> 'clientID', '') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR COALESCE(item.value ->> 'position', '') !~ '^[0-9]+$'
  ) OR (
    SELECT count(DISTINCT (item.value ->> 'position')::integer)
    FROM jsonb_array_elements(COALESCE(_payload -> 'checklist', '[]'::jsonb)) AS item(value)
  ) <> _checklist_count THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_checklist');
  END IF;

  IF _checklist_count > 0 AND EXISTS (
    SELECT 1
    FROM generate_series(0, _checklist_count - 1) AS expected(position)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_payload -> 'checklist') AS item(value)
      WHERE (item.value ->> 'position')::integer = expected.position
    )
  ) THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_checklist');
  END IF;

  UPDATE tasks_private.native_quick_entry_credentials
  SET last_used_at = _requested_at,
      updated_at = _requested_at
  WHERE id = _credential.id;

  SELECT task.order_key INTO _last_order_key
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _credential.owner_id
    AND task.destination = _destination
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
  ORDER BY task.order_key COLLATE "C" DESC, task.id DESC
  LIMIT 1;
  _order_key := CASE
    WHEN _last_order_key IS NULL THEN 'a0'
    ELSE tasks_private.next_task_order_key(_last_order_key)
  END;

  IF _area_id IS NOT NULL THEN
    SELECT task.hierarchy_order_key INTO _last_hierarchy_order_key
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _credential.owner_id
      AND task.area_id = _area_id
      AND task.lifecycle = 'open'
      AND task.disposition = 'present'
      AND task.hierarchy_order_key IS NOT NULL
    ORDER BY task.hierarchy_order_key COLLATE "C" DESC, task.id DESC
    LIMIT 1;
    _hierarchy_order_key := CASE
      WHEN _last_hierarchy_order_key IS NULL THEN 'a0'
      ELSE tasks_private.next_task_order_key(_last_hierarchy_order_key)
    END;
  END IF;

  IF _start_date = _planning_date THEN
    PERFORM set_config('garden.bath.tasks_activation', 'on', true);
  END IF;

  INSERT INTO public.tasks_todos (
    id, owner_id, actionability, area_id, title, notes, lifecycle,
    completed_at, canceled_at, disposition, deleted_at, deletion_root_id,
    destination, today_section, order_key, upcoming_order_key,
    hierarchy_order_key, start_date, deadline, primary_link, entry_channel,
    last_mutation_channel, last_actor_type, last_operation_id,
    undo_source_event_id, source_kind, source_url, source_title,
    source_external_id, recurrence_definition_id, recurrence_revision,
    recurrence_occurrence_id, recurrence_logical_key,
    recurrence_superseded_at, revision, client_mutation_id, created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(), _credential.owner_id, _actionability, _area_id,
    _summary, _notes, 'open', NULL, NULL, 'present', NULL, NULL,
    _destination, _today_section, _order_key, _order_key,
    _hierarchy_order_key, _start_date, _deadline, _primary_link, 'native',
    'native', 'user', _operation_id, NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL, 1, _client_mutation_id, _requested_at,
    _requested_at
  )
  RETURNING * INTO _task;

  PERFORM set_config('garden.bath.tasks_activation', 'off', true);

  FOR _checklist_item IN
    SELECT item.value
    FROM jsonb_array_elements(COALESCE(_payload -> 'checklist', '[]'::jsonb)) AS item(value)
    ORDER BY (item.value ->> 'position')::integer
  LOOP
    INSERT INTO public.tasks_checklist_items (
      id, owner_id, task_id, title, completed, completed_at, order_key,
      disposition, deleted_at, entry_channel, last_mutation_channel,
      last_actor_type, last_operation_id, revision, client_mutation_id,
      created_at, updated_at
    ) VALUES (
      (_checklist_item ->> 'clientID')::uuid,
      _credential.owner_id,
      _task.id,
      btrim(_checklist_item ->> 'title'),
      false,
      NULL,
      _checklist_order_key,
      'present',
      NULL,
      'native',
      'native',
      'user',
      _operation_id,
      1,
      (_checklist_item ->> 'clientID')::uuid,
      _requested_at,
      _requested_at
    );
    _checklist_order_key := tasks_private.next_task_order_key(
      _checklist_order_key
    );
  END LOOP;

  IF _reminder_time IS NOT NULL THEN
    _reminder_date := COALESCE(_start_date, _planning_date);
    SELECT resolution.resolved_at, resolution.resolution_kind
    INTO _reminder_resolved_at, _reminder_resolution_kind
    FROM tasks_private.resolve_reminder_instant(
      _reminder_date,
      _reminder_time,
      _time_zone,
      'earlier'
    ) AS resolution;

    INSERT INTO public.tasks_reminders (
      owner_id, root_type, task_id, local_date, local_time, time_zone,
      ambiguity_choice, resolved_at, resolution_kind, status,
      record_revision, last_mutation_channel, last_actor_type,
      client_mutation_id, created_at, updated_at
    ) VALUES (
      _credential.owner_id, 'todo', _task.id, _reminder_date,
      _reminder_time, _time_zone, 'earlier', _reminder_resolved_at,
      _reminder_resolution_kind, 'active', 1, 'native', 'user',
      _operation_id, _requested_at, _requested_at
    )
    RETURNING * INTO _reminder;

    INSERT INTO public.tasks_reminder_occurrences (
      owner_id, reminder_id, reminder_revision, resolved_at,
      client_mutation_id, created_at
    ) VALUES (
      _credential.owner_id, _reminder.id, 1, _reminder_resolved_at,
      _operation_id, _requested_at
    );
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'taskId', _task.id,
    'revision', _task.revision,
    'acceptedAt', _requested_at,
    'planningDate', _planning_date
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('outcome', 'rejected', 'code', 'idempotency_conflict');
END
$$;

REVOKE ALL ON FUNCTION public.tasks_issue_native_quick_entry_credential(
  uuid, uuid, text, timestamptz
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_revoke_native_quick_entry_credential(text)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_read_native_quick_entry_bootstrap(text)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_create_from_native_quick_entry(text, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.tasks_issue_native_quick_entry_credential(
  uuid, uuid, text, timestamptz
) TO service_role;
GRANT EXECUTE ON FUNCTION public.tasks_revoke_native_quick_entry_credential(text)
TO service_role;
GRANT EXECUTE ON FUNCTION public.tasks_read_native_quick_entry_bootstrap(text)
TO service_role;
GRANT EXECUTE ON FUNCTION public.tasks_create_from_native_quick_entry(text, jsonb)
TO service_role;
