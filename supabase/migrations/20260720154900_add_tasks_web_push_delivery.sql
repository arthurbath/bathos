-- Standards-based Web Push registration and provider delivery for task reminders.

CREATE TABLE public.tasks_web_push_subscriptions (
  target_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL CHECK (
    endpoint = btrim(endpoint)
    AND endpoint ~ '^https://[^[:space:]]+$'
    AND char_length(endpoint) <= 2048
  ),
  p256dh text NOT NULL CHECK (
    p256dh ~ '^[A-Za-z0-9_-]+={0,2}$'
    AND char_length(p256dh) BETWEEN 40 AND 200
  ),
  auth_secret text NOT NULL CHECK (
    auth_secret ~ '^[A-Za-z0-9_-]+={0,2}$'
    AND char_length(auth_secret) BETWEEN 12 AND 100
  ),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tasks_web_push_subscriptions_target_owner_fkey
    FOREIGN KEY (target_id, owner_id)
    REFERENCES public.tasks_delivery_targets(id, owner_id)
    ON DELETE CASCADE,
  UNIQUE (owner_id, endpoint)
);

ALTER TABLE public.tasks_web_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_web_push_subscriptions_service_role_all
ON public.tasks_web_push_subscriptions
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

REVOKE ALL ON TABLE public.tasks_web_push_subscriptions
FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.tasks_web_push_subscriptions TO service_role;

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
    extensions.digest(convert_to(_normalized_endpoint, 'UTF8'), 'sha256'),
    'hex'
  );

  SELECT target.* INTO _target
  FROM public.tasks_delivery_targets AS target
  WHERE target.owner_id = _owner_id
    AND target.channel = 'web_push'
    AND target.endpoint_key = _endpoint_key
  FOR UPDATE;
  _was_existing := FOUND;

  IF _was_existing AND _target.capability_status = 'revoked' AND NOT _reactivate_revoked THEN
    RETURN jsonb_build_object(
      'outcome', 'revoked',
      'target', to_jsonb(_target)
    );
  END IF;

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
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_register_web_push_target(
  text, text, text, text, boolean
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_revoke_web_push_target(
  _target_id uuid,
  _reason text DEFAULT 'user_disabled'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _target public.tasks_delivery_targets;
  _normalized_reason text := COALESCE(NULLIF(btrim(_reason), ''), 'user_disabled');
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to disable Web Push'
      USING ERRCODE = '42501';
  END IF;
  IF char_length(_normalized_reason) > 100
    OR _normalized_reason !~ '^[a-z0-9_:-]+$' THEN
    RAISE EXCEPTION 'The Web Push revocation reason is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT target.* INTO _target
  FROM public.tasks_delivery_targets AS target
  WHERE target.id = _target_id
    AND target.owner_id = _owner_id
    AND target.channel = 'web_push'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The Web Push target is unavailable' USING ERRCODE = '22023';
  END IF;

  IF _target.capability_status = 'revoked' THEN
    RETURN jsonb_build_object('outcome', 'already_applied', 'target', to_jsonb(_target));
  END IF;

  DELETE FROM public.tasks_web_push_subscriptions
  WHERE target_id = _target.id AND owner_id = _owner_id;

  UPDATE public.tasks_reminder_deliveries
  SET status = 'canceled', updated_at = clock_timestamp()
  WHERE owner_id = _owner_id AND target_id = _target.id
    AND status NOT IN ('acknowledged', 'canceled');

  UPDATE public.tasks_delivery_targets
  SET capability_status = 'revoked',
      last_error_code = _normalized_reason,
      updated_at = clock_timestamp()
  WHERE id = _target.id AND owner_id = _owner_id
  RETURNING * INTO _target;

  RETURN jsonb_build_object('outcome', 'accepted', 'target', to_jsonb(_target));
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_revoke_web_push_target(uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_revoke_web_push_target(uuid, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_claim_web_push_deliveries(
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
    RAISE EXCEPTION 'Service authorization is required to dispatch Web Push'
      USING ERRCODE = '42501';
  END IF;
  IF _through_at IS NULL OR _limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'The Web Push claim is invalid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tasks_reminder_deliveries (
    owner_id, occurrence_id, target_id
  )
  SELECT occurrence.owner_id, occurrence.id, target.id
  FROM public.tasks_reminder_occurrences AS occurrence
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id
   AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_delivery_targets AS target
    ON target.owner_id = occurrence.owner_id
   AND target.channel = 'web_push'
   AND target.capability_status = 'active'
  JOIN public.tasks_web_push_subscriptions AS subscription
    ON subscription.target_id = target.id
   AND subscription.owner_id = target.owner_id
  LEFT JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id AND task.owner_id = reminder.owner_id
  LEFT JOIN public.tasks_projects AS project
    ON project.id = reminder.project_id AND project.owner_id = reminder.owner_id
  WHERE occurrence.status = 'scheduled'
    AND occurrence.resolved_at <= _through_at
    AND reminder.status = 'active'
    AND ((reminder.root_type = 'todo'
      AND task.lifecycle = 'open' AND task.disposition = 'present')
      OR (reminder.root_type = 'project'
      AND project.lifecycle = 'open' AND project.disposition = 'present'))
    AND NOT EXISTS (
      SELECT 1
      FROM public.tasks_reminder_deliveries AS acknowledged
      WHERE acknowledged.owner_id = occurrence.owner_id
        AND acknowledged.occurrence_id = occurrence.id
        AND acknowledged.status = 'acknowledged'
    )
  ON CONFLICT (owner_id, occurrence_id, target_id) DO NOTHING;

  WITH eligible AS (
    SELECT delivery.id
    FROM public.tasks_reminder_deliveries AS delivery
    JOIN public.tasks_reminder_occurrences AS occurrence
      ON occurrence.id = delivery.occurrence_id
     AND occurrence.owner_id = delivery.owner_id
    JOIN public.tasks_delivery_targets AS target
      ON target.id = delivery.target_id
     AND target.owner_id = delivery.owner_id
    JOIN public.tasks_web_push_subscriptions AS subscription
      ON subscription.target_id = target.id
     AND subscription.owner_id = target.owner_id
    WHERE target.channel = 'web_push'
      AND target.capability_status = 'active'
      AND occurrence.status = 'scheduled'
      AND occurrence.resolved_at <= _through_at
      AND (
        delivery.status = 'scheduled'
        OR (delivery.status IN ('attempted', 'failed')
          AND delivery.last_attempted_at <= clock_timestamp() - interval '2 minutes')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.tasks_reminder_deliveries AS acknowledged
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
    'reminder_id', reminder.id,
    'target_id', target.id,
    'root_type', reminder.root_type,
    'root_id', COALESCE(reminder.task_id, reminder.project_id),
    'title', COALESCE(task.title, project.title),
    'resolved_at', occurrence.resolved_at,
    'attempt_count', delivery.attempt_count,
    'preview', COALESCE(target.configuration ->> 'preview', 'generic'),
    'navigate_url', CASE
      WHEN reminder.root_type = 'project' THEN
        '/tasks/projects/' || reminder.project_id::text
      ELSE '/tasks/' || CASE task.destination
        WHEN 'inbox' THEN 'inbox'
        WHEN 'anytime' THEN 'anytime'
        WHEN 'someday' THEN 'someday'
        ELSE 'today'
      END
    END || '?reminder_delivery=' || delivery.id::text,
    'subscription', jsonb_build_object(
      'endpoint', subscription.endpoint,
      'keys', jsonb_build_object(
        'p256dh', subscription.p256dh,
        'auth', subscription.auth_secret
      )
    )
  ) ORDER BY occurrence.resolved_at, delivery.id), '[]'::jsonb)
  INTO _items
  FROM updated AS delivery
  JOIN public.tasks_reminder_occurrences AS occurrence
    ON occurrence.id = delivery.occurrence_id
   AND occurrence.owner_id = delivery.owner_id
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id
   AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_delivery_targets AS target
    ON target.id = delivery.target_id
   AND target.owner_id = delivery.owner_id
  JOIN public.tasks_web_push_subscriptions AS subscription
    ON subscription.target_id = target.id
   AND subscription.owner_id = target.owner_id
  LEFT JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id AND task.owner_id = reminder.owner_id
  LEFT JOIN public.tasks_projects AS project
    ON project.id = reminder.project_id AND project.owner_id = reminder.owner_id;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'through_at', _through_at,
    'items', _items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_claim_web_push_deliveries(timestamptz, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_claim_web_push_deliveries(timestamptz, integer)
TO service_role;

CREATE OR REPLACE FUNCTION public.tasks_record_web_push_delivery_result(
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
    RAISE EXCEPTION 'Service authorization is required to record Web Push delivery'
      USING ERRCODE = '42501';
  END IF;
  IF _outcome NOT IN ('provider_accepted', 'failed')
    OR char_length(COALESCE(_provider_message_id, '')) > 500
    OR char_length(COALESCE(_normalized_error, '')) > 200 THEN
    RAISE EXCEPTION 'The Web Push delivery result is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT delivery.* INTO _delivery
  FROM public.tasks_reminder_deliveries AS delivery
  WHERE delivery.id = _delivery_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The Web Push delivery is unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT target.* INTO _target
  FROM public.tasks_delivery_targets AS target
  WHERE target.id = _delivery.target_id
    AND target.owner_id = _delivery.owner_id
    AND target.channel = 'web_push'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The Web Push target is unavailable' USING ERRCODE = '22023';
  END IF;

  IF _delivery.status IN ('provider_accepted', 'acknowledged', 'canceled') THEN
    RETURN jsonb_build_object(
      'outcome', CASE WHEN _delivery.status = 'canceled' THEN 'canceled'
        ELSE 'already_applied' END,
      'delivery', to_jsonb(_delivery),
      'target', to_jsonb(_target)
    );
  END IF;

  IF _outcome = 'provider_accepted' THEN
    UPDATE public.tasks_reminder_deliveries
    SET status = 'provider_accepted',
        provider_accepted_at = COALESCE(provider_accepted_at, clock_timestamp()),
        provider_message_id = NULLIF(btrim(_provider_message_id), ''),
        last_error_code = NULL,
        updated_at = clock_timestamp()
    WHERE id = _delivery.id
    RETURNING * INTO _delivery;

    UPDATE public.tasks_delivery_targets
    SET capability_status = 'active',
        last_error_code = NULL,
        updated_at = clock_timestamp()
    WHERE id = _target.id AND owner_id = _target.owner_id
    RETURNING * INTO _target;
  ELSE
    _normalized_error := COALESCE(_normalized_error, 'provider_error');
    UPDATE public.tasks_reminder_deliveries
    SET status = 'failed',
        last_error_code = _normalized_error,
        updated_at = clock_timestamp()
    WHERE id = _delivery.id
    RETURNING * INTO _delivery;

    UPDATE public.tasks_delivery_targets
    SET capability_status = CASE WHEN _target_revoked THEN 'revoked' ELSE 'degraded' END,
        last_error_code = _normalized_error,
        updated_at = clock_timestamp()
    WHERE id = _target.id AND owner_id = _target.owner_id
    RETURNING * INTO _target;

    IF _target_revoked THEN
      DELETE FROM public.tasks_web_push_subscriptions
      WHERE target_id = _target.id AND owner_id = _target.owner_id;
      UPDATE public.tasks_reminder_deliveries
      SET status = 'canceled', updated_at = clock_timestamp()
      WHERE owner_id = _target.owner_id AND target_id = _target.id
        AND id <> _delivery.id
        AND status NOT IN ('acknowledged', 'canceled');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'delivery', to_jsonb(_delivery),
    'target', to_jsonb(_target)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_record_web_push_delivery_result(
  uuid, text, text, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_record_web_push_delivery_result(
  uuid, text, text, text, boolean
) TO service_role;

CREATE OR REPLACE FUNCTION tasks_private.prevent_acknowledged_reminder_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tasks_reminder_deliveries AS delivery
    WHERE delivery.owner_id = NEW.owner_id
      AND delivery.occurrence_id = NEW.occurrence_id
      AND delivery.status = 'acknowledged'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.prevent_acknowledged_reminder_delivery()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_reminder_deliveries_skip_acknowledged_occurrence
BEFORE INSERT ON public.tasks_reminder_deliveries
FOR EACH ROW EXECUTE FUNCTION tasks_private.prevent_acknowledged_reminder_delivery();

CREATE OR REPLACE FUNCTION public.tasks_acknowledge_reminder_delivery(
  _delivery_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _delivery public.tasks_reminder_deliveries;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to acknowledge reminders'
      USING ERRCODE = '42501';
  END IF;
  SELECT delivery.* INTO _delivery
  FROM public.tasks_reminder_deliveries AS delivery
  JOIN public.tasks_delivery_targets AS target
    ON target.id = delivery.target_id AND target.owner_id = delivery.owner_id
  WHERE delivery.id = _delivery_id AND delivery.owner_id = _owner_id
    AND target.channel IN ('in_app', 'web_push')
  FOR UPDATE OF delivery;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The reminder delivery is unavailable' USING ERRCODE = '22023';
  END IF;
  IF _delivery.status = 'acknowledged' THEN
    RETURN jsonb_build_object('outcome', 'already_applied', 'delivery', to_jsonb(_delivery));
  END IF;
  IF _delivery.status = 'canceled' THEN
    RETURN jsonb_build_object('outcome', 'canceled', 'delivery', to_jsonb(_delivery));
  END IF;

  UPDATE public.tasks_reminder_deliveries
  SET status = 'acknowledged',
      acknowledged_at = COALESCE(acknowledged_at, clock_timestamp()),
      updated_at = clock_timestamp()
  WHERE owner_id = _owner_id
    AND occurrence_id = _delivery.occurrence_id
    AND status <> 'canceled';

  SELECT delivery.* INTO _delivery
  FROM public.tasks_reminder_deliveries AS delivery
  WHERE delivery.id = _delivery_id AND delivery.owner_id = _owner_id;

  RETURN jsonb_build_object('outcome', 'accepted', 'delivery', to_jsonb(_delivery));
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_acknowledge_reminder_delivery(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_acknowledge_reminder_delivery(uuid)
TO authenticated;
