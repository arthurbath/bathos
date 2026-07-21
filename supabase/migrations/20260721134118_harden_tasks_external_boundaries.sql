-- Require literal destructive confirmation and bind one browser subscription
-- to at most one owner at a time.

ALTER FUNCTION public.tasks_permanently_delete(
  text, uuid, text, uuid, text
) SET SCHEMA tasks_private;

ALTER FUNCTION tasks_private.tasks_permanently_delete(
  text, uuid, text, uuid, text
) RENAME TO tasks_permanently_delete_after_confirmation;

REVOKE ALL ON FUNCTION tasks_private.tasks_permanently_delete_after_confirmation(
  text, uuid, text, uuid, text
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_permanently_delete(
  _root_type text,
  _root_id uuid,
  _scope_digest text,
  _request_id uuid,
  _confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF _confirmation IS DISTINCT FROM 'PERMANENTLY DELETE' THEN
    RAISE EXCEPTION 'Permanent deletion requires explicit confirmation'
      USING ERRCODE = '22023';
  END IF;

  RETURN tasks_private.tasks_permanently_delete_after_confirmation(
    _root_type,
    _root_id,
    _scope_digest,
    _request_id,
    _confirmation
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_permanently_delete(
  text, uuid, text, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_permanently_delete(
  text, uuid, text, uuid, text
) TO authenticated;

ALTER TABLE public.tasks_web_push_subscriptions
ADD COLUMN endpoint_key text GENERATED ALWAYS AS (
  'sha256:' || encode(
    extensions.digest(endpoint, 'sha256'),
    'hex'
  )
) STORED;

ALTER TABLE public.tasks_web_push_subscriptions
ADD CONSTRAINT tasks_web_push_subscriptions_endpoint_key_format
CHECK (endpoint_key ~ '^sha256:[a-f0-9]{64}$');

WITH ranked_subscriptions AS (
  SELECT
    target_id,
    row_number() OVER (
      PARTITION BY endpoint_key
      ORDER BY updated_at DESC, created_at DESC, target_id DESC
    ) AS endpoint_rank
  FROM public.tasks_web_push_subscriptions
)
UPDATE public.tasks_reminder_deliveries AS delivery
SET status = 'canceled',
    updated_at = clock_timestamp()
FROM ranked_subscriptions AS subscription
WHERE subscription.endpoint_rank > 1
  AND delivery.target_id = subscription.target_id
  AND delivery.status NOT IN ('acknowledged', 'canceled');

WITH ranked_subscriptions AS (
  SELECT
    target_id,
    row_number() OVER (
      PARTITION BY endpoint_key
      ORDER BY updated_at DESC, created_at DESC, target_id DESC
    ) AS endpoint_rank
  FROM public.tasks_web_push_subscriptions
)
UPDATE public.tasks_delivery_targets AS target
SET capability_status = 'revoked',
    last_error_code = 'account_changed',
    updated_at = clock_timestamp()
FROM ranked_subscriptions AS subscription
WHERE subscription.endpoint_rank > 1
  AND target.id = subscription.target_id;

WITH ranked_subscriptions AS (
  SELECT
    target_id,
    row_number() OVER (
      PARTITION BY endpoint_key
      ORDER BY updated_at DESC, created_at DESC, target_id DESC
    ) AS endpoint_rank
  FROM public.tasks_web_push_subscriptions
)
DELETE FROM public.tasks_web_push_subscriptions AS subscription
USING ranked_subscriptions AS ranked
WHERE ranked.endpoint_rank > 1
  AND subscription.target_id = ranked.target_id;

ALTER TABLE public.tasks_web_push_subscriptions
ADD CONSTRAINT tasks_web_push_subscriptions_endpoint_key_unique
UNIQUE (endpoint_key);

CREATE OR REPLACE FUNCTION public.tasks_register_web_push_target(
  _endpoint text,
  _p256dh text,
  _auth_secret text,
  _label text DEFAULT 'This Browser',
  _reactivate_revoked boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _normalized_endpoint text := btrim(_endpoint);
  _normalized_label text := COALESCE(NULLIF(btrim(_label), ''), 'This Browser');
  _endpoint_key text;
  _target public.tasks_delivery_targets;
  _was_existing boolean := false;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to register Web Push'
      USING ERRCODE = '42501';
  END IF;
  IF _normalized_endpoint IS NULL
    OR _normalized_endpoint !~ '^https://[^[:space:]]+$'
    OR char_length(_normalized_endpoint) > 2048
    OR _p256dh IS NULL
    OR _p256dh !~ '^[A-Za-z0-9_-]+={0,2}$'
    OR char_length(_p256dh) NOT BETWEEN 40 AND 200
    OR _auth_secret IS NULL
    OR _auth_secret !~ '^[A-Za-z0-9_-]+={0,2}$'
    OR char_length(_auth_secret) NOT BETWEEN 12 AND 100
    OR char_length(_normalized_label) > 120 THEN
    RAISE EXCEPTION 'The Web Push subscription is invalid' USING ERRCODE = '22023';
  END IF;

  _endpoint_key := 'sha256:' || encode(
    extensions.digest(_normalized_endpoint, 'sha256'),
    'hex'
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tasks-web-push:' || _endpoint_key, 0)
  );

  SELECT target.* INTO _target
  FROM public.tasks_delivery_targets AS target
  WHERE target.owner_id = _owner_id
    AND target.channel = 'web_push'
    AND target.endpoint_key = _endpoint_key
  FOR UPDATE;
  _was_existing := FOUND;

  IF _was_existing
    AND _target.capability_status = 'revoked'
    AND NOT _reactivate_revoked THEN
    RETURN jsonb_build_object(
      'outcome', 'revoked',
      'target', to_jsonb(_target)
    );
  END IF;

  UPDATE public.tasks_reminder_deliveries AS delivery
  SET status = 'canceled',
      updated_at = clock_timestamp()
  FROM public.tasks_web_push_subscriptions AS subscription
  WHERE subscription.endpoint_key = _endpoint_key
    AND subscription.owner_id <> _owner_id
    AND delivery.target_id = subscription.target_id
    AND delivery.owner_id = subscription.owner_id
    AND delivery.status NOT IN ('acknowledged', 'canceled');

  DELETE FROM public.tasks_web_push_subscriptions AS subscription
  WHERE subscription.endpoint_key = _endpoint_key
    AND subscription.owner_id <> _owner_id;

  UPDATE public.tasks_delivery_targets AS target
  SET capability_status = 'revoked',
      last_error_code = 'account_changed',
      updated_at = clock_timestamp()
  WHERE target.channel = 'web_push'
    AND target.endpoint_key = _endpoint_key
    AND target.owner_id <> _owner_id;

  INSERT INTO public.tasks_delivery_targets (
    owner_id, channel, endpoint_key, label, capability_status,
    configuration, last_error_code, last_seen_at
  ) VALUES (
    _owner_id, 'web_push', _endpoint_key, _normalized_label, 'active',
    jsonb_build_object('preview', 'title'), NULL, clock_timestamp()
  ) ON CONFLICT (owner_id, channel, endpoint_key) DO UPDATE
    SET label = EXCLUDED.label,
        capability_status = CASE
          WHEN public.tasks_delivery_targets.capability_status = 'revoked'
            AND _reactivate_revoked THEN 'active'
          ELSE public.tasks_delivery_targets.capability_status
        END,
        configuration = EXCLUDED.configuration,
        last_error_code = CASE
          WHEN public.tasks_delivery_targets.capability_status = 'revoked'
            AND _reactivate_revoked THEN NULL
          ELSE public.tasks_delivery_targets.last_error_code
        END,
        last_seen_at = clock_timestamp(),
        updated_at = clock_timestamp()
  RETURNING * INTO _target;

  INSERT INTO public.tasks_web_push_subscriptions (
    target_id, owner_id, endpoint, p256dh, auth_secret
  ) VALUES (
    _target.id, _owner_id, _normalized_endpoint, _p256dh, _auth_secret
  ) ON CONFLICT (target_id) DO UPDATE
    SET endpoint = EXCLUDED.endpoint,
        p256dh = EXCLUDED.p256dh,
        auth_secret = EXCLUDED.auth_secret,
        updated_at = clock_timestamp();

  RETURN jsonb_build_object(
    'outcome', CASE WHEN _was_existing THEN 'already_registered' ELSE 'accepted' END,
    'target', to_jsonb(_target)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_register_web_push_target(
  text, text, text, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_register_web_push_target(
  text, text, text, text, boolean
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_revoke_web_push_endpoint(
  _endpoint text,
  _reason text DEFAULT 'account_signed_out'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _normalized_endpoint text := btrim(_endpoint);
  _normalized_reason text := COALESCE(NULLIF(btrim(_reason), ''), 'account_signed_out');
  _endpoint_key text;
  _target public.tasks_delivery_targets;
  _was_revoked boolean;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to disable Web Push'
      USING ERRCODE = '42501';
  END IF;
  IF _normalized_endpoint IS NULL
    OR _normalized_endpoint !~ '^https://[^[:space:]]+$'
    OR char_length(_normalized_endpoint) > 2048
    OR char_length(_normalized_reason) > 100
    OR _normalized_reason !~ '^[a-z0-9_:-]+$' THEN
    RAISE EXCEPTION 'The Web Push revocation input is invalid' USING ERRCODE = '22023';
  END IF;

  _endpoint_key := 'sha256:' || encode(
    extensions.digest(_normalized_endpoint, 'sha256'),
    'hex'
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tasks-web-push:' || _endpoint_key, 0)
  );

  SELECT target.* INTO _target
  FROM public.tasks_delivery_targets AS target
  WHERE target.owner_id = _owner_id
    AND target.channel = 'web_push'
    AND target.endpoint_key = _endpoint_key
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_registered');
  END IF;
  _was_revoked := _target.capability_status = 'revoked';

  DELETE FROM public.tasks_web_push_subscriptions
  WHERE target_id = _target.id
    AND owner_id = _owner_id
    AND endpoint_key = _endpoint_key;

  UPDATE public.tasks_reminder_deliveries
  SET status = 'canceled',
      updated_at = clock_timestamp()
  WHERE owner_id = _owner_id
    AND target_id = _target.id
    AND status NOT IN ('acknowledged', 'canceled');

  UPDATE public.tasks_delivery_targets
  SET capability_status = 'revoked',
      last_error_code = _normalized_reason,
      updated_at = clock_timestamp()
  WHERE id = _target.id
    AND owner_id = _owner_id
  RETURNING * INTO _target;

  RETURN jsonb_build_object(
    'outcome', CASE WHEN _was_revoked THEN 'already_applied' ELSE 'accepted' END,
    'target', to_jsonb(_target)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_revoke_web_push_endpoint(text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_revoke_web_push_endpoint(text, text)
TO authenticated;
