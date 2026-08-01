-- Give Upcoming its own owner-scoped ordering plane. Ordinary list order stays
-- in order_key; calendar recurrence prototypes own their Upcoming placement on
-- the recurrence definition.

ALTER TABLE public.tasks_todos
  ADD COLUMN upcoming_order_key text;

ALTER TABLE public.tasks_recurrence_definitions
  ADD COLUMN upcoming_order_key text;

UPDATE public.tasks_todos
SET upcoming_order_key = order_key
WHERE upcoming_order_key IS NULL;

UPDATE public.tasks_recurrence_definitions AS definition
SET upcoming_order_key = NULLIF(
  revision.prototype_snapshot #>> '{root,order_key}',
  ''
)
FROM public.tasks_recurrence_revisions AS revision
WHERE revision.owner_id = definition.owner_id
  AND revision.recurrence_id = definition.id
  AND revision.revision = definition.current_revision
  AND definition.upcoming_order_key IS NULL;

UPDATE public.tasks_recurrence_definitions
SET upcoming_order_key = 'a0'
WHERE upcoming_order_key IS NULL;

ALTER TABLE public.tasks_recurrence_definitions
  ALTER COLUMN upcoming_order_key SET DEFAULT 'a0';

ALTER TABLE public.tasks_todos
  ADD CONSTRAINT tasks_todos_upcoming_order_key_valid CHECK (
    upcoming_order_key IS NULL
    OR (btrim(upcoming_order_key) <> '' AND char_length(upcoming_order_key) <= 200)
  );

ALTER TABLE public.tasks_recurrence_definitions
  ADD CONSTRAINT tasks_recurrence_definitions_upcoming_order_key_valid CHECK (
    upcoming_order_key IS NULL
    OR (btrim(upcoming_order_key) <> '' AND char_length(upcoming_order_key) <= 200)
  );

CREATE OR REPLACE FUNCTION tasks_private.default_task_upcoming_order_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.upcoming_order_key IS NULL THEN
    NEW.upcoming_order_key := NEW.order_key;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER tasks_todos_default_upcoming_order_key
BEFORE INSERT ON public.tasks_todos
FOR EACH ROW
EXECUTE FUNCTION tasks_private.default_task_upcoming_order_key();

REVOKE ALL ON FUNCTION tasks_private.default_task_upcoming_order_key()
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tasks_reorder_recurrence_projection(
  _recurrence_id uuid,
  _expected_record_revision bigint,
  _upcoming_order_key text,
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
  _definition public.tasks_recurrence_definitions;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to reorder recurrence'
      USING ERRCODE = '42501';
  END IF;
  IF _recurrence_id IS NULL
    OR _mutation_id IS NULL
    OR NULLIF(btrim(_upcoming_order_key), '') IS NULL
    OR char_length(_upcoming_order_key) > 200
    OR _mutation_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'widget', 'import'
    )
    OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
    RAISE EXCEPTION 'Recurrence reorder input is invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _mutation_id::text, 0)
  );
  SELECT definition.* INTO _definition
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.owner_id = _owner_id
    AND definition.id = _recurrence_id
  FOR UPDATE;
  IF NOT FOUND OR _definition.status = 'archived' THEN
    RAISE EXCEPTION 'The recurrence definition is unavailable'
      USING ERRCODE = '22023';
  END IF;
  IF _definition.client_mutation_id = _mutation_id THEN
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'definition', to_jsonb(_definition) - 'owner_id'
    );
  END IF;
  IF _definition.record_revision <> _expected_record_revision THEN
    RETURN jsonb_build_object(
      'outcome', 'conflict',
      'definition', to_jsonb(_definition) - 'owner_id'
    );
  END IF;

  UPDATE public.tasks_recurrence_definitions AS definition
  SET upcoming_order_key = _upcoming_order_key,
      record_revision = definition.record_revision + 1,
      client_mutation_id = _mutation_id,
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type,
      updated_at = clock_timestamp()
  WHERE definition.owner_id = _owner_id
    AND definition.id = _recurrence_id
  RETURNING * INTO _definition;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'definition', to_jsonb(_definition) - 'owner_id'
  );
END
$$;

