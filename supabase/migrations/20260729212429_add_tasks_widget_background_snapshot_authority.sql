-- Allow an existing owner-and-installation-bound widget credential to read
-- only the final bounded native projection. No raw Tasks rows are returned.

CREATE OR REPLACE FUNCTION tasks_private.build_widget_list_projection(
  _owner_id uuid,
  _list_id text,
  _planning_date date,
  _automatic_list_sorting boolean,
  _quick_filter text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  _title text;
  _total_count integer;
  _tasks jsonb;
BEGIN
  IF _list_id NOT IN ('today', 'upcoming', 'anytime', 'someday', 'done') THEN
    RAISE EXCEPTION 'Invalid widget list'
      USING ERRCODE = '22023';
  END IF;

  _title := CASE _list_id
    WHEN 'today' THEN 'Today'
    WHEN 'upcoming' THEN 'Upcoming'
    WHEN 'anytime' THEN 'Anytime'
    WHEN 'someday' THEN 'Someday'
    ELSE 'Done'
  END;

  WITH candidates AS (
    SELECT
      task.*,
      area.id AS valid_area_id,
      area.order_key AS area_order_key,
      CASE
        WHEN task.start_date IS NOT NULL
          AND task.start_date > _planning_date
          THEN task.start_date
        WHEN task.deadline IS NOT NULL
          AND task.deadline > _planning_date
          THEN task.deadline
        ELSE NULL
      END AS upcoming_date,
      CASE
        WHEN task.primary_link IS NULL THEN NULL
        WHEN btrim(task.primary_link)
          ~* '^(https?|message|jira|obsidian):'
          THEN btrim(task.primary_link)
        WHEN btrim(task.primary_link)
          ~* '^[a-z][a-z0-9+.-]*:'
          THEN NULL
        ELSE 'https://' || btrim(task.primary_link)
      END AS widget_primary_link
    FROM public.tasks_todos AS task
    LEFT JOIN public.tasks_areas AS area
      ON area.owner_id = task.owner_id
      AND area.id = task.area_id
      AND area.disposition = 'present'
    WHERE task.owner_id = _owner_id
      AND task.recurrence_superseded_at IS NULL
      AND (
        _quick_filter = 'all'
        OR (_quick_filter = 'actionable' AND task.actionability = 'actionable')
        OR (_quick_filter = 'non_actionable' AND task.actionability <> 'actionable')
        OR (_quick_filter = 'rechecking' AND task.actionability = 'rechecking')
        OR (_quick_filter = 'waiting' AND task.actionability = 'waiting')
      )
      AND CASE _list_id
        WHEN 'done' THEN (
          (task.disposition = 'deleted' AND task.deletion_root_id = task.id)
          OR (
            task.disposition = 'present'
            AND task.lifecycle IN ('completed', 'canceled')
          )
        )
        WHEN 'upcoming' THEN (
          task.disposition = 'present'
          AND task.lifecycle = 'open'
          AND task.destination = 'anytime'
          AND (
            (task.start_date IS NOT NULL AND task.start_date > _planning_date)
            OR (
              (task.start_date IS NULL OR task.start_date <= _planning_date)
              AND task.deadline IS NOT NULL
              AND task.deadline > _planning_date
            )
          )
        )
        WHEN 'today' THEN (
          task.disposition = 'present'
          AND task.lifecycle = 'open'
          AND task.destination = 'anytime'
          AND task.today_section IS NOT NULL
          AND (task.start_date IS NULL OR task.start_date <= _planning_date)
        )
        WHEN 'anytime' THEN (
          task.disposition = 'present'
          AND task.lifecycle = 'open'
          AND task.destination = 'anytime'
          AND (task.start_date IS NULL OR task.start_date <= _planning_date)
        )
        ELSE (
          task.disposition = 'present'
          AND task.lifecycle = 'open'
          AND task.destination = 'someday'
        )
      END
  ),
  ranked AS (
    SELECT
      candidate.*,
      row_number() OVER (
        ORDER BY
          CASE
            WHEN _list_id = 'today' THEN CASE candidate.today_section
              WHEN 'inbox' THEN 0
              WHEN 'now' THEN 1
              WHEN 'next' THEN 2
              WHEN 'later' THEN 3
              ELSE 4
            END
            ELSE 0
          END,
          CASE
            WHEN _list_id = 'upcoming' THEN CASE
              WHEN candidate.upcoming_date <= _planning_date + 7
                THEN candidate.upcoming_date
              WHEN candidate.upcoming_date
                <= (_planning_date + interval '12 months')::date
                THEN date_trunc('month', candidate.upcoming_date)::date
              ELSE date_trunc('year', candidate.upcoming_date)::date
            END
            ELSE NULL
          END,
          CASE
            WHEN _list_id IN ('anytime', 'someday')
              AND candidate.valid_area_id IS NULL THEN 0
            WHEN _list_id IN ('anytime', 'someday') THEN 1
            ELSE 0
          END,
          CASE WHEN _list_id IN ('anytime', 'someday')
            THEN candidate.area_order_key
            ELSE NULL
          END COLLATE "C" NULLS FIRST,
          CASE WHEN _list_id IN ('anytime', 'someday')
            THEN candidate.valid_area_id
            ELSE NULL
          END,
          CASE
            WHEN _list_id IN ('anytime', 'someday')
              AND _automatic_list_sorting
              AND candidate.deadline IS NULL THEN 1
            ELSE 0
          END,
          CASE
            WHEN _list_id IN ('anytime', 'someday')
              AND _automatic_list_sorting THEN candidate.deadline
            ELSE NULL
          END,
          CASE
            WHEN _list_id IN ('anytime', 'someday')
              AND _automatic_list_sorting THEN CASE candidate.today_section
                WHEN 'inbox' THEN 0
                WHEN 'now' THEN 1
                WHEN 'next' THEN 2
                WHEN 'later' THEN 3
                ELSE 4
              END
            ELSE 0
          END,
          CASE
            WHEN _list_id IN ('anytime', 'someday')
              AND _automatic_list_sorting THEN CASE candidate.actionability
                WHEN 'actionable' THEN 0
                WHEN 'rechecking' THEN 1
                WHEN 'waiting' THEN 2
                ELSE 3
              END
            ELSE 0
          END,
          CASE
            WHEN _list_id = 'done'
              THEN COALESCE(
                candidate.deleted_at,
                candidate.completed_at,
                candidate.canceled_at
              )
            ELSE NULL
          END DESC NULLS LAST,
          CASE WHEN _list_id <> 'done'
            THEN candidate.order_key
            ELSE NULL
          END COLLATE "C",
          candidate.id
      ) AS ordinal
    FROM candidates AS candidate
  ),
  projected AS (
    SELECT
      ranked.ordinal,
      jsonb_build_object(
        'id', ranked.id,
        'summary', left(btrim(ranked.title), 500),
        'deadline', ranked.deadline,
        'todaySection', ranked.today_section,
        'actionability', ranked.actionability,
        'terminalState', CASE
          WHEN ranked.disposition = 'deleted' THEN 'deleted'
          WHEN ranked.lifecycle = 'open' THEN NULL
          ELSE ranked.lifecycle
        END,
        'primaryLink', CASE
          WHEN ranked.widget_primary_link IS NOT NULL
            AND char_length(ranked.widget_primary_link) <= 8000
            THEN jsonb_build_object(
              'href', ranked.widget_primary_link,
              'kind', CASE
                WHEN ranked.widget_primary_link ~* '^message:'
                  THEN 'mail'
                ELSE 'link'
              END
            )
          ELSE NULL
        END
      ) AS task
    FROM ranked
  )
  SELECT
    count(*)::integer,
    COALESCE(
      jsonb_agg(projected.task ORDER BY projected.ordinal)
        FILTER (WHERE projected.ordinal <= 50),
      '[]'::jsonb
    )
  INTO _total_count, _tasks
  FROM projected;

  RETURN jsonb_build_object(
    'id', _list_id,
    'title', _title,
    'totalCount', _total_count,
    'truncated', _total_count > 50,
    'tasks', _tasks
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.build_widget_list_projection(
  uuid,
  text,
  date,
  boolean,
  text
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_read_widget_snapshot(
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
  _automatic_list_sorting boolean;
  _quick_filter text;
BEGIN
  IF _raw_token IS NULL
    OR _raw_token !~ '^twc_[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object(
      'outcome', 'rejected',
      'code', 'invalid_credential'
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
    OR _credential.expires_at <= _requested_at THEN
    RETURN jsonb_build_object(
      'outcome', 'rejected',
      'code', 'invalid_credential'
    );
  END IF;

  UPDATE tasks_private.widget_completion_credentials
  SET last_used_at = _requested_at,
      updated_at = _requested_at
  WHERE id = _credential.id;

  SELECT
    (_requested_at AT TIME ZONE COALESCE(
      settings.planning_timezone,
      'UTC'
    ))::date,
    COALESCE(settings.automatic_list_sorting, false)
  INTO _planning_date, _automatic_list_sorting
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.tasks_user_settings AS settings
    ON settings.owner_id = _credential.owner_id;

  SELECT COALESCE(settings.tasks_quick_filter, 'all')
  INTO _quick_filter
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.bathos_user_settings AS settings
    ON settings.user_id = _credential.owner_id;

  _quick_filter := CASE
    WHEN _quick_filter IN (
      'all',
      'actionable',
      'non_actionable',
      'rechecking',
      'waiting'
    ) THEN _quick_filter
    ELSE 'all'
  END;

  RETURN jsonb_build_object(
    'type', 'snapshot',
    'schemaVersion', 2,
    'ownerId', _credential.owner_id,
    'generatedAt', _requested_at,
    'planningDate', _planning_date,
    'lists', jsonb_build_array(
      tasks_private.build_widget_list_projection(
        _credential.owner_id,
        'today',
        _planning_date,
        _automatic_list_sorting,
        _quick_filter
      ),
      tasks_private.build_widget_list_projection(
        _credential.owner_id,
        'upcoming',
        _planning_date,
        _automatic_list_sorting,
        _quick_filter
      ),
      tasks_private.build_widget_list_projection(
        _credential.owner_id,
        'anytime',
        _planning_date,
        _automatic_list_sorting,
        _quick_filter
      ),
      tasks_private.build_widget_list_projection(
        _credential.owner_id,
        'someday',
        _planning_date,
        _automatic_list_sorting,
        _quick_filter
      ),
      tasks_private.build_widget_list_projection(
        _credential.owner_id,
        'done',
        _planning_date,
        _automatic_list_sorting,
        _quick_filter
      )
    )
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_read_widget_snapshot(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.tasks_read_widget_snapshot(text)
TO service_role;
