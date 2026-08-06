-- Private WidgetKit push registration and coalesced owner invalidation authority.
-- Widget pushes contain no Tasks content; they only invite WidgetKit to request
-- the existing bounded authoritative snapshot.

CREATE TABLE tasks_private.widget_push_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES tasks_private.widget_completion_credentials(id)
    ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL,
  platform text NOT NULL,
  apns_environment text NOT NULL,
  apns_topic text NOT NULL,
  device_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT widget_push_registrations_platform_valid
    CHECK (platform IN ('ios', 'macos', 'watchos')),
  CONSTRAINT widget_push_registrations_environment_valid
    CHECK (apns_environment IN ('development', 'production')),
  CONSTRAINT widget_push_registrations_token_valid
    CHECK (
      device_token ~ '^[0-9a-f]+$'
      AND char_length(device_token) BETWEEN 64 AND 512
      AND char_length(device_token) % 2 = 0
    ),
  CONSTRAINT widget_push_registrations_installation_platform_topic_key
    UNIQUE (installation_id, platform, apns_topic)
);

ALTER TABLE tasks_private.widget_push_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tasks_private.widget_push_registrations
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE tasks_private.widget_push_registrations TO service_role;

CREATE INDEX widget_push_registrations_owner_idx
ON tasks_private.widget_push_registrations (owner_id, updated_at DESC);

CREATE TABLE tasks_private.widget_push_outbox (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  generation bigint NOT NULL DEFAULT 1 CHECK (generation > 0),
  not_before timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claim_id uuid,
  claim_expires_at timestamptz,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT widget_push_outbox_claim_valid CHECK (
    (claim_id IS NULL AND claim_expires_at IS NULL)
    OR (claim_id IS NOT NULL AND claim_expires_at IS NOT NULL)
  )
);

ALTER TABLE tasks_private.widget_push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tasks_private.widget_push_outbox
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE tasks_private.widget_push_outbox TO service_role;

