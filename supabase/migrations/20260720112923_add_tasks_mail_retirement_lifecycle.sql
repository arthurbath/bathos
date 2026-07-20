-- Guarded, append-only Mail source-retirement lifecycle.

ALTER TABLE public.tasks_mail_sources
  ADD CONSTRAINT tasks_mail_sources_task_owner_key UNIQUE (task_id, owner_id);

CREATE TABLE public.tasks_mail_source_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  client_mutation_id uuid NOT NULL,
  transition text NOT NULL,
  base_lifecycle text NOT NULL,
  result_lifecycle text NOT NULL,
  base_revision bigint NOT NULL,
  result_revision bigint NOT NULL,
  occurred_at timestamptz NOT NULL,
  error_code text,
  CONSTRAINT tasks_mail_source_events_source_owner_fkey
    FOREIGN KEY (task_id, owner_id)
    REFERENCES public.tasks_mail_sources(task_id, owner_id)
    ON DELETE CASCADE,
  CONSTRAINT tasks_mail_source_events_owner_mutation_key
    UNIQUE (owner_id, client_mutation_id),
  CONSTRAINT tasks_mail_source_events_transition_valid CHECK (
    transition IN ('retirement_started', 'retirement_failed', 'retired')
  ),
  CONSTRAINT tasks_mail_source_events_lifecycle_valid CHECK (
    base_lifecycle IN ('retained', 'retirement_pending', 'retirement_failed')
    AND result_lifecycle IN ('retirement_pending', 'retirement_failed', 'retired')
    AND (
      (
        transition = 'retirement_started'
        AND base_lifecycle IN ('retained', 'retirement_failed')
        AND result_lifecycle = 'retirement_pending'
      ) OR (
        transition = 'retirement_failed'
        AND base_lifecycle = 'retirement_pending'
        AND result_lifecycle = 'retirement_failed'
      ) OR (
        transition = 'retired'
        AND base_lifecycle = 'retirement_pending'
        AND result_lifecycle = 'retired'
      )
    )
  ),
  CONSTRAINT tasks_mail_source_events_revisions_valid CHECK (
    base_revision > 0 AND result_revision = base_revision + 1
  ),
  CONSTRAINT tasks_mail_source_events_error_valid CHECK (
    (
      transition = 'retirement_failed'
      AND NULLIF(btrim(error_code), '') IS NOT NULL
      AND char_length(error_code) <= 200
    ) OR (
      transition <> 'retirement_failed' AND error_code IS NULL
    )
  )
);

ALTER TABLE public.tasks_mail_source_events REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_mail_source_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX tasks_mail_source_events_owner_task_occurred_idx
ON public.tasks_mail_source_events (owner_id, task_id, occurred_at DESC, id);

CREATE POLICY tasks_mail_source_events_select_own
ON public.tasks_mail_source_events
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.tasks_mail_source_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tasks_mail_source_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_mail_source_events TO service_role;

REVOKE UPDATE ON TABLE public.tasks_mail_sources FROM authenticated;

