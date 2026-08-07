-- Keep visible-client in-app reminder checks reliable without turning an empty
-- 60-second poll into durable database and PowerSync traffic.

CREATE OR REPLACE FUNCTION tasks_private.has_claimable_in_app_reminder(
  _owner_id uuid,
  _through_at timestamptz,
  _target_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
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
      AND (
        _target_id IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM public.tasks_reminder_deliveries AS existing_delivery
          WHERE existing_delivery.owner_id = occurrence.owner_id
            AND existing_delivery.occurrence_id = occurrence.id
            AND existing_delivery.target_id = _target_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.tasks_reminder_deliveries AS retryable_delivery
          WHERE retryable_delivery.owner_id = occurrence.owner_id
            AND retryable_delivery.occurrence_id = occurrence.id
            AND retryable_delivery.target_id = _target_id
            AND (
              retryable_delivery.status IN ('scheduled', 'failed')
              OR (
                retryable_delivery.status = 'attempted'
                AND retryable_delivery.last_attempted_at
                  <= clock_timestamp() - interval '2 minutes'
              )
            )
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION tasks_private.has_claimable_in_app_reminder(
  uuid, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;

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

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'tasks-reminder-claim:' || _owner_id::text || ':' || _request_id::text,
    0
  ));

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

  SELECT target.* INTO _target
  FROM public.tasks_delivery_targets AS target
  WHERE target.owner_id = _owner_id
    AND target.channel = 'in_app'
    AND target.endpoint_key = 'account';

  IF NOT tasks_private.has_claimable_in_app_reminder(
    _owner_id, _through_at, _target.id
  ) THEN
    RETURN jsonb_build_object(
      'outcome', 'accepted',
      'through_at', _through_at,
      'items', '[]'::jsonb
    );
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
  IF jsonb_array_length(_items) > 0 THEN
    INSERT INTO public.tasks_reminder_claims(id, owner_id, through_at, result)
    VALUES (_request_id, _owner_id, _through_at, _result);
  END IF;
  RETURN _result;
END
$$;

REVOKE ALL ON FUNCTION public.tasks_claim_due_reminders(timestamptz, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_claim_due_reminders(timestamptz, uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_claim_due_reminders_v2(
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
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to claim reminders'
      USING ERRCODE = '42501';
  END IF;
  IF _normalized_surface_key !~ '^(browser|ios|macos):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    OR _normalized_surface_label = ''
    OR char_length(_normalized_surface_label) > 500 THEN
    RAISE EXCEPTION 'The reminder surface is invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'tasks-reminder-claim:' || _owner_id::text || ':' || _request_id::text,
    0
  ));

  SELECT claim.* INTO _claim
  FROM public.tasks_reminder_claims AS claim
  WHERE claim.id = _request_id AND claim.owner_id = _owner_id;
  IF FOUND THEN
    IF _claim.through_at IS DISTINCT FROM _through_at
      OR _claim.result ->> 'surface_key' IS DISTINCT FROM _normalized_surface_key THEN
      RAISE EXCEPTION 'A reminder claim identifier cannot be reused with another request'
        USING ERRCODE = '23514';
    END IF;
    RETURN _claim.result;
  END IF;

  SELECT target.* INTO _target
  FROM public.tasks_delivery_targets AS target
  WHERE target.owner_id = _owner_id
    AND target.channel = 'in_app'
    AND target.endpoint_key = _normalized_surface_key;

  IF NOT tasks_private.has_claimable_in_app_reminder(
    _owner_id, _through_at, _target.id
  ) THEN
    RETURN jsonb_build_object(
      'outcome', 'accepted',
      'through_at', _through_at,
      'surface_key', _normalized_surface_key,
      'items', '[]'::jsonb
    );
  END IF;

  INSERT INTO public.tasks_delivery_targets (
    owner_id, channel, endpoint_key, label, capability_status,
    configuration, last_seen_at
  ) VALUES (
    _owner_id, 'in_app', _normalized_surface_key, _normalized_surface_label, 'active',
    '{}'::jsonb, clock_timestamp()
  )
  ON CONFLICT (owner_id, channel, endpoint_key) DO UPDATE
  SET label = EXCLUDED.label,
      capability_status = 'active',
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
    'surface_key', _normalized_surface_key,
    'items', _items
  );
  IF jsonb_array_length(_items) > 0 THEN
    INSERT INTO public.tasks_reminder_claims(id, owner_id, through_at, result)
    VALUES (_request_id, _owner_id, _through_at, _result);
  END IF;
  RETURN _result;
END
$$;

REVOKE ALL ON FUNCTION public.tasks_claim_due_reminders_v2(
  timestamptz, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_claim_due_reminders_v2(
  timestamptz, uuid, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.purge_expired_reminder_claims(
  _cutoff_at timestamptz DEFAULT (clock_timestamp() - interval '24 hours')
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _deleted_count integer;
BEGIN
  IF _cutoff_at IS NULL THEN
    RAISE EXCEPTION 'The reminder-claim retention cutoff is required'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.tasks_reminder_claims
  WHERE created_at < _cutoff_at;
  GET DIAGNOSTICS _deleted_count = ROW_COUNT;
  RETURN _deleted_count;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.purge_expired_reminder_claims(timestamptz)
FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA tasks_private TO service_role;
GRANT EXECUTE ON FUNCTION tasks_private.purge_expired_reminder_claims(timestamptz)
TO service_role;

-- Remove the historical empty receipts immediately. The same bounded cleanup
-- then runs hourly where pg_cron is available.
SELECT tasks_private.purge_expired_reminder_claims();

DO $schedule_retention$
DECLARE
  _job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR _job_id IN
      SELECT jobid FROM cron.job WHERE jobname = 'tasks-purge-reminder-claims'
    LOOP
      PERFORM cron.unschedule(_job_id);
    END LOOP;
    PERFORM cron.schedule(
      'tasks-purge-reminder-claims',
      '17 * * * *',
      'SELECT tasks_private.purge_expired_reminder_claims();'
    );
  END IF;
END
$schedule_retention$;

-- Claim receipts are server-only operational records. They are deliberately
-- retained for RPC idempotency but no longer published or granted to PowerSync.
DO $contract_publication$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'powersync'
      AND schemaname = 'public'
      AND tablename = 'tasks_reminder_claims'
  ) THEN
    ALTER PUBLICATION powersync DROP TABLE public.tasks_reminder_claims;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tasks_powersync_role') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.tasks_reminder_claims FROM tasks_powersync_role';
  END IF;
END
$contract_publication$;
