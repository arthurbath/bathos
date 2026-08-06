-- Preserve an open surface's in-app reminder fallback after another registered
-- browser has accepted the same reminder through Web Push. Provider acceptance
-- retires the one-shot reminder intent, but only user acknowledgement retires
-- the occurrence and every remaining delivery channel.

CREATE OR REPLACE FUNCTION public.tasks_claim_due_reminders(
  _through_at timestamptz,
  _request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _target public.tasks_delivery_targets;
  _claim public.tasks_reminder_claims;
  _items jsonb;
  _result jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to claim reminders'
      USING ERRCODE = '42501';
  END IF;
  SELECT claim.* INTO _claim
  FROM public.tasks_reminder_claims AS claim
  WHERE claim.id = _request_id AND claim.owner_id = _owner_id;
  IF FOUND THEN
    IF _claim.through_at IS DISTINCT FROM _through_at THEN
      RAISE EXCEPTION 'A reminder claim identifier cannot be reused with another time'
        USING ERRCODE = '23514';
    END IF;
    RETURN _claim.result;
  END IF;
  INSERT INTO public.tasks_delivery_targets (
    owner_id, channel, endpoint_key, label, capability_status,
    configuration, last_seen_at
  ) VALUES (
    _owner_id, 'in_app', 'account', 'In-App', 'active',
    '{}'::jsonb, clock_timestamp()
  )
  ON CONFLICT (owner_id, channel, endpoint_key) DO UPDATE
  SET capability_status = 'active',
      last_error_code = NULL,
      last_seen_at = clock_timestamp(),
      updated_at = clock_timestamp()
  RETURNING * INTO _target;

  INSERT INTO public.tasks_reminder_deliveries (
    owner_id, occurrence_id, target_id
  )
  SELECT _owner_id, occurrence.id, _target.id
  FROM public.tasks_reminder_occurrences AS occurrence
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id
   AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id
   AND task.owner_id = reminder.owner_id
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.status = 'scheduled'
    AND occurrence.resolved_at <= _through_at
    AND (
      reminder.status = 'active'
      OR (
        reminder.status = 'canceled'
        AND EXISTS (
          SELECT 1
          FROM public.tasks_reminder_deliveries AS accepted_delivery
          JOIN public.tasks_delivery_targets AS accepted_target
            ON accepted_target.id = accepted_delivery.target_id
           AND accepted_target.owner_id = accepted_delivery.owner_id
          WHERE accepted_delivery.owner_id = occurrence.owner_id
            AND accepted_delivery.occurrence_id = occurrence.id
            AND accepted_delivery.status = 'provider_accepted'
            AND accepted_target.channel = 'web_push'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.tasks_reminder_deliveries AS acknowledged_delivery
          WHERE acknowledged_delivery.owner_id = occurrence.owner_id
            AND acknowledged_delivery.occurrence_id = occurrence.id
            AND acknowledged_delivery.status = 'acknowledged'
        )
      )
    )
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
  ON CONFLICT (owner_id, occurrence_id, target_id) DO NOTHING;

  WITH eligible AS (
    SELECT delivery.id
    FROM public.tasks_reminder_deliveries AS delivery
    JOIN public.tasks_reminder_occurrences AS occurrence
      ON occurrence.id = delivery.occurrence_id
     AND occurrence.owner_id = delivery.owner_id
    WHERE delivery.owner_id = _owner_id
      AND delivery.target_id = _target.id
      AND occurrence.resolved_at <= _through_at
      AND (
        delivery.status IN ('scheduled', 'failed')
        OR (
          delivery.status = 'attempted'
          AND delivery.last_attempted_at <= clock_timestamp() - interval '2 minutes'
        )
      )
    ORDER BY occurrence.resolved_at, delivery.id
    FOR UPDATE OF delivery SKIP LOCKED
  ),
  updated AS (
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
    'root_type', 'todo',
    'root_id', reminder.task_id,
    'title', task.title,
    'resolved_at', occurrence.resolved_at,
    'attempt_count', delivery.attempt_count
  ) ORDER BY occurrence.resolved_at, delivery.id), '[]'::jsonb)
  INTO _items
  FROM updated AS delivery
  JOIN public.tasks_reminder_occurrences AS occurrence
    ON occurrence.id = delivery.occurrence_id
   AND occurrence.owner_id = delivery.owner_id
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id
   AND reminder.owner_id = occurrence.owner_id
  JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id
   AND task.owner_id = reminder.owner_id;
  _result := jsonb_build_object(
    'outcome', 'accepted',
    'through_at', _through_at,
    'items', _items
  );
  INSERT INTO public.tasks_reminder_claims(id, owner_id, through_at, result)
  VALUES (_request_id, _owner_id, _through_at, _result);
  RETURN _result;
END
$$;

REVOKE ALL ON FUNCTION public.tasks_claim_due_reminders(timestamptz, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_claim_due_reminders(timestamptz, uuid)
TO authenticated;

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
  _reminder_id uuid;
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

  SELECT delivery.*
  INTO _delivery
  FROM public.tasks_reminder_deliveries AS delivery
  WHERE delivery.id = _delivery_id
  FOR UPDATE OF delivery;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The Web Push delivery is unavailable' USING ERRCODE = '22023';
  END IF;
  SELECT occurrence.reminder_id
  INTO _reminder_id
  FROM public.tasks_reminder_occurrences AS occurrence
  WHERE occurrence.id = _delivery.occurrence_id
    AND occurrence.owner_id = _delivery.owner_id;

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

    UPDATE public.tasks_reminders
    SET status = 'canceled',
        record_revision = record_revision + 1,
        last_mutation_channel = 'native',
        last_actor_type = 'system',
        client_mutation_id = gen_random_uuid(),
        updated_at = clock_timestamp()
    WHERE id = _reminder_id
      AND owner_id = _delivery.owner_id
      AND status = 'active';
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
