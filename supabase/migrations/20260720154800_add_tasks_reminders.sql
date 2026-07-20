-- Canonical task reminders and server-owned delivery identity.

CREATE TABLE public.tasks_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  root_type text NOT NULL CHECK (root_type IN ('todo', 'project')),
  task_id uuid,
  project_id uuid,
  local_date date NOT NULL,
  local_time time(0) without time zone NOT NULL,
  time_zone text NOT NULL CHECK (
    time_zone = btrim(time_zone)
    AND time_zone <> ''
    AND char_length(time_zone) <= 255
  ),
  ambiguity_choice text NOT NULL DEFAULT 'earlier'
    CHECK (ambiguity_choice IN ('earlier', 'later')),
  resolved_at timestamptz NOT NULL,
  resolution_kind text NOT NULL
    CHECK (resolution_kind IN (
      'exact', 'gap_forward', 'ambiguous_earlier', 'ambiguous_later'
    )),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  record_revision bigint NOT NULL DEFAULT 1 CHECK (record_revision > 0),
  last_mutation_channel text NOT NULL DEFAULT 'web'
    CHECK (last_mutation_channel IN (
      'web', 'raycast', 'mcp', 'mail_automation', 'browser_capture',
      'native', 'import'
    )),
  last_actor_type text NOT NULL DEFAULT 'user'
    CHECK (last_actor_type IN ('user', 'automation', 'system', 'import')),
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tasks_reminders_root_shape_check CHECK (
    (root_type = 'todo' AND task_id IS NOT NULL AND project_id IS NULL)
    OR (root_type = 'project' AND project_id IS NOT NULL AND task_id IS NULL)
  ),
  CONSTRAINT tasks_reminders_task_owner_fkey
    FOREIGN KEY (task_id, owner_id)
    REFERENCES public.tasks_todos(id, owner_id)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT tasks_reminders_project_owner_fkey
    FOREIGN KEY (project_id, owner_id)
    REFERENCES public.tasks_projects(id, owner_id)
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (id, owner_id)
);

CREATE UNIQUE INDEX tasks_reminders_owner_active_task_idx
ON public.tasks_reminders(owner_id, task_id)
WHERE status = 'active' AND task_id IS NOT NULL;

CREATE UNIQUE INDEX tasks_reminders_owner_active_project_idx
ON public.tasks_reminders(owner_id, project_id)
WHERE status = 'active' AND project_id IS NOT NULL;

CREATE INDEX tasks_reminders_owner_resolved_idx
ON public.tasks_reminders(owner_id, resolved_at, id)
WHERE status = 'active';

CREATE TABLE public.tasks_reminder_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id uuid NOT NULL,
  reminder_revision bigint NOT NULL CHECK (reminder_revision > 0),
  resolved_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'canceled')),
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tasks_reminder_occurrences_reminder_owner_fkey
    FOREIGN KEY (reminder_id, owner_id)
    REFERENCES public.tasks_reminders(id, owner_id)
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (id, owner_id),
  UNIQUE (owner_id, reminder_id, reminder_revision)
);

CREATE INDEX tasks_reminder_occurrences_owner_due_idx
ON public.tasks_reminder_occurrences(owner_id, resolved_at, id)
WHERE status = 'scheduled';

CREATE TABLE public.tasks_delivery_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app', 'web_push', 'native_push')),
  endpoint_key text NOT NULL CHECK (
    endpoint_key = btrim(endpoint_key)
    AND endpoint_key <> ''
    AND char_length(endpoint_key) <= 1000
  ),
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 500),
  capability_status text NOT NULL DEFAULT 'active'
    CHECK (capability_status IN ('active', 'degraded', 'revoked')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(configuration) = 'object'),
  last_error_code text,
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (id, owner_id),
  UNIQUE (owner_id, channel, endpoint_key)
);

CREATE INDEX tasks_delivery_targets_owner_status_idx
ON public.tasks_delivery_targets(owner_id, capability_status, channel, id);

