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
  _planning_timezone text;
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

  SELECT
    COALESCE(NULLIF(settings.planning_timezone, ''), 'UTC'),
    (_requested_at AT TIME ZONE COALESCE(
      NULLIF(settings.planning_timezone, ''), 'UTC'
    ))::date
  INTO _planning_timezone, _planning_date
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
    AND task.lifecycle IN ('open', 'completed')
    AND (
      (
        task.lifecycle = 'open'
        AND (
          task.today_section IN ('inbox', 'now', 'next', 'later')
          OR task.start_date = _planning_date
        )
      )
      OR (
        task.lifecycle = 'completed'
        AND (
          task.today_section IN ('inbox', 'now', 'next', 'later')
          OR task.start_date = _planning_date
        )
        AND (task.completed_at AT TIME ZONE _planning_timezone)::date
          = _planning_date
      )
    );

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

REVOKE ALL ON FUNCTION public.tasks_read_today_progress_for_watch(text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_read_today_progress_for_watch(text)
TO service_role;
