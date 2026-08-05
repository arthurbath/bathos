-- Keep reminder intent eligible, one-shot, and synchronized with task planning.

CREATE OR REPLACE FUNCTION tasks_private.retire_task_reminder(
  _owner_id uuid,
  _reminder_id uuid,
  _mutation_channel text,
  _actor_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _mutation_id uuid := gen_random_uuid();
BEGIN
  UPDATE public.tasks_reminder_occurrences
  SET status = 'canceled'
  WHERE owner_id = _owner_id
    AND reminder_id = _reminder_id
    AND status = 'scheduled';

  UPDATE public.tasks_reminder_deliveries AS delivery
  SET status = 'canceled', updated_at = clock_timestamp()
  FROM public.tasks_reminder_occurrences AS occurrence
  WHERE occurrence.id = delivery.occurrence_id
    AND occurrence.owner_id = delivery.owner_id
    AND occurrence.owner_id = _owner_id
    AND occurrence.reminder_id = _reminder_id
    AND delivery.status NOT IN (
      'provider_accepted', 'acknowledged', 'canceled'
    );

  UPDATE public.tasks_reminders
  SET status = 'canceled',
      record_revision = record_revision + 1,
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type,
      client_mutation_id = _mutation_id,
      updated_at = clock_timestamp()
  WHERE id = _reminder_id
    AND owner_id = _owner_id
    AND status = 'active';
END
$$;

REVOKE ALL ON FUNCTION tasks_private.retire_task_reminder(
  uuid, uuid, text, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION tasks_private.rebind_root_reminder_to_start_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _reminder public.tasks_reminders;
  _effective_date date;
  _resolved_at timestamptz;
  _resolution_kind text;
  _mutation_id uuid;
  _automatic_activation boolean := COALESCE(
    current_setting('garden.bath.tasks_activation', true), ''
  ) = 'on';
BEGIN
  IF NEW.destination IS NOT DISTINCT FROM OLD.destination
    AND NEW.start_date IS NOT DISTINCT FROM OLD.start_date
    AND NEW.today_section IS NOT DISTINCT FROM OLD.today_section THEN
    RETURN NEW;
  END IF;

  _effective_date := CASE
    WHEN NEW.destination = 'anytime' THEN
      tasks_private.root_effective_reminder_date(
        NEW.owner_id, 'todo', NEW.id
      )
    ELSE NULL
  END;
  IF _automatic_activation
    AND OLD.start_date IS NOT NULL
    AND NEW.start_date IS NULL
    AND NEW.today_section IS NOT NULL THEN
    _effective_date := OLD.start_date;
  END IF;

  FOR _reminder IN
    SELECT reminder.*
    FROM public.tasks_reminders AS reminder
    WHERE reminder.owner_id = NEW.owner_id
      AND reminder.status = 'active'
      AND reminder.task_id = NEW.id
    FOR UPDATE
  LOOP
    IF _effective_date IS NULL THEN
      PERFORM tasks_private.retire_task_reminder(
        NEW.owner_id, _reminder.id, NEW.last_mutation_channel, 'system'
      );
      CONTINUE;
    END IF;

    SELECT resolution.resolved_at, resolution.resolution_kind
    INTO _resolved_at, _resolution_kind
    FROM tasks_private.resolve_reminder_instant(
      _effective_date, _reminder.local_time, _reminder.time_zone,
      _reminder.ambiguity_choice
    ) AS resolution;

    IF NOT _automatic_activation AND _resolved_at <= clock_timestamp() THEN
      PERFORM tasks_private.retire_task_reminder(
        NEW.owner_id, _reminder.id, NEW.last_mutation_channel, 'system'
      );
      CONTINUE;
    END IF;

    IF _effective_date = _reminder.local_date THEN
      CONTINUE;
    END IF;

    _mutation_id := gen_random_uuid();
    UPDATE public.tasks_reminder_occurrences
    SET status = 'canceled'
    WHERE owner_id = NEW.owner_id
      AND reminder_id = _reminder.id
      AND status = 'scheduled';
    UPDATE public.tasks_reminder_deliveries AS delivery
    SET status = 'canceled', updated_at = clock_timestamp()
    FROM public.tasks_reminder_occurrences AS occurrence
    WHERE occurrence.id = delivery.occurrence_id
      AND occurrence.owner_id = delivery.owner_id
      AND occurrence.owner_id = NEW.owner_id
      AND occurrence.reminder_id = _reminder.id
      AND delivery.status NOT IN ('acknowledged', 'canceled');
    UPDATE public.tasks_reminders
    SET local_date = _effective_date,
        resolved_at = _resolved_at,
        resolution_kind = _resolution_kind,
        record_revision = record_revision + 1,
        last_mutation_channel = NEW.last_mutation_channel,
        last_actor_type = 'system',
        client_mutation_id = _mutation_id,
        updated_at = clock_timestamp()
    WHERE id = _reminder.id AND owner_id = NEW.owner_id
    RETURNING * INTO _reminder;
    INSERT INTO public.tasks_reminder_occurrences (
      owner_id, reminder_id, reminder_revision, resolved_at, client_mutation_id
    ) VALUES (
      NEW.owner_id, _reminder.id, _reminder.record_revision,
      _reminder.resolved_at, _mutation_id
    );
  END LOOP;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tasks_todos_rebind_reminder_to_start_date
ON public.tasks_todos;
CREATE TRIGGER tasks_todos_rebind_reminder_to_start_date
AFTER UPDATE OF destination, start_date, today_section ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.rebind_root_reminder_to_start_date();

REVOKE ALL ON FUNCTION tasks_private.rebind_root_reminder_to_start_date()
FROM PUBLIC, anon, authenticated;

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
  _reminder_id uuid;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to acknowledge reminders'
      USING ERRCODE = '42501';
  END IF;
  SELECT delivery.*
  INTO _delivery
  FROM public.tasks_reminder_deliveries AS delivery
  JOIN public.tasks_delivery_targets AS target
    ON target.id = delivery.target_id AND target.owner_id = delivery.owner_id
  WHERE delivery.id = _delivery_id AND delivery.owner_id = _owner_id
    AND target.channel IN ('in_app', 'web_push')
  FOR UPDATE OF delivery;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The reminder delivery is unavailable' USING ERRCODE = '22023';
  END IF;
  SELECT occurrence.reminder_id
  INTO _reminder_id
  FROM public.tasks_reminder_occurrences AS occurrence
  WHERE occurrence.id = _delivery.occurrence_id
    AND occurrence.owner_id = _delivery.owner_id;
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

  PERFORM tasks_private.retire_task_reminder(
    _owner_id, _reminder_id, 'web', 'user'
  );

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

    PERFORM tasks_private.retire_task_reminder(
      _delivery.owner_id, _reminder_id, 'native', 'system'
    );
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