CREATE OR REPLACE FUNCTION public.tasks_prepare_mail_source_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.task_id IS DISTINCT FROM OLD.task_id
    OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
    OR NEW.account_identifier IS DISTINCT FROM OLD.account_identifier
    OR NEW.mailbox_identifier IS DISTINCT FROM OLD.mailbox_identifier
    OR NEW.message_identifier IS DISTINCT FROM OLD.message_identifier
    OR NEW.deep_link IS DISTINCT FROM OLD.deep_link
    OR NEW.retirement_destination_identifier
      IS DISTINCT FROM OLD.retirement_destination_identifier
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Mail source identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Mail source revision must increment by exactly one' USING ERRCODE = '23514';
  END IF;
  IF NEW.client_mutation_id = OLD.client_mutation_id THEN
    RAISE EXCEPTION 'Mail source mutation identifier must change' USING ERRCODE = '23514';
  END IF;
  IF NOT (
    (OLD.lifecycle IN ('retained', 'retirement_failed')
      AND NEW.lifecycle = 'retirement_pending')
    OR (OLD.lifecycle = 'retirement_pending'
      AND NEW.lifecycle IN ('retirement_failed', 'retired'))
  ) THEN
    RAISE EXCEPTION 'Invalid Mail source retirement transition' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_prepare_mail_source_update()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.append_mail_source_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _transition text;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Mail source event owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  _transition := CASE NEW.lifecycle
    WHEN 'retirement_pending' THEN 'retirement_started'
    WHEN 'retirement_failed' THEN 'retirement_failed'
    WHEN 'retired' THEN 'retired'
  END;

  INSERT INTO public.tasks_mail_source_events (
    owner_id, task_id, client_mutation_id, transition,
    base_lifecycle, result_lifecycle, base_revision, result_revision,
    occurred_at, error_code
  ) VALUES (
    NEW.owner_id, NEW.task_id, NEW.client_mutation_id, _transition,
    OLD.lifecycle, NEW.lifecycle, OLD.revision, NEW.revision,
    NEW.updated_at, NEW.last_error_code
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.append_mail_source_event()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_mail_sources_append_event
AFTER UPDATE ON public.tasks_mail_sources
FOR EACH ROW
EXECUTE FUNCTION tasks_private.append_mail_source_event();

CREATE OR REPLACE FUNCTION tasks_private.mail_source_receipt(
  _event public.tasks_mail_source_events
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'client_mutation_id', _event.client_mutation_id,
    'actor_type', 'automation',
    'mutation_channel', 'mail_automation',
    'affected_ids', jsonb_build_array(_event.task_id),
    'base_revision', _event.base_revision,
    'result_revision', _event.result_revision,
    'transition', _event.transition,
    'occurred_at', _event.occurred_at,
    'outcome', 'accepted',
    'code', _event.error_code
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.mail_source_receipt(public.tasks_mail_source_events)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_begin_mail_retirement(
  _task_id uuid,
  _expected_revision bigint,
  _idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _source public.tasks_mail_sources;
  _event public.tasks_mail_source_events;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to retire Mail sources'
      USING ERRCODE = '42501';
  END IF;

  SELECT event.* INTO _event
  FROM public.tasks_mail_source_events AS event
  WHERE event.owner_id = _owner_id
    AND event.client_mutation_id = _idempotency_key;

  IF _event.id IS NOT NULL THEN
    IF _event.task_id IS DISTINCT FROM _task_id
      OR _event.transition IS DISTINCT FROM 'retirement_started'
      OR _event.base_revision IS DISTINCT FROM _expected_revision THEN
      RAISE EXCEPTION 'The idempotency key belongs to a different Mail retirement request'
        USING ERRCODE = '23505';
    END IF;
    SELECT source.* INTO _source
    FROM public.tasks_mail_sources AS source
    WHERE source.task_id = _task_id AND source.owner_id = _owner_id;
    RETURN jsonb_build_object(
      'idempotency_outcome', 'already_applied',
      'receipt', tasks_private.mail_source_receipt(_event),
      'mail_source', to_jsonb(_source) - 'owner_id'
    );
  END IF;

  SELECT source.* INTO _source
  FROM public.tasks_mail_sources AS source
  WHERE source.task_id = _task_id AND source.owner_id = _owner_id
  FOR UPDATE;

  IF _source.task_id IS NULL THEN
    RAISE EXCEPTION 'The Mail source is unavailable' USING ERRCODE = 'P0002';
  END IF;
  IF _source.revision <> _expected_revision THEN
    RAISE EXCEPTION 'The Mail source revision has changed' USING ERRCODE = '40001';
  END IF;
  IF _source.lifecycle NOT IN ('retained', 'retirement_failed') THEN
    RAISE EXCEPTION 'The Mail source cannot begin retirement from its current state'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.tasks_mail_sources AS source
  SET lifecycle = 'retirement_pending',
      retirement_attempted_at = clock_timestamp(),
      retired_at = NULL,
      last_error_code = NULL,
      revision = source.revision + 1,
      client_mutation_id = _idempotency_key
  WHERE source.task_id = _task_id AND source.owner_id = _owner_id
  RETURNING source.* INTO _source;

  SELECT event.* INTO STRICT _event
  FROM public.tasks_mail_source_events AS event
  WHERE event.owner_id = _owner_id
    AND event.client_mutation_id = _idempotency_key;

  RETURN jsonb_build_object(
    'idempotency_outcome', 'applied',
    'receipt', tasks_private.mail_source_receipt(_event),
    'mail_source', to_jsonb(_source) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_begin_mail_retirement(uuid, bigint, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_begin_mail_retirement(uuid, bigint, uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_resolve_mail_retirement(
  _task_id uuid,
  _expected_revision bigint,
  _idempotency_key uuid,
  _result text,
  _error_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _source public.tasks_mail_sources;
  _event public.tasks_mail_source_events;
  _normalized_error text := NULLIF(btrim(_error_code), '');
  _transition text;
  _result_lifecycle text;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to retire Mail sources'
      USING ERRCODE = '42501';
  END IF;
  IF _result NOT IN ('retired', 'failed') THEN
    RAISE EXCEPTION 'Mail retirement result must be retired or failed'
      USING ERRCODE = '22023';
  END IF;
  IF (_result = 'failed' AND _normalized_error IS NULL)
    OR (_result = 'retired' AND _normalized_error IS NOT NULL)
    OR char_length(_normalized_error) > 200 THEN
    RAISE EXCEPTION 'Mail retirement failure requires one bounded error code'
      USING ERRCODE = '22023';
  END IF;

  _transition := CASE _result WHEN 'retired' THEN 'retired' ELSE 'retirement_failed' END;
  _result_lifecycle := CASE _result WHEN 'retired' THEN 'retired' ELSE 'retirement_failed' END;

  SELECT event.* INTO _event
  FROM public.tasks_mail_source_events AS event
  WHERE event.owner_id = _owner_id
    AND event.client_mutation_id = _idempotency_key;

  IF _event.id IS NOT NULL THEN
    IF _event.task_id IS DISTINCT FROM _task_id
      OR _event.transition IS DISTINCT FROM _transition
      OR _event.base_revision IS DISTINCT FROM _expected_revision
      OR _event.error_code IS DISTINCT FROM _normalized_error THEN
      RAISE EXCEPTION 'The idempotency key belongs to a different Mail retirement result'
        USING ERRCODE = '23505';
    END IF;
    SELECT source.* INTO _source
    FROM public.tasks_mail_sources AS source
    WHERE source.task_id = _task_id AND source.owner_id = _owner_id;
    RETURN jsonb_build_object(
      'idempotency_outcome', 'already_applied',
      'receipt', tasks_private.mail_source_receipt(_event),
      'mail_source', to_jsonb(_source) - 'owner_id'
    );
  END IF;

  SELECT source.* INTO _source
  FROM public.tasks_mail_sources AS source
  WHERE source.task_id = _task_id AND source.owner_id = _owner_id
  FOR UPDATE;

  IF _source.task_id IS NULL THEN
    RAISE EXCEPTION 'The Mail source is unavailable' USING ERRCODE = 'P0002';
  END IF;
  IF _source.revision <> _expected_revision THEN
    RAISE EXCEPTION 'The Mail source revision has changed' USING ERRCODE = '40001';
  END IF;
  IF _source.lifecycle <> 'retirement_pending' THEN
    RAISE EXCEPTION 'Only a pending Mail source retirement can be resolved'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.tasks_mail_sources AS source
  SET lifecycle = _result_lifecycle,
      retired_at = CASE WHEN _result = 'retired' THEN clock_timestamp() ELSE NULL END,
      last_error_code = _normalized_error,
      revision = source.revision + 1,
      client_mutation_id = _idempotency_key
  WHERE source.task_id = _task_id AND source.owner_id = _owner_id
  RETURNING source.* INTO _source;

  SELECT event.* INTO STRICT _event
  FROM public.tasks_mail_source_events AS event
  WHERE event.owner_id = _owner_id
    AND event.client_mutation_id = _idempotency_key;

  RETURN jsonb_build_object(
    'idempotency_outcome', 'applied',
    'receipt', tasks_private.mail_source_receipt(_event),
    'mail_source', to_jsonb(_source) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_resolve_mail_retirement(
  uuid, bigint, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_resolve_mail_retirement(
  uuid, bigint, uuid, text, text
) TO authenticated;
