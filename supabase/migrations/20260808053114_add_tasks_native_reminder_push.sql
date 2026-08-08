-- Private APNs application-token storage and session-scoped in-app fallback.

CREATE TABLE tasks_private.native_push_registrations (
  target_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'macos')),
  environment text NOT NULL CHECK (environment IN ('development', 'production')),
  topic text NOT NULL CHECK (topic = 'garden.bath.tasks'),
  device_token text NOT NULL CHECK (
    device_token ~ '^[0-9a-f]+$'
    AND length(device_token) BETWEEN 64 AND 512
    AND length(device_token) % 2 = 0
  ),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT native_push_registrations_target_owner_fkey
    FOREIGN KEY (target_id, owner_id)
    REFERENCES public.tasks_delivery_targets(id, owner_id)
    ON DELETE CASCADE,
  UNIQUE (installation_id),
  UNIQUE (platform, environment, topic, device_token)
);

ALTER TABLE tasks_private.native_push_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tasks_private.native_push_registrations
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE tasks_private.native_push_registrations TO service_role;

CREATE OR REPLACE FUNCTION public.tasks_register_native_push_target(
  _installation_id uuid,
  _platform text,
  _environment text,
  _topic text,
  _device_token text,
  _label text DEFAULT 'This Device'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _normalized_token text := lower(btrim(_device_token));
  _normalized_label text := btrim(_label);
  _prior record;
  _target public.tasks_delivery_targets;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to register native notifications'
      USING ERRCODE = '42501';
  END IF;
  IF _installation_id IS NULL
    OR _platform NOT IN ('ios', 'macos')
    OR _environment NOT IN ('development', 'production')
    OR _topic <> 'garden.bath.tasks'
    OR _normalized_token !~ '^[0-9a-f]+$'
    OR length(_normalized_token) NOT BETWEEN 64 AND 512
    OR length(_normalized_token) % 2 <> 0
    OR _normalized_label = ''
    OR char_length(_normalized_label) > 500 THEN
    RAISE EXCEPTION 'The native notification target is invalid'
      USING ERRCODE = '22023';
  END IF;

  FOR _prior IN
    SELECT registration.target_id, registration.owner_id, target.endpoint_key
    FROM tasks_private.native_push_registrations AS registration
    JOIN public.tasks_delivery_targets AS target
      ON target.id = registration.target_id
     AND target.owner_id = registration.owner_id
    WHERE registration.installation_id = _installation_id
       OR (
         registration.platform = _platform
         AND registration.environment = _environment
         AND registration.topic = _topic
         AND registration.device_token = _normalized_token
       )
    FOR UPDATE
  LOOP
    IF _prior.owner_id <> _owner_id
      OR _prior.endpoint_key <> 'installation:' || _installation_id::text THEN
      UPDATE public.tasks_reminder_deliveries
      SET status = 'canceled', updated_at = clock_timestamp()
      WHERE owner_id = _prior.owner_id
        AND target_id = _prior.target_id
        AND status NOT IN ('acknowledged', 'canceled');
      UPDATE public.tasks_delivery_targets
      SET capability_status = 'revoked',
          last_error_code = 'installation_reassigned',
          updated_at = clock_timestamp()
      WHERE id = _prior.target_id AND owner_id = _prior.owner_id;
    END IF;
    DELETE FROM tasks_private.native_push_registrations
    WHERE target_id = _prior.target_id AND owner_id = _prior.owner_id;
  END LOOP;

  INSERT INTO public.tasks_delivery_targets (
    owner_id, channel, endpoint_key, label, capability_status,
    configuration, last_seen_at
  ) VALUES (
    _owner_id,
    'native_push',
    'installation:' || _installation_id::text,
    _normalized_label,
    'active',
    jsonb_build_object(
      'platform', _platform,
      'environment', _environment,
      'topic', _topic,
      'installation_id', _installation_id
    ),
    clock_timestamp()
  )
  ON CONFLICT (owner_id, channel, endpoint_key) DO UPDATE
  SET label = EXCLUDED.label,
      capability_status = 'active',
      configuration = EXCLUDED.configuration,
      last_error_code = NULL,
      last_seen_at = clock_timestamp(),
      updated_at = clock_timestamp()
  RETURNING * INTO _target;

  DELETE FROM tasks_private.native_push_registrations
  WHERE owner_id = _owner_id
    AND (installation_id = _installation_id OR target_id = _target.id);

  INSERT INTO tasks_private.native_push_registrations (
    target_id, owner_id, installation_id, platform,
    environment, topic, device_token
  ) VALUES (
    _target.id, _owner_id, _installation_id, _platform,
    _environment, _topic, _normalized_token
  );

  RETURN jsonb_build_object('outcome', 'accepted', 'target', to_jsonb(_target));
END
$$;

REVOKE ALL ON FUNCTION public.tasks_register_native_push_target(
  uuid, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_register_native_push_target(
  uuid, text, text, text, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_revoke_native_push_target(
  _installation_id uuid,
  _reason text DEFAULT 'authorization_disabled'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _target public.tasks_delivery_targets;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to revoke native notifications'
      USING ERRCODE = '42501';
  END IF;
  SELECT target.* INTO _target
  FROM public.tasks_delivery_targets AS target
  JOIN tasks_private.native_push_registrations AS registration
    ON registration.target_id = target.id
   AND registration.owner_id = target.owner_id
  WHERE target.owner_id = _owner_id
    AND registration.installation_id = _installation_id
  FOR UPDATE OF target;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_registered');
  END IF;
  DELETE FROM tasks_private.native_push_registrations
  WHERE target_id = _target.id AND owner_id = _owner_id;
  UPDATE public.tasks_delivery_targets
  SET capability_status = 'revoked',
      last_error_code = left(COALESCE(NULLIF(btrim(_reason), ''), 'revoked'), 200),
      updated_at = clock_timestamp()
  WHERE id = _target.id AND owner_id = _owner_id
  RETURNING * INTO _target;
  UPDATE public.tasks_reminder_deliveries
  SET status = 'canceled', updated_at = clock_timestamp()
  WHERE owner_id = _owner_id AND target_id = _target.id
    AND status NOT IN ('acknowledged', 'canceled');
  RETURN jsonb_build_object('outcome', 'accepted', 'target', to_jsonb(_target));
END
$$;

REVOKE ALL ON FUNCTION public.tasks_revoke_native_push_target(uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_revoke_native_push_target(uuid, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_claim_native_push_deliveries(
  _through_at timestamptz,
  _limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _items jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authorization is required to dispatch native reminders'
      USING ERRCODE = '42501';
  END IF;
  IF _through_at IS NULL OR _limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'The native reminder claim is invalid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tasks_reminder_deliveries (owner_id, occurrence_id, target_id)
  SELECT occurrence.owner_id, occurrence.id, target.id
  FROM public.tasks_reminder_occurrences AS occurrence
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_delivery_targets AS target
    ON target.owner_id = occurrence.owner_id
   AND target.channel = 'native_push'
   AND target.capability_status = 'active'
  JOIN tasks_private.native_push_registrations AS registration
    ON registration.target_id = target.id AND registration.owner_id = target.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id AND task.owner_id = reminder.owner_id
  WHERE occurrence.status = 'scheduled'
    AND occurrence.resolved_at <= _through_at
    AND reminder.status = 'active'
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
    AND NOT EXISTS (
      SELECT 1 FROM public.tasks_reminder_deliveries AS acknowledged
      WHERE acknowledged.owner_id = occurrence.owner_id
        AND acknowledged.occurrence_id = occurrence.id
        AND acknowledged.status = 'acknowledged'
    )
  ON CONFLICT (owner_id, occurrence_id, target_id) DO NOTHING;

  WITH eligible AS (
    SELECT delivery.id
    FROM public.tasks_reminder_deliveries AS delivery
    JOIN public.tasks_reminder_occurrences AS occurrence
      ON occurrence.id = delivery.occurrence_id AND occurrence.owner_id = delivery.owner_id
    JOIN public.tasks_delivery_targets AS target
      ON target.id = delivery.target_id AND target.owner_id = delivery.owner_id
    JOIN tasks_private.native_push_registrations AS registration
      ON registration.target_id = target.id AND registration.owner_id = target.owner_id
    WHERE target.channel = 'native_push'
      AND target.capability_status = 'active'
      AND occurrence.status = 'scheduled'
      AND occurrence.resolved_at <= _through_at
      AND (
        delivery.status = 'scheduled'
        OR (
          delivery.status IN ('attempted', 'failed')
          AND delivery.last_attempted_at <= clock_timestamp() - interval '2 minutes'
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.tasks_reminder_deliveries AS acknowledged
        WHERE acknowledged.owner_id = delivery.owner_id
          AND acknowledged.occurrence_id = delivery.occurrence_id
          AND acknowledged.status = 'acknowledged'
      )
    ORDER BY occurrence.resolved_at, delivery.id
    LIMIT _limit
    FOR UPDATE OF delivery SKIP LOCKED
  ), updated AS (
    UPDATE public.tasks_reminder_deliveries AS delivery
    SET status = 'attempted',
        attempt_count = attempt_count + 1,
        last_attempted_at = clock_timestamp(),
        last_error_code = NULL,
        updated_at = clock_timestamp()
    FROM eligible
    WHERE delivery.id = eligible.id
    RETURNING delivery.*
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'delivery_id', delivery.id,
    'occurrence_id', occurrence.id,
    'owner_id', delivery.owner_id,
    'task_id', reminder.task_id,
    'title', task.title,
    'resolved_at', occurrence.resolved_at,
    'attempt_count', delivery.attempt_count,
    'platform', registration.platform,
    'environment', registration.environment,
    'topic', registration.topic,
    'device_token', registration.device_token
  ) ORDER BY occurrence.resolved_at, delivery.id), '[]'::jsonb)
  INTO _items
  FROM updated AS delivery
  JOIN public.tasks_reminder_occurrences AS occurrence
    ON occurrence.id = delivery.occurrence_id AND occurrence.owner_id = delivery.owner_id
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id AND task.owner_id = reminder.owner_id
  JOIN tasks_private.native_push_registrations AS registration
    ON registration.target_id = delivery.target_id AND registration.owner_id = delivery.owner_id;

  RETURN jsonb_build_object('outcome', 'accepted', 'through_at', _through_at, 'items', _items);
END
$$;

REVOKE ALL ON FUNCTION public.tasks_claim_native_push_deliveries(timestamptz, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_claim_native_push_deliveries(timestamptz, integer)
TO service_role;

CREATE OR REPLACE FUNCTION public.tasks_record_native_push_delivery_result(
  _delivery_id uuid,
  _outcome text,
  _provider_message_id text DEFAULT NULL,
  _error_code text DEFAULT NULL,
  _target_revoked boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _delivery public.tasks_reminder_deliveries;
  _target public.tasks_delivery_targets;
  _normalized_error text := NULLIF(btrim(_error_code), '');
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authorization is required to record native delivery'
      USING ERRCODE = '42501';
  END IF;
  IF _outcome NOT IN ('provider_accepted', 'failed')
    OR char_length(COALESCE(_provider_message_id, '')) > 500
    OR char_length(COALESCE(_normalized_error, '')) > 200 THEN
    RAISE EXCEPTION 'The native delivery result is invalid' USING ERRCODE = '22023';
  END IF;
  SELECT delivery.* INTO _delivery
  FROM public.tasks_reminder_deliveries AS delivery
  WHERE delivery.id = _delivery_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The native delivery is unavailable' USING ERRCODE = '22023';
  END IF;
  SELECT target.* INTO _target
  FROM public.tasks_delivery_targets AS target
  WHERE target.id = _delivery.target_id
    AND target.owner_id = _delivery.owner_id
    AND target.channel = 'native_push'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The native target is unavailable' USING ERRCODE = '22023';
  END IF;
  IF _delivery.status IN ('provider_accepted', 'acknowledged', 'canceled') THEN
    RETURN jsonb_build_object(
      'outcome', CASE WHEN _delivery.status = 'canceled' THEN 'canceled' ELSE 'already_applied' END,
      'delivery', to_jsonb(_delivery), 'target', to_jsonb(_target)
    );
  END IF;
  IF _outcome = 'provider_accepted' THEN
    UPDATE public.tasks_reminder_deliveries
    SET status = 'provider_accepted',
        provider_accepted_at = COALESCE(provider_accepted_at, clock_timestamp()),
        provider_message_id = NULLIF(btrim(_provider_message_id), ''),
        last_error_code = NULL,
        updated_at = clock_timestamp()
    WHERE id = _delivery.id RETURNING * INTO _delivery;
    UPDATE public.tasks_delivery_targets
    SET capability_status = 'active', last_error_code = NULL,
        updated_at = clock_timestamp()
    WHERE id = _target.id AND owner_id = _target.owner_id RETURNING * INTO _target;
  ELSE
    _normalized_error := COALESCE(_normalized_error, 'provider_error');
    UPDATE public.tasks_reminder_deliveries
    SET status = 'failed', last_error_code = _normalized_error,
        updated_at = clock_timestamp()
    WHERE id = _delivery.id RETURNING * INTO _delivery;
    UPDATE public.tasks_delivery_targets
    SET capability_status = CASE WHEN _target_revoked THEN 'revoked' ELSE 'active' END,
        last_error_code = _normalized_error,
        updated_at = clock_timestamp()
    WHERE id = _target.id AND owner_id = _target.owner_id RETURNING * INTO _target;
    IF _target_revoked THEN
      DELETE FROM tasks_private.native_push_registrations
      WHERE target_id = _target.id AND owner_id = _target.owner_id;
      UPDATE public.tasks_reminder_deliveries
      SET status = 'canceled', updated_at = clock_timestamp()
      WHERE owner_id = _target.owner_id AND target_id = _target.id
        AND id <> _delivery.id AND status NOT IN ('acknowledged', 'canceled');
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'outcome', 'accepted', 'delivery', to_jsonb(_delivery), 'target', to_jsonb(_target)
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_record_native_push_delivery_result(
  uuid, text, text, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_record_native_push_delivery_result(
  uuid, text, text, text, boolean
) TO service_role;

CREATE OR REPLACE FUNCTION public.tasks_claim_due_reminders_v3(
  _not_before timestamptz,
  _through_at timestamptz,
  _request_id uuid,
  _surface_key text,
  _surface_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _normalized_surface_key text := btrim(_surface_key);
  _normalized_surface_label text := btrim(_surface_label);
  _target public.tasks_delivery_targets;
  _claim public.tasks_reminder_claims;
  _items jsonb;
  _result jsonb;
  _claimable boolean;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to claim reminders' USING ERRCODE = '42501';
  END IF;
  IF _not_before IS NULL OR _through_at IS NULL OR _not_before > _through_at THEN
    RAISE EXCEPTION 'The reminder session window is invalid' USING ERRCODE = '22023';
  END IF;
  IF _normalized_surface_key !~ '^(browser|ios|macos):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    OR _normalized_surface_label = '' OR char_length(_normalized_surface_label) > 500 THEN
    RAISE EXCEPTION 'The reminder surface is invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'tasks-reminder-claim:' || _owner_id::text || ':' || _request_id::text, 0
  ));
  SELECT claim.* INTO _claim
  FROM public.tasks_reminder_claims AS claim
  WHERE claim.id = _request_id AND claim.owner_id = _owner_id;
  IF FOUND THEN
    IF _claim.through_at IS DISTINCT FROM _through_at
      OR _claim.result ->> 'surface_key' IS DISTINCT FROM _normalized_surface_key
      OR (_claim.result ->> 'not_before')::timestamptz IS DISTINCT FROM _not_before THEN
      RAISE EXCEPTION 'A reminder claim identifier cannot be reused with another request'
        USING ERRCODE = '23514';
    END IF;
    RETURN _claim.result;
  END IF;

  SELECT target.* INTO _target
  FROM public.tasks_delivery_targets AS target
  WHERE target.owner_id = _owner_id AND target.channel = 'in_app'
    AND target.endpoint_key = _normalized_surface_key;

  SELECT EXISTS (
    SELECT 1
    FROM public.tasks_reminder_occurrences AS occurrence
    JOIN public.tasks_reminders AS reminder
      ON reminder.id = occurrence.reminder_id AND reminder.owner_id = occurrence.owner_id
    JOIN public.tasks_todos AS task
      ON task.id = reminder.task_id AND task.owner_id = reminder.owner_id
    WHERE occurrence.owner_id = _owner_id
      AND occurrence.status = 'scheduled'
      AND occurrence.resolved_at >= _not_before
      AND occurrence.resolved_at <= _through_at
      AND reminder.status = 'active'
      AND task.lifecycle = 'open' AND task.disposition = 'present'
      AND (
        _target.id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.tasks_reminder_deliveries AS existing
          WHERE existing.owner_id = occurrence.owner_id
            AND existing.occurrence_id = occurrence.id
            AND existing.target_id = _target.id
        )
        OR EXISTS (
          SELECT 1 FROM public.tasks_reminder_deliveries AS retryable
          WHERE retryable.owner_id = occurrence.owner_id
            AND retryable.occurrence_id = occurrence.id
            AND retryable.target_id = _target.id
            AND (
              retryable.status IN ('scheduled', 'failed')
              OR (retryable.status = 'attempted'
                AND retryable.last_attempted_at <= clock_timestamp() - interval '2 minutes')
            )
        )
      )
  ) INTO _claimable;

  IF NOT _claimable THEN
    RETURN jsonb_build_object(
      'outcome', 'accepted', 'not_before', _not_before,
      'through_at', _through_at, 'surface_key', _normalized_surface_key,
      'items', '[]'::jsonb
    );
  END IF;

  INSERT INTO public.tasks_delivery_targets (
    owner_id, channel, endpoint_key, label, capability_status,
    configuration, last_seen_at
  ) VALUES (
    _owner_id, 'in_app', _normalized_surface_key, _normalized_surface_label,
    'active', '{}'::jsonb, clock_timestamp()
  ) ON CONFLICT (owner_id, channel, endpoint_key) DO UPDATE
  SET label = EXCLUDED.label, capability_status = 'active', last_error_code = NULL,
      last_seen_at = clock_timestamp(), updated_at = clock_timestamp()
  RETURNING * INTO _target;

  INSERT INTO public.tasks_reminder_deliveries (owner_id, occurrence_id, target_id)
  SELECT _owner_id, occurrence.id, _target.id
  FROM public.tasks_reminder_occurrences AS occurrence
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id AND task.owner_id = reminder.owner_id
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.status = 'scheduled'
    AND occurrence.resolved_at >= _not_before
    AND occurrence.resolved_at <= _through_at
    AND reminder.status = 'active'
    AND task.lifecycle = 'open' AND task.disposition = 'present'
  ON CONFLICT (owner_id, occurrence_id, target_id) DO NOTHING;

  WITH eligible AS (
    SELECT delivery.id
    FROM public.tasks_reminder_deliveries AS delivery
    JOIN public.tasks_reminder_occurrences AS occurrence
      ON occurrence.id = delivery.occurrence_id AND occurrence.owner_id = delivery.owner_id
    WHERE delivery.owner_id = _owner_id AND delivery.target_id = _target.id
      AND occurrence.resolved_at >= _not_before
      AND occurrence.resolved_at <= _through_at
      AND (
        delivery.status IN ('scheduled', 'failed')
        OR (delivery.status = 'attempted'
          AND delivery.last_attempted_at <= clock_timestamp() - interval '2 minutes')
      )
    ORDER BY occurrence.resolved_at, delivery.id
    FOR UPDATE OF delivery SKIP LOCKED
  ), updated AS (
    UPDATE public.tasks_reminder_deliveries AS delivery
    SET status = 'attempted', attempt_count = attempt_count + 1,
        last_attempted_at = clock_timestamp(), last_error_code = NULL,
        updated_at = clock_timestamp()
    FROM eligible WHERE delivery.id = eligible.id RETURNING delivery.*
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'delivery_id', delivery.id, 'occurrence_id', occurrence.id,
    'reminder_id', reminder.id, 'root_type', 'todo',
    'root_id', reminder.task_id, 'title', task.title,
    'resolved_at', occurrence.resolved_at,
    'attempt_count', delivery.attempt_count
  ) ORDER BY occurrence.resolved_at, delivery.id), '[]'::jsonb)
  INTO _items
  FROM updated AS delivery
  JOIN public.tasks_reminder_occurrences AS occurrence
    ON occurrence.id = delivery.occurrence_id AND occurrence.owner_id = delivery.owner_id
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id AND task.owner_id = reminder.owner_id;

  _result := jsonb_build_object(
    'outcome', 'accepted', 'not_before', _not_before,
    'through_at', _through_at, 'surface_key', _normalized_surface_key,
    'items', _items
  );
  IF jsonb_array_length(_items) > 0 THEN
    INSERT INTO public.tasks_reminder_claims(id, owner_id, through_at, result)
    VALUES (_request_id, _owner_id, _through_at, _result);
  END IF;
  RETURN _result;
END
$$;

REVOKE ALL ON FUNCTION public.tasks_claim_due_reminders_v3(
  timestamptz, timestamptz, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_claim_due_reminders_v3(
  timestamptz, timestamptz, uuid, text, text
) TO authenticated;