REVOKE ALL ON FUNCTION public.tasks_reorder_recurrence_projection(
  uuid, bigint, text, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_reorder_recurrence_projection(
  uuid, bigint, text, uuid, text, text
) TO authenticated;

-- Midnight activation keeps the dedicated Upcoming rank as its stable input,
-- while continuing to allocate fresh Inbox order keys in activation order.
CREATE OR REPLACE FUNCTION tasks_private.activate_due_roots(
  _now timestamptz DEFAULT clock_timestamp(),
  _owner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _settings record;
  _task record;
  _planning_date date;
  _planning_midnight timestamptz;
  _last_rollover_date date;
  _next_order_key text;
  _rollover_count integer := 0;
  _owner_rollover_count integer := 0;
  _todo_count integer := 0;
BEGIN
  PERFORM set_config('garden.bath.tasks_activation', 'on', true);
  FOR _settings IN
    SELECT settings.owner_id, settings.planning_timezone
    FROM public.tasks_user_settings AS settings
    WHERE _owner_id IS NULL OR settings.owner_id = _owner_id
    ORDER BY settings.owner_id
  LOOP
    _planning_date := (_now AT TIME ZONE _settings.planning_timezone)::date;
    _planning_midnight := (
      _planning_date::timestamp AT TIME ZONE _settings.planning_timezone
    );
    INSERT INTO tasks_private.today_rollover_state (
      owner_id, planning_date, updated_at
    ) VALUES (
      _settings.owner_id, _planning_date, _now
    ) ON CONFLICT (owner_id) DO NOTHING;
    SELECT state.planning_date
    INTO _last_rollover_date
    FROM tasks_private.today_rollover_state AS state
    WHERE state.owner_id = _settings.owner_id
    FOR UPDATE;

    SELECT task.order_key
    INTO _next_order_key
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _settings.owner_id
      AND task.destination = 'anytime'
      AND task.lifecycle = 'open'
      AND task.disposition = 'present'
      AND task.start_date IS NULL
      AND task.today_section = 'inbox'
    ORDER BY task.order_key DESC, task.id DESC
    LIMIT 1;

    IF _planning_date > _last_rollover_date THEN
      PERFORM set_config('garden.bath.tasks_rollover', 'on', true);
      FOR _task IN
        SELECT task.id
        FROM public.tasks_todos AS task
        WHERE task.owner_id = _settings.owner_id
          AND task.destination = 'anytime'
          AND task.lifecycle = 'open'
          AND task.disposition = 'present'
          AND task.start_date IS NULL
          AND task.today_section IS NOT NULL
          AND task.today_section IS DISTINCT FROM 'inbox'
          AND task.updated_at < _planning_midnight
        ORDER BY
          CASE task.today_section
            WHEN 'now' THEN 1
            WHEN 'next' THEN 2
            WHEN 'later' THEN 3
            ELSE 4
          END,
          task.order_key,
          task.id
        FOR UPDATE
      LOOP
        _next_order_key := CASE
          WHEN _next_order_key IS NULL THEN 'a0'
          ELSE tasks_private.next_task_order_key(_next_order_key)
        END;
        UPDATE public.tasks_todos AS task
        SET today_section = 'inbox',
            order_key = _next_order_key,
            revision = task.revision + 1,
            client_mutation_id = gen_random_uuid(),
            last_mutation_channel = 'native',
            last_actor_type = 'system',
            undo_source_event_id = NULL,
            updated_at = _now
        WHERE task.id = _task.id;
        _rollover_count := _rollover_count + 1;
      END LOOP;
      PERFORM set_config('garden.bath.tasks_rollover', 'off', true);
      UPDATE tasks_private.today_rollover_state
      SET planning_date = _planning_date, updated_at = _now
      WHERE owner_id = _settings.owner_id;
      _owner_rollover_count := _owner_rollover_count + 1;
    END IF;

    FOR _task IN
      SELECT task.id
      FROM public.tasks_todos AS task
      WHERE task.owner_id = _settings.owner_id
        AND task.destination = 'anytime'
        AND task.lifecycle = 'open'
        AND task.disposition = 'present'
        AND (
          (
            task.start_date IS NOT NULL
            AND task.start_date <= _planning_date
          )
          OR (
            task.start_date IS NULL
            AND task.today_section IS NULL
            AND task.deadline IS NOT NULL
            AND task.deadline <= _planning_date
          )
        )
      ORDER BY
        COALESCE(task.start_date, task.deadline),
        COALESCE(task.upcoming_order_key, task.order_key),
        task.id
      FOR UPDATE
    LOOP
      _next_order_key := CASE
        WHEN _next_order_key IS NULL THEN 'a0'
        ELSE tasks_private.next_task_order_key(_next_order_key)
      END;
      UPDATE public.tasks_todos AS task
      SET start_date = NULL,
          today_section = 'inbox',
          order_key = _next_order_key,
          revision = task.revision + 1,
          client_mutation_id = gen_random_uuid(),
          last_mutation_channel = 'native',
          last_actor_type = 'system',
          undo_source_event_id = NULL,
          updated_at = _now
      WHERE task.id = _task.id;
      _todo_count := _todo_count + 1;
    END LOOP;
  END LOOP;
  PERFORM set_config('garden.bath.tasks_activation', 'off', true);
  RETURN jsonb_build_object(
    'rolled_over_todos', _rollover_count,
    'rolled_over_owners', _owner_rollover_count,
    'activated_todos', _todo_count,
    'evaluated_at', _now
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.activate_due_roots(timestamptz, uuid)
FROM PUBLIC, anon, authenticated, service_role;

-- Every generated occurrence starts from the prototype's current Upcoming
-- placement. Later edits to an occurrence remain independent of the prototype.
CREATE OR REPLACE FUNCTION tasks_private.instantiate_recurrence_occurrence(
  _owner_id uuid,
  _definition public.tasks_recurrence_definitions,
  _revision public.tasks_recurrence_revisions,
  _scheduled_date date,
  _logical_key text,
  _predecessor_occurrence_id uuid,
  _entry_channel text,
  _actor_type text
)
RETURNS public.tasks_recurrence_occurrences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _existing public.tasks_recurrence_occurrences;
  _occurrence public.tasks_recurrence_occurrences;
  _snapshot jsonb := _revision.prototype_snapshot;
  _root jsonb;
  _item jsonb;
  _task_id uuid := gen_random_uuid();
  _occurrence_id uuid := gen_random_uuid();
  _item_id uuid;
  _start_date date;
  _deadline date;
  _planning_date date;
BEGIN
  SELECT occurrence.* INTO _existing
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND occurrence.recurrence_id = _definition.id
    AND occurrence.logical_key = _logical_key;
  IF FOUND THEN RETURN _existing; END IF;

  _snapshot := tasks_private.normalize_recurrence_snapshot(_snapshot);
  _root := _snapshot -> 'root';
  _start_date := CASE
    WHEN _root -> 'start_offset_days' IS NULL
      OR _root -> 'start_offset_days' = 'null'::jsonb THEN NULL
    ELSE _scheduled_date + (_root ->> 'start_offset_days')::integer
  END;
  _deadline := CASE
    WHEN _root -> 'deadline_offset_days' IS NULL
      OR _root -> 'deadline_offset_days' = 'null'::jsonb THEN NULL
    ELSE _scheduled_date + (_root ->> 'deadline_offset_days')::integer
  END;
  _planning_date := (
    clock_timestamp() AT TIME ZONE _revision.planning_timezone
  )::date;

  INSERT INTO public.tasks_todos (
    id, owner_id, title, notes, lifecycle, completed_at, canceled_at,
    disposition, deleted_at, destination, order_key, upcoming_order_key,
    entry_channel, source_kind, source_url, source_title, source_external_id,
    revision, client_mutation_id, created_at, updated_at,
    last_mutation_channel, last_actor_type, start_date, deadline,
    today_section, area_id, hierarchy_order_key, actionability, primary_link
  ) VALUES (
    _task_id, _owner_id, _root ->> 'title', COALESCE(_root ->> 'notes', ''),
    'open', NULL, NULL, 'present', NULL, 'anytime',
    COALESCE(NULLIF(_root ->> 'order_key', ''), 'a0'),
    COALESCE(
      _definition.upcoming_order_key,
      NULLIF(_root ->> 'order_key', ''),
      'a0'
    ),
    _entry_channel, NULL, NULL, NULL, NULL, 1, gen_random_uuid(),
    clock_timestamp(), clock_timestamp(), _entry_channel, _actor_type,
    CASE WHEN _start_date > _planning_date THEN _start_date ELSE NULL END,
    _deadline,
    CASE WHEN _start_date IS NOT NULL AND _start_date <= _planning_date
      THEN 'inbox' ELSE NULL END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.tasks_areas AS area
      WHERE area.id = _revision.target_area_id
        AND area.owner_id = _owner_id
        AND area.disposition = 'present'
    ) THEN _revision.target_area_id ELSE NULL END,
    NULL,
    COALESCE(_root ->> 'actionability', 'actionable'),
    CASE WHEN NULLIF(btrim(_root ->> 'primary_link'), '') IS NULL
      THEN NULL ELSE _root ->> 'primary_link' END
  );

  FOR _item IN
    SELECT value FROM jsonb_array_elements(_snapshot #> '{root,checklist}')
  LOOP
    _item_id := gen_random_uuid();
    INSERT INTO public.tasks_checklist_items (
      id, owner_id, task_id, title, completed, completed_at, order_key,
      disposition, deleted_at, entry_channel, last_mutation_channel,
      last_actor_type, revision, client_mutation_id, created_at, updated_at
    ) VALUES (
      _item_id, _owner_id, _task_id, _item ->> 'title',
      COALESCE((_item ->> 'completed')::boolean, false),
      CASE WHEN COALESCE((_item ->> 'completed')::boolean, false)
        THEN clock_timestamp() ELSE NULL END,
      COALESCE(NULLIF(_item ->> 'order_key', ''), 'a0'),
      'present', NULL, _entry_channel, _entry_channel, _actor_type,
      1, gen_random_uuid(), clock_timestamp(), clock_timestamp()
    );
  END LOOP;

  INSERT INTO public.tasks_recurrence_occurrences (
    id, owner_id, recurrence_id, recurrence_revision, logical_key,
    scheduled_date, predecessor_occurrence_id,
    root_type, root_id, client_mutation_id, generated_at, origin
  ) VALUES (
    _occurrence_id, _owner_id, _definition.id, _revision.revision,
    _logical_key, _scheduled_date, _predecessor_occurrence_id,
    'todo', _task_id, _occurrence_id, clock_timestamp(), 'generated'
  ) RETURNING * INTO _occurrence;

  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (pg_backend_pid(), txid_current(), _owner_id)
  ON CONFLICT DO NOTHING;
  UPDATE public.tasks_todos
  SET recurrence_definition_id = _definition.id,
      recurrence_revision = _revision.revision,
      recurrence_occurrence_id = _occurrence.id,
      recurrence_logical_key = _logical_key,
      revision = revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = _entry_channel,
      last_actor_type = _actor_type,
      updated_at = clock_timestamp()
  WHERE id = _task_id AND owner_id = _owner_id;
  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  IF _revision.reminder_local_time IS NOT NULL
    AND auth.uid() IS NOT DISTINCT FROM _owner_id THEN
    PERFORM public.tasks_save_start_reminder(
      NULL, NULL, 'todo', _task_id,
      to_char(_revision.reminder_local_time, 'HH24:MI'),
      _revision.planning_timezone, 'earlier', gen_random_uuid(),
      _entry_channel, _actor_type
    );
  END IF;
  RETURN _occurrence;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.instantiate_recurrence_occurrence(
  uuid, public.tasks_recurrence_definitions,
  public.tasks_recurrence_revisions, date, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;

-- Background widget refreshes use the same mixed Upcoming order as the web
-- and native foreground snapshot, including recurrence prototypes.
CREATE OR REPLACE FUNCTION tasks_private.widget_primary_link(_value text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH normalized AS (
    SELECT CASE
      WHEN NULLIF(btrim(_value), '') IS NULL THEN NULL
      WHEN btrim(_value) ~* '^(https?|message|jira|obsidian):' THEN btrim(_value)
      WHEN btrim(_value) ~* '^[a-z][a-z0-9+.-]*:' THEN NULL
      ELSE 'https://' || btrim(_value)
    END AS href
  )
  SELECT CASE
    WHEN href IS NULL OR char_length(href) > 8000 THEN NULL
    ELSE jsonb_build_object(
      'href', href,
      'kind', CASE
        WHEN href ~* '^message:' THEN 'mail'
        WHEN href ~* '^(jira:|https?://[^/]*atlassian\.)' THEN 'jira'
        WHEN href ~* '^obsidian:' THEN 'obsidian'
        ELSE 'link'
      END
    )
  END
  FROM normalized
$$;

REVOKE ALL ON FUNCTION tasks_private.widget_primary_link(text)
FROM PUBLIC, anon, authenticated, service_role;

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
  _projection jsonb;
  _total_count integer;
  _tasks jsonb;
BEGIN
  IF _list_id <> 'upcoming' THEN
    RETURN tasks_private.build_widget_list_projection_without_row_context(
      _owner_id,
      _list_id,
      _planning_date,
      _automatic_list_sorting,
      _quick_filter
    );
  END IF;

  WITH ordinary AS (
    SELECT
      task.id,
      CASE
        WHEN task.start_date IS NOT NULL AND task.start_date > _planning_date
          THEN task.start_date
        ELSE task.deadline
      END AS upcoming_date,
      COALESCE(task.upcoming_order_key, task.order_key) AS upcoming_order_key,
      jsonb_build_object(
        'id', task.id,
        'summary', left(btrim(task.title), 500),
        'deadline', task.deadline,
        'todaySection', task.today_section,
        'actionability', task.actionability,
        'terminalState', NULL,
        'upcomingDate', CASE
          WHEN task.start_date IS NOT NULL AND task.start_date > _planning_date
            THEN task.start_date
          ELSE task.deadline
        END,
        'isRecurrenceProjection', false,
        'primaryLink', tasks_private.widget_primary_link(task.primary_link)
      ) AS task
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id
      AND task.recurrence_superseded_at IS NULL
      AND task.disposition = 'present'
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
      AND (
        _quick_filter = 'all'
        OR (_quick_filter = 'actionable' AND task.actionability = 'actionable')
        OR (_quick_filter = 'non_actionable' AND task.actionability <> 'actionable')
        OR (_quick_filter = 'rechecking' AND task.actionability = 'rechecking')
        OR (_quick_filter = 'waiting' AND task.actionability = 'waiting')
      )
  ),
  prototypes AS (
    SELECT
      definition.id,
      CASE WHEN revision.deadline_offset_days IS NULL
        THEN definition.next_occurrence_date
        ELSE definition.next_occurrence_date - revision.deadline_offset_days
      END AS upcoming_date,
      COALESCE(
        definition.upcoming_order_key,
        NULLIF(revision.prototype_snapshot #>> '{root,order_key}', ''),
        'a0'
      ) AS upcoming_order_key,
      jsonb_build_object(
        'id', definition.id,
        'summary', left(btrim(revision.prototype_snapshot #>> '{root,title}'), 500),
        'deadline', CASE WHEN revision.deadline_offset_days IS NULL
          THEN NULL ELSE definition.next_occurrence_date END,
        'todaySection', NULL,
        'actionability', COALESCE(
          revision.prototype_snapshot #>> '{root,actionability}',
          'actionable'
        ),
        'terminalState', NULL,
        'upcomingDate', CASE WHEN revision.deadline_offset_days IS NULL
          THEN definition.next_occurrence_date
          ELSE definition.next_occurrence_date - revision.deadline_offset_days
        END,
        'isRecurrenceProjection', true,
        'primaryLink', tasks_private.widget_primary_link(
          revision.prototype_snapshot #>> '{root,primary_link}'
        )
      ) AS task
    FROM public.tasks_recurrence_definitions AS definition
    JOIN public.tasks_recurrence_revisions AS revision
      ON revision.owner_id = definition.owner_id
      AND revision.recurrence_id = definition.id
      AND revision.revision = definition.current_revision
    WHERE definition.owner_id = _owner_id
      AND definition.status = 'active'
      AND revision.rule_mode = 'calendar'
      AND definition.next_occurrence_date IS NOT NULL
      AND definition.next_occurrence_date > _planning_date
      AND (
        _quick_filter = 'all'
        OR (
          _quick_filter = 'actionable'
          AND COALESCE(
            revision.prototype_snapshot #>> '{root,actionability}',
            'actionable'
          ) = 'actionable'
        )
        OR (
          _quick_filter = 'non_actionable'
          AND COALESCE(
            revision.prototype_snapshot #>> '{root,actionability}',
            'actionable'
          ) <> 'actionable'
        )
        OR (
          _quick_filter IN ('rechecking', 'waiting')
          AND revision.prototype_snapshot #>> '{root,actionability}' = _quick_filter
        )
      )
  ),
  candidates AS (
    SELECT * FROM ordinary
    UNION ALL
    SELECT * FROM prototypes
  ),
  ranked AS (
    SELECT
      candidate.*,
      row_number() OVER (
        ORDER BY
          CASE
            WHEN candidate.upcoming_date <= _planning_date + 7
              THEN candidate.upcoming_date
            WHEN candidate.upcoming_date
              <= (_planning_date + interval '12 months')::date
              THEN date_trunc('month', candidate.upcoming_date)::date
            ELSE date_trunc('year', candidate.upcoming_date)::date
          END,
          candidate.upcoming_order_key COLLATE "C",
          candidate.id
      ) AS ordinal
    FROM candidates AS candidate
  )
  SELECT
    count(*)::integer,
    COALESCE(
      jsonb_agg(ranked.task ORDER BY ranked.ordinal)
        FILTER (WHERE ranked.ordinal <= 50),
      '[]'::jsonb
    )
  INTO _total_count, _tasks
  FROM ranked;

  _projection := jsonb_build_object(
    'id', 'upcoming',
    'title', 'Upcoming',
    'totalCount', _total_count,
    'truncated', _total_count > 50,
    'tasks', _tasks
  );
  RETURN _projection;
END
$$;

REVOKE ALL ON FUNCTION tasks_private.build_widget_list_projection(
  uuid, text, date, boolean, text
) FROM PUBLIC, anon, authenticated;