CREATE TABLE public.tasks_reminder_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurrence_id uuid NOT NULL,
  target_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN (
      'scheduled', 'attempted', 'provider_accepted', 'failed',
      'acknowledged', 'canceled'
    )),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempted_at timestamptz,
  provider_accepted_at timestamptz,
  acknowledged_at timestamptz,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tasks_reminder_deliveries_occurrence_owner_fkey
    FOREIGN KEY (occurrence_id, owner_id)
    REFERENCES public.tasks_reminder_occurrences(id, owner_id)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT tasks_reminder_deliveries_target_owner_fkey
    FOREIGN KEY (target_id, owner_id)
    REFERENCES public.tasks_delivery_targets(id, owner_id)
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (id, owner_id),
  UNIQUE (owner_id, occurrence_id, target_id)
);

CREATE INDEX tasks_reminder_deliveries_owner_status_idx
ON public.tasks_reminder_deliveries(owner_id, status, updated_at, id);

CREATE TABLE public.tasks_reminder_claims (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  through_at timestamptz NOT NULL,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (id, owner_id)
);

ALTER TABLE public.tasks_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_reminder_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_delivery_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_reminder_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_reminder_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_reminders_owner_select ON public.tasks_reminders
FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY tasks_reminder_occurrences_owner_select ON public.tasks_reminder_occurrences
FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY tasks_delivery_targets_owner_select ON public.tasks_delivery_targets
FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY tasks_reminder_deliveries_owner_select ON public.tasks_reminder_deliveries
FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY tasks_reminder_claims_owner_select ON public.tasks_reminder_claims
FOR SELECT TO authenticated USING (owner_id = auth.uid());

REVOKE ALL ON TABLE public.tasks_reminders FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.tasks_reminder_occurrences FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.tasks_delivery_targets FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.tasks_reminder_deliveries FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.tasks_reminder_claims FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.tasks_reminders TO authenticated;
GRANT SELECT ON TABLE public.tasks_reminder_occurrences TO authenticated;
GRANT SELECT ON TABLE public.tasks_delivery_targets TO authenticated;
GRANT SELECT ON TABLE public.tasks_reminder_deliveries TO authenticated;
GRANT SELECT ON TABLE public.tasks_reminder_claims TO authenticated;
GRANT ALL ON TABLE public.tasks_reminders TO service_role;
GRANT ALL ON TABLE public.tasks_reminder_occurrences TO service_role;
GRANT ALL ON TABLE public.tasks_delivery_targets TO service_role;
GRANT ALL ON TABLE public.tasks_reminder_deliveries TO service_role;
GRANT ALL ON TABLE public.tasks_reminder_claims TO service_role;

