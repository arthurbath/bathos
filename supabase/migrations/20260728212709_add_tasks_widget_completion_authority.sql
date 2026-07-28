-- Narrow native-widget authority for completing an owned Tasks to-do.
-- The raw credential is returned once by the Edge Function and never stored here.

CREATE TABLE tasks_private.widget_completion_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT widget_completion_credentials_owner_installation_key
    UNIQUE (owner_id, installation_id),
  CONSTRAINT widget_completion_credentials_expiry_valid CHECK (
    expires_at > created_at
  ),
  CONSTRAINT widget_completion_credentials_revocation_valid CHECK (
    revoked_at IS NULL OR revoked_at >= created_at
  )
);

ALTER TABLE tasks_private.widget_completion_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE tasks_private.widget_completion_credentials
FROM PUBLIC, anon, authenticated;

ALTER TABLE public.tasks_todos
  DROP CONSTRAINT tasks_todos_last_mutation_channel_valid,
  ADD CONSTRAINT tasks_todos_last_mutation_channel_valid CHECK (
    last_mutation_channel IN (
      'web',
      'raycast',
      'mcp',
      'mail_automation',
      'browser_capture',
      'native',
      'widget',
      'import'
    )
  );

ALTER TABLE public.tasks_history_events
  DROP CONSTRAINT tasks_history_events_channel_valid,
  ADD CONSTRAINT tasks_history_events_channel_valid CHECK (
    mutation_channel IN (
      'web',
      'raycast',
      'mcp',
      'mail_automation',
      'browser_capture',
      'native',
      'widget',
      'import'
    )
  );

CREATE OR REPLACE FUNCTION public.tasks_issue_widget_completion_credential(
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
  _credential tasks_private.widget_completion_credentials;
BEGIN
  IF _owner_id IS NULL
    OR _installation_id IS NULL
    OR _raw_token IS NULL
    OR _raw_token !~ '^twc_[A-Za-z0-9_-]{43}$'
    OR _expires_at <= clock_timestamp()
    OR _expires_at > clock_timestamp() + interval '91 days' THEN
    RAISE EXCEPTION 'Invalid widget credential request'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO tasks_private.widget_completion_credentials (
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
    'credential_id', _credential.id,
    'owner_id', _credential.owner_id,
    'installation_id', _credential.installation_id,
    'expires_at', _credential.expires_at
  );
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_complete_from_widget(
  _raw_token text,
  _task_id uuid,
  _client_mutation_id uuid,
  _operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _credential tasks_private.widget_completion_credentials;
  _task public.tasks_todos;
  _existing_event public.tasks_history_events;
  _completed_at timestamptz := clock_timestamp();
BEGIN
  IF _raw_token IS NULL
    OR _raw_token !~ '^twc_[A-Za-z0-9_-]{43}$'
    OR _task_id IS NULL
    OR _client_mutation_id IS NULL
    OR _operation_id IS NULL THEN
    RETURN jsonb_build_object(
      'outcome', 'rejected',
      'code', 'invalid_request'
    );
  END IF;

  SELECT credential.* INTO _credential
  FROM tasks_private.widget_completion_credentials AS credential
  WHERE credential.token_hash = extensions.digest(
    convert_to(_raw_token, 'UTF8'),
    'sha256'
  )
  FOR UPDATE;

  IF NOT FOUND
    OR _credential.revoked_at IS NOT NULL
    OR _credential.expires_at <= _completed_at THEN
    RETURN jsonb_build_object(
      'outcome', 'rejected',
      'code', 'invalid_credential'
    );
  END IF;

  UPDATE tasks_private.widget_completion_credentials
  SET last_used_at = _completed_at,
      updated_at = _completed_at
  WHERE id = _credential.id;

  SELECT event.* INTO _existing_event
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _credential.owner_id
    AND event.client_mutation_id = _client_mutation_id;

  IF FOUND THEN
    IF _existing_event.task_id = _task_id
      AND _existing_event.transition = 'complete' THEN
      RETURN jsonb_build_object(
        'outcome', 'already_applied',
        'task_id', _task_id,
        'completed_at', _existing_event.occurred_at,
        'revision', _existing_event.result_revision
      );
    END IF;
    RETURN jsonb_build_object(
      'outcome', 'rejected',
      'code', 'idempotency_conflict'
    );
  END IF;

  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.id = _task_id
    AND task.owner_id = _credential.owner_id
  FOR UPDATE;

  IF NOT FOUND OR _task.disposition <> 'present' THEN
    RETURN jsonb_build_object(
      'outcome', 'rejected',
      'code', 'task_unavailable'
    );
  END IF;

  IF _task.lifecycle = 'completed' THEN
    RETURN jsonb_build_object(
      'outcome', 'noop',
      'task_id', _task.id,
      'completed_at', _task.completed_at,
      'revision', _task.revision
    );
  END IF;

  IF _task.lifecycle <> 'open' THEN
    RETURN jsonb_build_object(
      'outcome', 'rejected',
      'code', 'task_unavailable'
    );
  END IF;

  UPDATE public.tasks_todos
  SET lifecycle = 'completed',
      completed_at = _completed_at,
      canceled_at = NULL,
      revision = _task.revision + 1,
      client_mutation_id = _client_mutation_id,
      last_operation_id = _operation_id,
      undo_source_event_id = NULL,
      last_mutation_channel = 'widget',
      last_actor_type = 'user'
  WHERE id = _task.id
    AND owner_id = _credential.owner_id
  RETURNING * INTO _task;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'task_id', _task.id,
    'completed_at', _task.completed_at,
    'revision', _task.revision
  );
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_revoke_widget_completion_credential(
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
  IF _raw_token IS NULL
    OR _raw_token !~ '^twc_[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object(
      'outcome', 'rejected',
      'code', 'invalid_credential'
    );
  END IF;

  UPDATE tasks_private.widget_completion_credentials
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

REVOKE ALL ON FUNCTION public.tasks_issue_widget_completion_credential(
  uuid,
  uuid,
  text,
  timestamptz
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tasks_complete_from_widget(
  text,
  uuid,
  uuid,
  uuid
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tasks_revoke_widget_completion_credential(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.tasks_issue_widget_completion_credential(
  uuid,
  uuid,
  text,
  timestamptz
) TO service_role;

GRANT EXECUTE ON FUNCTION public.tasks_complete_from_widget(
  text,
  uuid,
  uuid,
  uuid
) TO service_role;

GRANT EXECUTE ON FUNCTION public.tasks_revoke_widget_completion_credential(text)
TO service_role;