CREATE OR REPLACE FUNCTION tasks_private.enqueue_widget_push_for_owner(_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Widget invalidation is a best-effort side effect. Restore tooling and
  -- isolated database fixtures may legitimately stage task rows before their
  -- corresponding Auth owner exists, and a missing push recipient must never
  -- abort the authoritative Tasks write.
  IF _owner_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _owner_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO tasks_private.widget_push_outbox (owner_id)
  VALUES (_owner_id)
  ON CONFLICT (owner_id) DO UPDATE
  SET generation = tasks_private.widget_push_outbox.generation + 1,
      not_before = LEAST(
        tasks_private.widget_push_outbox.not_before,
        clock_timestamp()
      ),
      changed_at = clock_timestamp();
END
$$;

REVOKE ALL ON FUNCTION tasks_private.enqueue_widget_push_for_owner(uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.enqueue_widget_push_from_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM tasks_private.enqueue_widget_push_for_owner(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.owner_id ELSE NEW.owner_id END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.enqueue_widget_push_from_row()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_todos_enqueue_widget_push
AFTER INSERT OR UPDATE OR DELETE ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.enqueue_widget_push_from_row();

CREATE TRIGGER tasks_user_settings_enqueue_widget_push
AFTER INSERT OR UPDATE OR DELETE ON public.tasks_user_settings
FOR EACH ROW EXECUTE FUNCTION tasks_private.enqueue_widget_push_from_row();

CREATE TRIGGER tasks_recurrence_definitions_enqueue_widget_push
AFTER INSERT OR UPDATE OR DELETE ON public.tasks_recurrence_definitions
FOR EACH ROW EXECUTE FUNCTION tasks_private.enqueue_widget_push_from_row();

CREATE TRIGGER tasks_recurrence_revisions_enqueue_widget_push
AFTER INSERT OR UPDATE OR DELETE ON public.tasks_recurrence_revisions
FOR EACH ROW EXECUTE FUNCTION tasks_private.enqueue_widget_push_from_row();

CREATE TRIGGER tasks_recurrence_occurrences_enqueue_widget_push
AFTER INSERT OR UPDATE OR DELETE ON public.tasks_recurrence_occurrences
FOR EACH ROW EXECUTE FUNCTION tasks_private.enqueue_widget_push_from_row();

CREATE OR REPLACE FUNCTION public.tasks_register_widget_push_token(
  _raw_token text,
  _platform text,
  _apns_environment text,
  _apns_topic text,
  _device_token text,
  _enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _credential tasks_private.widget_completion_credentials;
  _now timestamptz := clock_timestamp();
  _expected_topic text;
BEGIN
  IF _raw_token IS NULL
    OR _raw_token !~ '^twc_[A-Za-z0-9_-]{43}$'
    OR _platform NOT IN ('ios', 'macos', 'watchos')
    OR _apns_environment NOT IN ('development', 'production')
    OR _enabled IS NULL THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_request');
  END IF;

  _expected_topic := CASE _platform
    WHEN 'watchos' THEN 'garden.bath.tasks.watchkitapp.push-type.widgets'
    ELSE 'garden.bath.tasks.push-type.widgets'
  END;
  IF _apns_topic IS DISTINCT FROM _expected_topic
    OR _device_token IS NULL
    OR _device_token !~ '^[0-9a-f]+$'
    OR char_length(_device_token) NOT BETWEEN 64 AND 512
    OR char_length(_device_token) % 2 <> 0 THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_request');
  END IF;

  SELECT credential.* INTO _credential
  FROM tasks_private.widget_completion_credentials AS credential
  WHERE credential.token_hash = extensions.digest(
    convert_to(_raw_token, 'UTF8'), 'sha256'
  )
  FOR UPDATE;

  IF NOT FOUND
    OR _credential.revoked_at IS NOT NULL
    OR _credential.expires_at <= _now THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_credential');
  END IF;

  UPDATE tasks_private.widget_completion_credentials
  SET last_used_at = _now, updated_at = _now
  WHERE id = _credential.id;

  IF NOT _enabled THEN
    DELETE FROM tasks_private.widget_push_registrations
    WHERE owner_id = _credential.owner_id
      AND installation_id = _credential.installation_id
      AND platform = _platform
      AND apns_topic = _apns_topic;
    RETURN jsonb_build_object('outcome', 'disabled');
  END IF;

  INSERT INTO tasks_private.widget_push_registrations (
    credential_id, owner_id, installation_id, platform,
    apns_environment, apns_topic, device_token
  ) VALUES (
    _credential.id, _credential.owner_id, _credential.installation_id, _platform,
    _apns_environment, _apns_topic, _device_token
  )
  ON CONFLICT (installation_id, platform, apns_topic) DO UPDATE
  SET credential_id = EXCLUDED.credential_id,
      owner_id = EXCLUDED.owner_id,
      apns_environment = EXCLUDED.apns_environment,
      device_token = EXCLUDED.device_token,
      updated_at = _now;

  PERFORM tasks_private.enqueue_widget_push_for_owner(_credential.owner_id);
  RETURN jsonb_build_object('outcome', 'registered');
END
$$;

REVOKE ALL ON FUNCTION public.tasks_register_widget_push_token(
  text, text, text, text, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_register_widget_push_token(
  text, text, text, text, text, boolean
) TO service_role;

CREATE OR REPLACE FUNCTION public.tasks_claim_widget_push_updates(_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _claims jsonb;
BEGIN
  IF _limit < 1 OR _limit > 200 THEN
    RAISE EXCEPTION 'Invalid widget push claim limit' USING ERRCODE = '22023';
  END IF;

  WITH candidates AS (
    SELECT outbox.owner_id
    FROM tasks_private.widget_push_outbox AS outbox
    WHERE outbox.not_before <= clock_timestamp()
      AND (outbox.claim_expires_at IS NULL OR outbox.claim_expires_at <= clock_timestamp())
    ORDER BY outbox.changed_at, outbox.owner_id
    FOR UPDATE SKIP LOCKED
    LIMIT _limit
  ), claimed AS (
    UPDATE tasks_private.widget_push_outbox AS outbox
    SET claim_id = gen_random_uuid(),
        claim_expires_at = clock_timestamp() + interval '5 minutes'
    FROM candidates
    WHERE outbox.owner_id = candidates.owner_id
    RETURNING outbox.*
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'ownerId', claimed.owner_id,
    'claimId', claimed.claim_id,
    'generation', claimed.generation,
    'targets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'registrationId', registration.id,
        'platform', registration.platform,
        'environment', registration.apns_environment,
        'topic', registration.apns_topic,
        'deviceToken', registration.device_token
      ) ORDER BY registration.id)
      FROM tasks_private.widget_push_registrations AS registration
      WHERE registration.owner_id = claimed.owner_id
    ), '[]'::jsonb)
  ) ORDER BY claimed.changed_at, claimed.owner_id), '[]'::jsonb)
  INTO _claims
  FROM claimed;

  RETURN _claims;
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_finish_widget_push_update(
  _owner_id uuid,
  _claim_id uuid,
  _generation bigint,
  _succeeded boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF _succeeded THEN
    DELETE FROM tasks_private.widget_push_outbox
    WHERE owner_id = _owner_id AND claim_id = _claim_id AND generation = _generation;
    IF FOUND THEN RETURN true; END IF;

    UPDATE tasks_private.widget_push_outbox
    SET claim_id = NULL, claim_expires_at = NULL, attempt_count = 0,
        not_before = LEAST(not_before, clock_timestamp())
    WHERE owner_id = _owner_id AND claim_id = _claim_id;
    RETURN FOUND;
  END IF;

  UPDATE tasks_private.widget_push_outbox
  SET claim_id = NULL,
      claim_expires_at = NULL,
      attempt_count = attempt_count + 1,
      not_before = clock_timestamp()
        + make_interval(secs => LEAST(3600, 15 * (2 ^ LEAST(attempt_count, 8)))::integer)
  WHERE owner_id = _owner_id AND claim_id = _claim_id;
  RETURN FOUND;
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_retire_widget_push_registration(
  _registration_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH removed AS (
    DELETE FROM tasks_private.widget_push_registrations
    WHERE id = _registration_id
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM removed)
$$;

REVOKE ALL ON FUNCTION public.tasks_claim_widget_push_updates(integer)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_finish_widget_push_update(uuid, uuid, bigint, boolean)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_retire_widget_push_registration(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.tasks_claim_widget_push_updates(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.tasks_finish_widget_push_update(uuid, uuid, bigint, boolean)
TO service_role;
GRANT EXECUTE ON FUNCTION public.tasks_retire_widget_push_registration(uuid)
TO service_role;
