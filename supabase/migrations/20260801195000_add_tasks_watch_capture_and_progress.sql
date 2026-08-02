-- Extend the existing expiring native-widget credential with two narrow watch
-- operations: create one Today Inbox task and read aggregate Today progress.

ALTER TABLE public.tasks_todos
  DROP CONSTRAINT tasks_todos_entry_channel_valid,
  ADD CONSTRAINT tasks_todos_entry_channel_valid CHECK (
    entry_channel IN (
      'web', 'raycast', 'mcp', 'mail_automation', 'browser_capture',
      'native', 'widget', 'watch', 'import'
    )
  ),
  DROP CONSTRAINT tasks_todos_last_mutation_channel_valid,
  ADD CONSTRAINT tasks_todos_last_mutation_channel_valid CHECK (
    last_mutation_channel IN (
      'web', 'raycast', 'mcp', 'mail_automation', 'browser_capture',
      'native', 'widget', 'watch', 'import'
    )
  );

ALTER TABLE public.tasks_history_events
  DROP CONSTRAINT tasks_history_events_channel_valid,
  ADD CONSTRAINT tasks_history_events_channel_valid CHECK (
    mutation_channel IN (
      'web', 'raycast', 'mcp', 'mail_automation', 'browser_capture',
      'native', 'widget', 'watch', 'import'
    )
  );

CREATE OR REPLACE FUNCTION public.tasks_create_inbox_from_watch(
  _raw_token text,
  _summary text,
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
  _requested_at timestamptz := clock_timestamp();
  _planning_date date;
  _last_order_key text;
  _order_key text;
BEGIN
  IF _raw_token IS NULL
    OR _raw_token !~ '^twc_[A-Za-z0-9_-]{43}$'
    OR _summary IS NULL
    OR btrim(_summary) = ''
    OR char_length(btrim(_summary)) > 500
    OR _client_mutation_id IS NULL
    OR _operation_id IS NULL THEN
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
    OR _credential.expires_at <= _requested_at THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_credential');
  END IF;

  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _credential.owner_id
    AND task.client_mutation_id = _client_mutation_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'taskId', _task.id,
      'planningDate', _task.start_date,
      'revision', _task.revision
    );
  END IF;

  UPDATE tasks_private.widget_completion_credentials
  SET last_used_at = _requested_at, updated_at = _requested_at
  WHERE id = _credential.id;

  SELECT (_requested_at AT TIME ZONE COALESCE(
    settings.planning_timezone, 'UTC'
  ))::date
  INTO _planning_date
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.tasks_user_settings AS settings
    ON settings.owner_id = _credential.owner_id;

  SELECT task.order_key INTO _last_order_key
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _credential.owner_id
    AND task.destination = 'anytime'
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
  ORDER BY task.order_key COLLATE "C" DESC, task.id DESC
  LIMIT 1;

  _order_key := CASE
    WHEN _last_order_key IS NULL THEN 'a0'
    ELSE tasks_private.next_task_order_key(_last_order_key)
  END;

  -- Today's explicit Start plus Inbox is a system/native activation state.
  PERFORM set_config('garden.bath.tasks_activation', 'on', true);

  INSERT INTO public.tasks_todos (
    id, owner_id, title, notes, lifecycle, completed_at, canceled_at,
    disposition, deleted_at, deletion_root_id, destination, today_section,
    order_key, upcoming_order_key, hierarchy_order_key, start_date, deadline,
    primary_link, entry_channel, last_mutation_channel, last_actor_type,
    last_operation_id, undo_source_event_id, revision, client_mutation_id,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), _credential.owner_id, btrim(_summary), '', 'open', NULL,
    NULL, 'present', NULL, NULL, 'anytime', 'inbox', _order_key, _order_key,
    NULL, _planning_date, NULL, NULL, 'watch', 'watch', 'user', _operation_id,
    NULL, 1, _client_mutation_id, _requested_at, _requested_at
  )
  RETURNING * INTO _task;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'taskId', _task.id,
    'planningDate', _planning_date,
    'revision', _task.revision
  );
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_read_today_progress_for_watch(
  _raw_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _credential tasks_private.widget_completion_credentials;
  _requested_at timestamptz := clock_timestamp();
  _planning_date date;
  _total integer;
  _completed integer;
BEGIN
  IF _raw_token IS NULL OR _raw_token !~ '^twc_[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_credential');
  END IF;

  SELECT credential.* INTO _credential
  FROM tasks_private.widget_completion_credentials AS credential
  WHERE credential.token_hash = extensions.digest(
    convert_to(_raw_token, 'UTF8'), 'sha256'
  )
  FOR UPDATE;

  IF NOT FOUND
    OR _credential.revoked_at IS NOT NULL
    OR _credential.expires_at <= _requested_at THEN
    RETURN jsonb_build_object('outcome', 'rejected', 'code', 'invalid_credential');
  END IF;

  UPDATE tasks_private.widget_completion_credentials
  SET last_used_at = _requested_at, updated_at = _requested_at
  WHERE id = _credential.id;

  SELECT (_requested_at AT TIME ZONE COALESCE(
    settings.planning_timezone, 'UTC'
  ))::date
  INTO _planning_date
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.tasks_user_settings AS settings
    ON settings.owner_id = _credential.owner_id;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE task.lifecycle = 'completed')::integer
  INTO _total, _completed
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _credential.owner_id
    AND task.disposition = 'present'
    AND task.recurrence_superseded_at IS NULL
    AND task.start_date = _planning_date;

  RETURN jsonb_build_object(
    'type', 'todayProgress',
    'schemaVersion', 1,
    'ownerId', _credential.owner_id,
    'generatedAt', _requested_at,
    'planningDate', _planning_date,
    'completedCount', _completed,
    'totalCount', _total
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_create_inbox_from_watch(
  text, text, uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_create_inbox_from_watch(
  text, text, uuid, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.tasks_read_today_progress_for_watch(text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_read_today_progress_for_watch(text)
TO service_role;