CREATE OR REPLACE FUNCTION tasks_private.resolve_reminder_instant(
  _local_date date,
  _local_time time(0) without time zone,
  _time_zone text,
  _ambiguity_choice text DEFAULT 'earlier'
)
RETURNS TABLE(resolved_at timestamptz, resolution_kind text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _requested_local timestamp without time zone := _local_date + _local_time;
  _resolved_local timestamp without time zone;
  _default_instant timestamptz;
  _earlier timestamptz;
  _later timestamptz;
  _candidate_count integer;
  _gap_minutes integer := 0;
BEGIN
  IF _local_date IS NULL OR _local_time IS NULL
    OR _ambiguity_choice NOT IN ('earlier', 'later')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = _time_zone) THEN
    RAISE EXCEPTION 'A valid local reminder time and IANA time zone are required'
      USING ERRCODE = '22023';
  END IF;

  FOR _minute IN 0..1440 LOOP
    _resolved_local := _requested_local + make_interval(mins => _minute);
    _default_instant := _resolved_local AT TIME ZONE _time_zone;
    IF (_default_instant AT TIME ZONE _time_zone) = _resolved_local THEN
      _gap_minutes := _minute;
      EXIT;
    END IF;
  END LOOP;
  IF (_default_instant AT TIME ZONE _time_zone) <> _resolved_local THEN
    RAISE EXCEPTION 'The reminder time could not be resolved in the selected time zone'
      USING ERRCODE = '22023';
  END IF;

  SELECT min(candidate), max(candidate), count(*)::integer
  INTO _earlier, _later, _candidate_count
  FROM generate_series(
    _default_instant - interval '15 hours',
    _default_instant + interval '15 hours',
    interval '1 minute'
  ) AS candidate
  WHERE candidate AT TIME ZONE _time_zone = _resolved_local;

  IF _gap_minutes > 0 THEN
    resolved_at := _earlier;
    resolution_kind := 'gap_forward';
  ELSIF _candidate_count > 1 AND _ambiguity_choice = 'later' THEN
    resolved_at := _later;
    resolution_kind := 'ambiguous_later';
  ELSIF _candidate_count > 1 THEN
    resolved_at := _earlier;
    resolution_kind := 'ambiguous_earlier';
  ELSE
    resolved_at := _earlier;
    resolution_kind := 'exact';
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.resolve_reminder_instant(
  date, time without time zone, text, text
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_save_reminder(
  _reminder_id uuid,
  _expected_record_revision bigint,
  _root_type text,
  _root_id uuid,
  _local_date date,
  _local_time text,
  _time_zone text,
  _ambiguity_choice text,
  _mutation_id uuid,
  _mutation_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _parsed_time time(0) without time zone;
  _resolved_at timestamptz;
  _resolution_kind text;
  _reminder public.tasks_reminders;
  _occurrence public.tasks_reminder_occurrences;
  _existing public.tasks_reminders;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save reminders' USING ERRCODE = '42501';
  END IF;
  IF _root_type NOT IN ('todo', 'project')
    OR _mutation_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation', 'browser_capture',
      'native', 'import'
    ) OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
    RAISE EXCEPTION 'The reminder request is invalid' USING ERRCODE = '22023';
  END IF;
  BEGIN
    _parsed_time := _local_time::time(0);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'The reminder time is invalid' USING ERRCODE = '22023';
  END;

  IF (_root_type = 'todo' AND NOT EXISTS (
    SELECT 1 FROM public.tasks_todos
    WHERE id = _root_id AND owner_id = _owner_id
      AND disposition = 'present' AND lifecycle = 'open'
  )) OR (_root_type = 'project' AND NOT EXISTS (
    SELECT 1 FROM public.tasks_projects
    WHERE id = _root_id AND owner_id = _owner_id
      AND disposition = 'present' AND lifecycle = 'open'
  )) THEN
    RAISE EXCEPTION 'The reminder target is unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT resolution.resolved_at, resolution.resolution_kind
  INTO _resolved_at, _resolution_kind
  FROM tasks_private.resolve_reminder_instant(
    _local_date, _parsed_time, _time_zone, _ambiguity_choice
  ) AS resolution;

  IF _reminder_id IS NULL THEN
    SELECT reminder.* INTO _existing
    FROM public.tasks_reminders AS reminder
    WHERE reminder.owner_id = _owner_id AND reminder.status = 'active'
      AND ((_root_type = 'todo' AND reminder.task_id = _root_id)
        OR (_root_type = 'project' AND reminder.project_id = _root_id))
    FOR UPDATE;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'outcome', 'conflict', 'reminder', to_jsonb(_existing)
      );
    END IF;
    INSERT INTO public.tasks_reminders (
      owner_id, root_type, task_id, project_id, local_date, local_time,
      time_zone, ambiguity_choice, resolved_at, resolution_kind,
      last_mutation_channel, last_actor_type, client_mutation_id
    ) VALUES (
      _owner_id, _root_type,
      CASE WHEN _root_type = 'todo' THEN _root_id ELSE NULL END,
      CASE WHEN _root_type = 'project' THEN _root_id ELSE NULL END,
      _local_date, _parsed_time, _time_zone, _ambiguity_choice,
      _resolved_at, _resolution_kind, _mutation_channel, _actor_type, _mutation_id
    ) RETURNING * INTO _reminder;
  ELSE
    SELECT reminder.* INTO _reminder
    FROM public.tasks_reminders AS reminder
    WHERE reminder.id = _reminder_id AND reminder.owner_id = _owner_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The reminder is unavailable' USING ERRCODE = '22023';
    END IF;
    IF _reminder.client_mutation_id = _mutation_id THEN
      SELECT occurrence.* INTO _occurrence
      FROM public.tasks_reminder_occurrences AS occurrence
      WHERE occurrence.owner_id = _owner_id
        AND occurrence.reminder_id = _reminder.id
        AND occurrence.reminder_revision = _reminder.record_revision;
      RETURN jsonb_build_object(
        'outcome', 'already_applied',
        'reminder', to_jsonb(_reminder),
        'occurrence', to_jsonb(_occurrence)
      );
    END IF;
    IF _reminder.record_revision <> _expected_record_revision
      OR _reminder.root_type <> _root_type
      OR COALESCE(_reminder.task_id, _reminder.project_id) <> _root_id THEN
      RETURN jsonb_build_object(
        'outcome', 'conflict', 'reminder', to_jsonb(_reminder)
      );
    END IF;
    UPDATE public.tasks_reminder_occurrences
    SET status = 'canceled'
    WHERE owner_id = _owner_id AND reminder_id = _reminder.id
      AND status = 'scheduled';
    UPDATE public.tasks_reminder_deliveries AS delivery
    SET status = 'canceled', updated_at = clock_timestamp()
    FROM public.tasks_reminder_occurrences AS occurrence
    WHERE occurrence.id = delivery.occurrence_id
      AND occurrence.owner_id = delivery.owner_id
      AND occurrence.owner_id = _owner_id
      AND occurrence.reminder_id = _reminder.id
      AND delivery.status NOT IN ('acknowledged', 'canceled');
    UPDATE public.tasks_reminders
    SET local_date = _local_date,
        local_time = _parsed_time,
        time_zone = _time_zone,
        ambiguity_choice = _ambiguity_choice,
        resolved_at = _resolved_at,
        resolution_kind = _resolution_kind,
        status = 'active',
        record_revision = record_revision + 1,
        last_mutation_channel = _mutation_channel,
        last_actor_type = _actor_type,
        client_mutation_id = _mutation_id,
        updated_at = clock_timestamp()
    WHERE id = _reminder.id AND owner_id = _owner_id
    RETURNING * INTO _reminder;
  END IF;

  INSERT INTO public.tasks_reminder_occurrences (
    owner_id, reminder_id, reminder_revision, resolved_at,
    client_mutation_id
  ) VALUES (
    _owner_id, _reminder.id, _reminder.record_revision,
    _reminder.resolved_at, _mutation_id
  ) RETURNING * INTO _occurrence;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'reminder', to_jsonb(_reminder),
    'occurrence', to_jsonb(_occurrence)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_save_reminder(
  uuid, bigint, text, uuid, date, text, text, text, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_save_reminder(
  uuid, bigint, text, uuid, date, text, text, text, uuid, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_cancel_reminder(
  _reminder_id uuid,
  _expected_record_revision bigint,
  _mutation_id uuid,
  _mutation_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _reminder public.tasks_reminders;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to cancel reminders' USING ERRCODE = '42501';
  END IF;
  SELECT reminder.* INTO _reminder
  FROM public.tasks_reminders AS reminder
  WHERE reminder.id = _reminder_id AND reminder.owner_id = _owner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The reminder is unavailable' USING ERRCODE = '22023';
  END IF;
  IF _reminder.client_mutation_id = _mutation_id THEN
    RETURN jsonb_build_object('outcome', 'already_applied', 'reminder', to_jsonb(_reminder));
  END IF;
  IF _reminder.record_revision <> _expected_record_revision THEN
    RETURN jsonb_build_object('outcome', 'conflict', 'reminder', to_jsonb(_reminder));
  END IF;
  UPDATE public.tasks_reminders
  SET status = 'canceled', record_revision = record_revision + 1,
      last_mutation_channel = _mutation_channel, last_actor_type = _actor_type,
      client_mutation_id = _mutation_id, updated_at = clock_timestamp()
  WHERE id = _reminder_id AND owner_id = _owner_id
  RETURNING * INTO _reminder;
  UPDATE public.tasks_reminder_occurrences
  SET status = 'canceled'
  WHERE owner_id = _owner_id AND reminder_id = _reminder_id AND status = 'scheduled';
  UPDATE public.tasks_reminder_deliveries AS delivery
  SET status = 'canceled', updated_at = clock_timestamp()
  FROM public.tasks_reminder_occurrences AS occurrence
  WHERE occurrence.id = delivery.occurrence_id
    AND occurrence.owner_id = delivery.owner_id
    AND occurrence.owner_id = _owner_id
    AND occurrence.reminder_id = _reminder_id
    AND delivery.status NOT IN ('acknowledged', 'canceled');
  RETURN jsonb_build_object('outcome', 'accepted', 'reminder', to_jsonb(_reminder));
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_cancel_reminder(uuid, bigint, uuid, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_cancel_reminder(uuid, bigint, uuid, text, text)
TO authenticated;

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
    RAISE EXCEPTION 'Authentication is required to claim reminders' USING ERRCODE = '42501';
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
  ) ON CONFLICT (owner_id, channel, endpoint_key) DO UPDATE
    SET capability_status = 'active', last_error_code = NULL,
        last_seen_at = clock_timestamp(), updated_at = clock_timestamp()
  RETURNING * INTO _target;

  INSERT INTO public.tasks_reminder_deliveries (
    owner_id, occurrence_id, target_id
  )
  SELECT _owner_id, occurrence.id, _target.id
  FROM public.tasks_reminder_occurrences AS occurrence
  JOIN public.tasks_reminders AS reminder
    ON reminder.id = occurrence.reminder_id
   AND reminder.owner_id = occurrence.owner_id
  LEFT JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id AND task.owner_id = reminder.owner_id
  LEFT JOIN public.tasks_projects AS project
    ON project.id = reminder.project_id AND project.owner_id = reminder.owner_id
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.status = 'scheduled'
    AND occurrence.resolved_at <= _through_at
    AND reminder.status = 'active'
    AND ((reminder.root_type = 'todo'
      AND task.lifecycle = 'open' AND task.disposition = 'present')
      OR (reminder.root_type = 'project'
      AND project.lifecycle = 'open' AND project.disposition = 'present'))
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
    FROM eligible
    WHERE delivery.id = eligible.id
    RETURNING delivery.*
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'delivery_id', delivery.id,
    'occurrence_id', occurrence.id,
    'reminder_id', reminder.id,
    'root_type', reminder.root_type,
    'root_id', COALESCE(reminder.task_id, reminder.project_id),
    'title', COALESCE(task.title, project.title),
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
  LEFT JOIN public.tasks_todos AS task
    ON task.id = reminder.task_id AND task.owner_id = reminder.owner_id
  LEFT JOIN public.tasks_projects AS project
    ON project.id = reminder.project_id AND project.owner_id = reminder.owner_id;

  _result := jsonb_build_object(
    'outcome', 'accepted', 'through_at', _through_at, 'items', _items
  );
  INSERT INTO public.tasks_reminder_claims(id, owner_id, through_at, result)
  VALUES (_request_id, _owner_id, _through_at, _result);
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_claim_due_reminders(timestamptz, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_claim_due_reminders(timestamptz, uuid)
TO authenticated;

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
    AND target.channel = 'in_app'
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
  SET status = 'acknowledged', acknowledged_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE id = _delivery_id AND owner_id = _owner_id
  RETURNING * INTO _delivery;
  RETURN jsonb_build_object('outcome', 'accepted', 'delivery', to_jsonb(_delivery));
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_acknowledge_reminder_delivery(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_acknowledge_reminder_delivery(uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.cancel_root_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _root_type text := CASE WHEN TG_TABLE_NAME = 'tasks_todos' THEN 'todo' ELSE 'project' END;
BEGIN
  IF (NEW.lifecycle <> 'open' OR NEW.disposition <> 'present')
    AND (OLD.lifecycle = 'open' AND OLD.disposition = 'present') THEN
    WITH canceled AS (
      UPDATE public.tasks_reminders
      SET status = 'canceled', record_revision = record_revision + 1,
          last_mutation_channel = NEW.last_mutation_channel,
          last_actor_type = 'system', client_mutation_id = gen_random_uuid(),
          updated_at = clock_timestamp()
      WHERE owner_id = NEW.owner_id AND status = 'active'
        AND ((_root_type = 'todo' AND task_id = NEW.id)
          OR (_root_type = 'project' AND project_id = NEW.id))
      RETURNING id
    ), canceled_occurrences AS (
      UPDATE public.tasks_reminder_occurrences AS occurrence
      SET status = 'canceled'
      FROM canceled
      WHERE occurrence.owner_id = NEW.owner_id
        AND occurrence.reminder_id = canceled.id
        AND occurrence.status = 'scheduled'
      RETURNING occurrence.id, occurrence.owner_id
    )
    UPDATE public.tasks_reminder_deliveries AS delivery
    SET status = 'canceled', updated_at = clock_timestamp()
    FROM canceled_occurrences
    WHERE delivery.occurrence_id = canceled_occurrences.id
      AND delivery.owner_id = canceled_occurrences.owner_id
      AND delivery.status NOT IN ('acknowledged', 'canceled');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.cancel_root_reminders()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_todos_cancel_reminders
AFTER UPDATE OF lifecycle, disposition ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.cancel_root_reminders();

CREATE TRIGGER tasks_projects_cancel_reminders
AFTER UPDATE OF lifecycle, disposition ON public.tasks_projects
FOR EACH ROW EXECUTE FUNCTION tasks_private.cancel_root_reminders();

CREATE OR REPLACE FUNCTION tasks_private.export_v10_as_v9(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events'
  ];
  _collection text;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
BEGIN
  FOREACH _collection IN ARRAY _collections LOOP
    _data := _data || jsonb_build_object(_collection, _envelope #> ARRAY['data', _collection]);
    _counts := _counts || jsonb_build_object(
      _collection, _envelope #> ARRAY['manifest', 'counts', _collection]
    );
    _checksums := _checksums || jsonb_build_object(
      _collection, _envelope #> ARRAY['manifest', 'checksums', _collection]
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export', 'schema_version', 9,
    'created_at', _envelope -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections), 'counts', _counts, 'checksums', _checksums
    ),
    'data', _data
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.export_v10_as_v9(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v10(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
  _records jsonb;
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export'
    OR COALESCE(_envelope ->> 'schema_version', '') !~ '^[0-9]+$'
    OR (_envelope ->> 'schema_version')::integer <> 10
    OR _envelope #> '{manifest,collections}' IS DISTINCT FROM to_jsonb(_collections)
    OR _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256' THEN
    RAISE EXCEPTION 'Invalid task export v10 envelope' USING ERRCODE = '22023';
  END IF;
  FOREACH _collection IN ARRAY _collections LOOP
    _records := _envelope #> ARRAY['data', _collection];
    IF jsonb_typeof(_records) IS DISTINCT FROM 'array'
      OR COALESCE(_envelope #>> ARRAY['manifest', 'counts', _collection], '') !~ '^[0-9]+$'
      OR (_envelope #>> ARRAY['manifest', 'counts', _collection])::integer
        <> jsonb_array_length(_records)
      OR _envelope #>> ARRAY['manifest', 'checksums', _collection]
        IS DISTINCT FROM tasks_private.export_checksum(_records)
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(_records) AS record(value)
        WHERE jsonb_typeof(record.value) IS DISTINCT FROM 'object'
          OR NOT (record.value ? 'id') OR record.value ? 'owner_id'
      ) THEN
      RAISE EXCEPTION 'Task export v10 collection % is invalid', _collection
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
  PERFORM tasks_private.validate_export_v9(tasks_private.export_v10_as_v9(_envelope));

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_reminders}') AS reminder(value)
    WHERE (reminder.value ->> 'root_type' = 'todo' AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS task(value)
      WHERE task.value ->> 'id' = reminder.value ->> 'task_id'
    )) OR (reminder.value ->> 'root_type' = 'project' AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_projects}') AS project(value)
      WHERE project.value ->> 'id' = reminder.value ->> 'project_id'
    ))
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      _envelope #> '{data,tasks_reminder_occurrences}'
    ) AS occurrence(value)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_reminders}') AS reminder(value)
      WHERE reminder.value ->> 'id' = occurrence.value ->> 'reminder_id'
    )
  ) THEN
    RAISE EXCEPTION 'Task export v10 contains an invalid reminder graph'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v10(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v10()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _base jsonb;
  _data jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _records jsonb;
  _collection text;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data' USING ERRCODE = '42501';
  END IF;
  _base := public.tasks_create_export_v9();
  _data := _base -> 'data';
  SELECT COALESCE(jsonb_agg(
    to_jsonb(row_data) - 'owner_id' ORDER BY row_data.created_at, row_data.id
  ), '[]'::jsonb) INTO _records
  FROM public.tasks_reminders AS row_data WHERE row_data.owner_id = _owner_id;
  _data := _data || jsonb_build_object('tasks_reminders', _records);
  SELECT COALESCE(jsonb_agg(
    to_jsonb(row_data) - 'owner_id'
    ORDER BY row_data.resolved_at, row_data.created_at, row_data.id
  ), '[]'::jsonb) INTO _records
  FROM public.tasks_reminder_occurrences AS row_data WHERE row_data.owner_id = _owner_id;
  _data := _data || jsonb_build_object('tasks_reminder_occurrences', _records);
  FOREACH _collection IN ARRAY _collections LOOP
    _records := _data -> _collection;
    _counts := _counts || jsonb_build_object(_collection, jsonb_array_length(_records));
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export', 'schema_version', 10,
    'created_at', _base -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections), 'counts', _counts, 'checksums', _checksums
    ), 'data', _data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v10() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v10() TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v10(
  _envelope jsonb,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _v9 jsonb;
  _report jsonb;
  _collection text;
  _table regclass;
  _collection_report jsonb;
  _base_collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events'
  ];
  _reminder_collections constant text[] := ARRAY[
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
  _conflicts bigint := 0;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data' USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v10(_envelope);
  _v9 := tasks_private.export_v10_as_v9(_envelope);
  _report := public.tasks_restore_export_v9(_v9, true)
    || jsonb_build_object('schema_version', 10, 'dry_run', _dry_run);
  FOREACH _collection IN ARRAY _base_collections LOOP
    _conflicts := _conflicts + COALESCE(
      (_report #>> ARRAY[_collection, 'conflicts'])::bigint, 0
    );
  END LOOP;
  FOREACH _collection IN ARRAY _reminder_collections LOOP
    _table := ('public.' || _collection)::regclass;
    _collection_report := tasks_private.classify_restore_v4_collection(
      _owner_id, _table, _envelope #> ARRAY['data', _collection], true
    );
    _report := _report || jsonb_build_object(_collection, _collection_report);
    _conflicts := _conflicts + (_collection_report ->> 'conflicts')::bigint;
  END LOOP;
  IF NOT _dry_run AND _conflicts = 0 THEN
    _report := public.tasks_restore_export_v9(_v9, false)
      || (_report - 'schema_version' - 'dry_run' - 'applied' - 'code');
    IF COALESCE((_report ->> 'applied')::boolean, false) IS NOT TRUE THEN
      RETURN _report || jsonb_build_object(
        'schema_version', 10, 'dry_run', false, 'applied', false,
        'code', 'base_restore_rejected'
      );
    END IF;
    FOREACH _collection IN ARRAY _reminder_collections LOOP
      _table := ('public.' || _collection)::regclass;
      PERFORM tasks_private.insert_restore_v4_collection(
        _owner_id, _table, _envelope #> ARRAY['data', _collection], _report -> _collection
      );
    END LOOP;
    _report := _report || jsonb_build_object(
      'schema_version', 10, 'dry_run', false, 'applied', true
    );
  ELSE
    _report := _report || jsonb_build_object(
      'applied', false,
      'code', CASE WHEN _conflicts > 0 THEN 'reminder_or_base_conflict' ELSE NULL END
    );
  END IF;
  RETURN _report;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v10(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v10(jsonb, boolean)
TO authenticated;
