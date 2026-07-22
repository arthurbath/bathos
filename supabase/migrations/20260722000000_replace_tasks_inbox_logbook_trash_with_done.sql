-- Replace separate Inbox and Today destinations with Anytime-backed Today
-- membership, and establish owner-local automatic expiry for Done work.

ALTER TABLE public.tasks_todos
  DROP CONSTRAINT IF EXISTS tasks_todos_destination_valid,
  DROP CONSTRAINT IF EXISTS tasks_todos_today_section_valid,
  DROP CONSTRAINT IF EXISTS tasks_todos_evening_within_today,
  DROP CONSTRAINT IF EXISTS tasks_todos_unscheduled_placement_valid;

ALTER TABLE public.tasks_projects
  DROP CONSTRAINT IF EXISTS tasks_projects_destination_valid,
  DROP CONSTRAINT IF EXISTS tasks_projects_today_section_valid,
  DROP CONSTRAINT IF EXISTS tasks_projects_evening_within_today,
  DROP CONSTRAINT IF EXISTS tasks_projects_unscheduled_placement_valid;

ALTER TABLE public.tasks_todos
  ALTER COLUMN destination SET DEFAULT 'anytime',
  ALTER COLUMN today_section SET DEFAULT 'later';

ALTER TABLE public.tasks_projects
  ALTER COLUMN destination SET DEFAULT 'anytime',
  ALTER COLUMN today_section SET DEFAULT 'none';

UPDATE public.tasks_todos AS task
SET
  destination = CASE
    WHEN task.destination IN ('inbox', 'today') THEN 'anytime'
    ELSE task.destination
  END,
  today_section = CASE
    WHEN task.destination = 'inbox' THEN 'later'
    WHEN task.destination = 'today'
      AND task.start_date IS NOT NULL
      AND task.start_date > (
        clock_timestamp() AT TIME ZONE COALESCE(
          (
            SELECT setting.planning_timezone
            FROM public.tasks_user_settings AS setting
            WHERE setting.owner_id = task.owner_id
          ),
          'UTC'
        )
      )::date THEN 'none'
    WHEN task.destination = 'today' AND task.today_section = 'evening' THEN 'later'
    WHEN task.destination = 'today' THEN 'next'
    ELSE 'none'
  END,
  start_date = CASE WHEN task.destination = 'inbox' THEN NULL ELSE task.start_date END,
  revision = task.revision + 1,
  client_mutation_id = gen_random_uuid(),
  last_mutation_channel = 'import',
  last_actor_type = 'system'
WHERE task.destination IN ('inbox', 'today')
  OR task.today_section IN ('daytime', 'evening');

UPDATE public.tasks_projects AS project
SET
  destination = CASE
    WHEN project.destination = 'today' THEN 'anytime'
    ELSE project.destination
  END,
  today_section = CASE
    WHEN project.destination = 'today'
      AND project.start_date IS NOT NULL
      AND project.start_date > (
        clock_timestamp() AT TIME ZONE COALESCE(
          (
            SELECT setting.planning_timezone
            FROM public.tasks_user_settings AS setting
            WHERE setting.owner_id = project.owner_id
          ),
          'UTC'
        )
      )::date THEN 'none'
    WHEN project.destination = 'today' AND project.today_section = 'evening' THEN 'later'
    WHEN project.destination = 'today' THEN 'next'
    ELSE 'none'
  END,
  revision = project.revision + 1,
  client_mutation_id = gen_random_uuid(),
  last_mutation_channel = 'import',
  last_actor_type = 'system'
WHERE project.destination = 'today'
  OR project.today_section IN ('daytime', 'evening');

ALTER TABLE public.tasks_todos
  ADD CONSTRAINT tasks_todos_destination_valid CHECK (
    destination IN ('anytime', 'someday')
  ),
  ADD CONSTRAINT tasks_todos_today_section_valid CHECK (
    today_section IN ('none', 'now', 'next', 'later')
  ),
  ADD CONSTRAINT tasks_todos_planning_placement_valid CHECK (
    destination = 'anytime'
    OR (today_section = 'none' AND start_date IS NULL)
  );

ALTER TABLE public.tasks_projects
  ADD CONSTRAINT tasks_projects_destination_valid CHECK (
    destination IN ('anytime', 'someday')
  ),
  ADD CONSTRAINT tasks_projects_today_section_valid CHECK (
    today_section IN ('none', 'now', 'next', 'later')
  ),
  ADD CONSTRAINT tasks_projects_planning_placement_valid CHECK (
    destination = 'anytime'
    OR (today_section = 'none' AND start_date IS NULL)
  );

DROP INDEX IF EXISTS public.tasks_todos_owner_active_destination_order_idx;
CREATE INDEX tasks_todos_owner_active_destination_order_idx
ON public.tasks_todos (owner_id, destination, order_key, id)
WHERE disposition = 'present' AND lifecycle = 'open';

CREATE INDEX tasks_todos_owner_today_section_order_idx
ON public.tasks_todos (owner_id, today_section, order_key, id)
WHERE destination = 'anytime'
  AND today_section <> 'none'
  AND disposition = 'present'
  AND lifecycle = 'open';

DROP INDEX IF EXISTS public.tasks_projects_owner_planning_idx;
CREATE INDEX tasks_projects_owner_planning_idx
ON public.tasks_projects (owner_id, destination, planning_order_key, id)
WHERE disposition = 'present' AND lifecycle = 'open';

CREATE INDEX tasks_projects_owner_today_section_order_idx
ON public.tasks_projects (owner_id, today_section, planning_order_key, id)
WHERE destination = 'anytime'
  AND today_section <> 'none'
  AND disposition = 'present'
  AND lifecycle = 'open';

CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_snapshot_v3(_snapshot jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN _snapshot IS NULL OR _snapshot = 'null'::jsonb THEN NULL
    ELSE _snapshot || jsonb_build_object(
      'destination', CASE COALESCE(_snapshot ->> 'destination', 'inbox')
        WHEN 'inbox' THEN 'anytime'
        WHEN 'today' THEN 'anytime'
        ELSE _snapshot ->> 'destination'
      END,
      'today_section', CASE
        WHEN COALESCE(_snapshot ->> 'destination', 'inbox') = 'inbox' THEN 'later'
        WHEN _snapshot ->> 'destination' = 'today'
          AND _snapshot ->> 'today_section' = 'evening' THEN 'later'
        WHEN _snapshot ->> 'destination' = 'today' THEN 'next'
        WHEN COALESCE(_snapshot ->> 'today_section', 'daytime') IN ('daytime', 'evening')
          THEN 'none'
        ELSE _snapshot ->> 'today_section'
      END
    )
  END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_todo_snapshot_v3(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.todo_export_planning_is_valid_v3(_task jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    jsonb_typeof(_task) = 'object'
    AND (
      (
        COALESCE(_task ->> 'destination', '') IN ('anytime', 'someday')
        AND COALESCE(_task ->> 'today_section', '') IN ('none', 'now', 'next', 'later')
        AND (
          _task ->> 'destination' <> 'someday'
          OR (
            _task ->> 'today_section' = 'none'
            AND jsonb_typeof(_task -> 'start_date') = 'null'
          )
        )
      )
      OR (
        COALESCE(_task ->> 'destination', '') IN ('inbox', 'today', 'anytime', 'someday')
        AND COALESCE(_task ->> 'today_section', '') IN ('daytime', 'evening')
        AND (_task ->> 'today_section' <> 'evening' OR _task ->> 'destination' = 'today')
        AND (
          COALESCE(_task ->> 'destination', '') NOT IN ('inbox', 'someday')
          OR jsonb_typeof(_task -> 'start_date') = 'null'
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_export_planning_is_valid_v3(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.resolve_template_planning(
  _source_destination text,
  _source_today_section text,
  _start_offset_days integer,
  _deadline_offset_days integer,
  _anchor_date date,
  _planning_date date,
  _allow_inbox boolean
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _destination text := CASE
    WHEN _source_destination IN ('inbox', 'today') THEN 'anytime'
    ELSE _source_destination
  END;
  _today_section text := CASE
    WHEN _source_destination = 'inbox' THEN 'later'
    WHEN _source_destination = 'today' AND _source_today_section = 'evening' THEN 'later'
    WHEN _source_destination = 'today' THEN 'next'
    WHEN COALESCE(_source_today_section, 'daytime') IN ('daytime', 'evening') THEN 'none'
    ELSE _source_today_section
  END;
  _start_date date := CASE WHEN _start_offset_days IS NULL
    THEN NULL ELSE _anchor_date + _start_offset_days END;
  _deadline date := CASE WHEN _deadline_offset_days IS NULL
    THEN NULL ELSE _anchor_date + _deadline_offset_days END;
BEGIN
  -- Retain the legacy argument in this private function signature so existing
  -- template callers remain compatible; Inbox is normalized unconditionally.
  PERFORM _allow_inbox;

  IF _destination = 'someday' THEN
    _start_date := NULL;
    _today_section := 'none';
  ELSIF _destination = 'anytime' THEN
    IF _start_date IS NOT NULL AND _start_date > _planning_date THEN
      _today_section := 'none';
    END IF;
  ELSE
    RAISE EXCEPTION 'Template planning destination is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF _today_section NOT IN ('none', 'now', 'next', 'later') THEN
    RAISE EXCEPTION 'Template Today section is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF _start_date IS NOT NULL AND _deadline IS NOT NULL AND _deadline < _start_date THEN
    RAISE EXCEPTION 'Resolved template deadline precedes its start date'
      USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'destination', _destination,
    'today_section', _today_section,
    'start_date', _start_date,
    'deadline', _deadline
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.resolve_template_planning(
  text, text, integer, integer, date, date, boolean
) FROM PUBLIC, anon, authenticated;

-- Keep only the immutable creation identity needed to prevent an old retry
-- from recreating content after its Done retention window has expired.
CREATE TABLE tasks_private.purged_creation_receipts (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (
    entity_type IN ('area', 'project', 'heading', 'todo', 'checklist_item')
  ),
  entity_id uuid NOT NULL,
  client_mutation_id uuid NOT NULL,
  purged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (owner_id, entity_type, entity_id),
  UNIQUE (owner_id, client_mutation_id)
);

ALTER TABLE tasks_private.purged_creation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tasks_private.purged_creation_receipts
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.reject_purged_creation_retry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _entity_type text := CASE TG_TABLE_NAME
    WHEN 'tasks_areas' THEN 'area'
    WHEN 'tasks_projects' THEN 'project'
    WHEN 'tasks_headings' THEN 'heading'
    WHEN 'tasks_todos' THEN 'todo'
    WHEN 'tasks_checklist_items' THEN 'checklist_item'
  END;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tasks_private.purged_creation_receipts AS receipt
    WHERE receipt.owner_id = NEW.owner_id
      AND (
        receipt.client_mutation_id = NEW.client_mutation_id
        OR (
          receipt.entity_type = _entity_type
          AND receipt.entity_id = NEW.id
        )
      )
  ) THEN
    RAISE EXCEPTION 'The creation request refers to content that has expired from Done'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.reject_purged_creation_retry()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_areas_reject_purged_creation_retry
BEFORE INSERT ON public.tasks_areas
FOR EACH ROW EXECUTE FUNCTION tasks_private.reject_purged_creation_retry();
CREATE TRIGGER tasks_projects_reject_purged_creation_retry
BEFORE INSERT ON public.tasks_projects
FOR EACH ROW EXECUTE FUNCTION tasks_private.reject_purged_creation_retry();
CREATE TRIGGER tasks_headings_reject_purged_creation_retry
BEFORE INSERT ON public.tasks_headings
FOR EACH ROW EXECUTE FUNCTION tasks_private.reject_purged_creation_retry();
CREATE TRIGGER tasks_todos_reject_purged_creation_retry
BEFORE INSERT ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.reject_purged_creation_retry();
CREATE TRIGGER tasks_checklist_items_reject_purged_creation_retry
BEFORE INSERT ON public.tasks_checklist_items
FOR EACH ROW EXECUTE FUNCTION tasks_private.reject_purged_creation_retry();

CREATE OR REPLACE FUNCTION tasks_private.purge_expired_done(
  _now timestamptz DEFAULT clock_timestamp(),
  _limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _candidate record;
  _area_ids uuid[];
  _project_ids uuid[];
  _heading_ids uuid[];
  _todo_ids uuid[];
  _checklist_ids uuid[];
  _reminder_ids uuid[];
  _reminder_occurrence_ids uuid[];
  _reminder_delivery_ids uuid[];
  _entity_ids uuid[];
  _purged_roots integer := 0;
  _purged_records integer := 0;
BEGIN
  IF _limit < 1 OR _limit > 5000 THEN
    RAISE EXCEPTION 'Done purge limit must be between 1 and 5000'
      USING ERRCODE = '22023';
  END IF;

  FOR _candidate IN
    WITH owner_zones AS (
      SELECT users.id AS owner_id,
        COALESCE(settings.planning_timezone, 'UTC') AS planning_timezone
      FROM auth.users AS users
      LEFT JOIN public.tasks_user_settings AS settings
        ON settings.owner_id = users.id
    ), candidates AS (
      SELECT area.owner_id, 'area'::text AS root_type, area.id AS root_id,
        area.deleted_at AS terminal_at
      FROM public.tasks_areas AS area
      WHERE area.disposition = 'deleted' AND area.deletion_root_id = area.id
      UNION ALL
      SELECT project.owner_id, 'project', project.id,
        COALESCE(project.deleted_at, project.completed_at, project.canceled_at)
      FROM public.tasks_projects AS project
      WHERE (project.disposition = 'deleted' AND project.deletion_root_id = project.id)
        OR (project.disposition = 'present' AND project.lifecycle IN ('completed', 'canceled'))
      UNION ALL
      SELECT heading.owner_id, 'heading', heading.id, heading.deleted_at
      FROM public.tasks_headings AS heading
      WHERE heading.disposition = 'deleted' AND heading.deletion_root_id = heading.id
      UNION ALL
      SELECT task.owner_id, 'todo', task.id,
        COALESCE(task.deleted_at, task.completed_at, task.canceled_at)
      FROM public.tasks_todos AS task
      WHERE (task.disposition = 'deleted' AND task.deletion_root_id = task.id)
        OR (task.disposition = 'present' AND task.lifecycle IN ('completed', 'canceled'))
      UNION ALL
      SELECT item.owner_id, 'checklist_item', item.id, item.deleted_at
      FROM public.tasks_checklist_items AS item
      WHERE item.disposition = 'deleted' AND item.deletion_root_id = item.id
    )
    SELECT candidate.*, zone.planning_timezone
    FROM candidates AS candidate
    JOIN owner_zones AS zone ON zone.owner_id = candidate.owner_id
    WHERE candidate.terminal_at IS NOT NULL
      AND (candidate.terminal_at AT TIME ZONE zone.planning_timezone)::date + 31
        <= (_now AT TIME ZONE zone.planning_timezone)::date
    ORDER BY candidate.terminal_at, candidate.root_type, candidate.root_id
    LIMIT _limit
  LOOP
    _area_ids := ARRAY[]::uuid[];
    _project_ids := ARRAY[]::uuid[];
    _heading_ids := ARRAY[]::uuid[];
    _todo_ids := ARRAY[]::uuid[];
    _checklist_ids := ARRAY[]::uuid[];

    IF _candidate.root_type = 'area' THEN
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _area_ids
      FROM public.tasks_areas
      WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _project_ids
      FROM public.tasks_projects
      WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _heading_ids
      FROM public.tasks_headings
      WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _todo_ids
      FROM public.tasks_todos
      WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _checklist_ids
      FROM public.tasks_checklist_items
      WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
    ELSIF _candidate.root_type = 'project' THEN
      IF EXISTS (
        SELECT 1 FROM public.tasks_projects
        WHERE owner_id = _candidate.owner_id AND id = _candidate.root_id
          AND disposition = 'deleted' AND deletion_root_id = id
      ) THEN
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _project_ids
        FROM public.tasks_projects
        WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _heading_ids
        FROM public.tasks_headings
        WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _todo_ids
        FROM public.tasks_todos
        WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _checklist_ids
        FROM public.tasks_checklist_items
        WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
      ELSE
        _project_ids := ARRAY[_candidate.root_id];
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _heading_ids
        FROM public.tasks_headings
        WHERE owner_id = _candidate.owner_id AND project_id = _candidate.root_id;
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _todo_ids
        FROM public.tasks_todos
        WHERE owner_id = _candidate.owner_id AND project_id = _candidate.root_id;
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _checklist_ids
        FROM public.tasks_checklist_items
        WHERE owner_id = _candidate.owner_id AND task_id = ANY(_todo_ids);
      END IF;
    ELSIF _candidate.root_type = 'heading' THEN
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _heading_ids
      FROM public.tasks_headings
      WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _todo_ids
      FROM public.tasks_todos
      WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _checklist_ids
      FROM public.tasks_checklist_items
      WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
    ELSIF _candidate.root_type = 'todo' THEN
      IF EXISTS (
        SELECT 1 FROM public.tasks_todos
        WHERE owner_id = _candidate.owner_id AND id = _candidate.root_id
          AND disposition = 'deleted' AND deletion_root_id = id
      ) THEN
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _todo_ids
        FROM public.tasks_todos
        WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _checklist_ids
        FROM public.tasks_checklist_items
        WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
      ELSE
        _todo_ids := ARRAY[_candidate.root_id];
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _checklist_ids
        FROM public.tasks_checklist_items
        WHERE owner_id = _candidate.owner_id AND task_id = _candidate.root_id;
      END IF;
    ELSE
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _checklist_ids
      FROM public.tasks_checklist_items
      WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
    END IF;

    IF cardinality(_area_ids) + cardinality(_project_ids) + cardinality(_heading_ids)
      + cardinality(_todo_ids) + cardinality(_checklist_ids) = 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _reminder_ids
    FROM public.tasks_reminders
    WHERE owner_id = _candidate.owner_id
      AND (task_id = ANY(_todo_ids) OR project_id = ANY(_project_ids));
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _reminder_occurrence_ids
    FROM public.tasks_reminder_occurrences
    WHERE owner_id = _candidate.owner_id AND reminder_id = ANY(_reminder_ids);
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _reminder_delivery_ids
    FROM public.tasks_reminder_deliveries
    WHERE owner_id = _candidate.owner_id
      AND occurrence_id = ANY(_reminder_occurrence_ids);

    DELETE FROM public.tasks_reminder_deliveries
    WHERE owner_id = _candidate.owner_id AND id = ANY(_reminder_delivery_ids);
    DELETE FROM public.tasks_reminder_occurrences
    WHERE owner_id = _candidate.owner_id AND id = ANY(_reminder_occurrence_ids);
    DELETE FROM public.tasks_reminders
    WHERE owner_id = _candidate.owner_id AND id = ANY(_reminder_ids);

    _entity_ids := _area_ids || _project_ids || _heading_ids || _todo_ids || _checklist_ids;

    INSERT INTO tasks_private.purged_creation_receipts (
      owner_id, entity_type, entity_id, client_mutation_id, purged_at
    )
    SELECT receipt.owner_id, receipt.entity_type, receipt.entity_id,
      receipt.client_mutation_id, _now
    FROM (
      SELECT todo_receipt.*
      FROM (
        SELECT DISTINCT ON (event.task_id)
          event.owner_id, 'todo'::text AS entity_type, event.task_id AS entity_id,
          event.client_mutation_id, event.occurred_at, event.id
        FROM public.tasks_history_events AS event
        WHERE event.owner_id = _candidate.owner_id
          AND event.task_id = ANY(_todo_ids)
          AND event.transition IN ('create', 'baseline')
        ORDER BY event.task_id, event.occurred_at, event.id
      ) AS todo_receipt
      UNION ALL
      SELECT hierarchy_receipt.*
      FROM (
        SELECT DISTINCT ON (event.entity_type, event.entity_id)
          event.owner_id, event.entity_type, event.entity_id,
          event.client_mutation_id, event.occurred_at, event.id
        FROM public.tasks_hierarchy_history_events AS event
        WHERE event.owner_id = _candidate.owner_id
          AND event.entity_id = ANY(_entity_ids)
          AND event.transition IN ('create', 'baseline')
        ORDER BY event.entity_type, event.entity_id, event.occurred_at, event.id
      ) AS hierarchy_receipt
    ) AS receipt
    ON CONFLICT DO NOTHING;

    DELETE FROM public.tasks_hierarchy_history_events
    WHERE owner_id = _candidate.owner_id AND entity_id = ANY(_entity_ids);
    DELETE FROM public.tasks_checklist_items
    WHERE owner_id = _candidate.owner_id AND id = ANY(_checklist_ids);
    DELETE FROM public.tasks_todos
    WHERE owner_id = _candidate.owner_id AND id = ANY(_todo_ids);
    DELETE FROM public.tasks_headings
    WHERE owner_id = _candidate.owner_id AND id = ANY(_heading_ids);
    DELETE FROM public.tasks_projects
    WHERE owner_id = _candidate.owner_id AND id = ANY(_project_ids);
    DELETE FROM public.tasks_areas
    WHERE owner_id = _candidate.owner_id AND id = ANY(_area_ids);

    _purged_roots := _purged_roots + 1;
    _purged_records := _purged_records + cardinality(_entity_ids);
  END LOOP;

  RETURN jsonb_build_object(
    'purged_roots', _purged_roots,
    'purged_records', _purged_records,
    'evaluated_at', _now
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.purge_expired_done(timestamptz, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION tasks_private.purge_expired_done(timestamptz, integer)
TO service_role;

DO $schedule$
DECLARE
  _job_id bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    FOR _job_id IN
      SELECT jobid FROM cron.job WHERE jobname = 'tasks-purge-expired-done'
    LOOP
      PERFORM cron.unschedule(_job_id);
    END LOOP;
    PERFORM cron.schedule(
      'tasks-purge-expired-done',
      '* * * * *',
      'SELECT tasks_private.purge_expired_done();'
    );
  END IF;
END;
$schedule$;

CREATE OR REPLACE FUNCTION public.tasks_create_mail_capture(
  _idempotency_key uuid,
  _task_id uuid,
  _title text,
  _notes text,
  _start_date date,
  _order_key text,
  _hierarchy_order_key text,
  _account_identifier text,
  _mailbox_identifier text,
  _message_identifier text,
  _deep_link text,
  _retirement_destination_identifier text,
  _source_title text DEFAULT NULL,
  _area_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _task public.tasks_todos;
  _source public.tasks_mail_sources;
  _event public.tasks_history_events;
  _outcome text;
  _timestamp timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to capture Mail tasks'
      USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(_title), '') IS NULL OR char_length(btrim(_title)) > 500 THEN
    RAISE EXCEPTION 'Mail task title is required and cannot exceed 500 characters'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(_notes, '')) > 100000 THEN
    RAISE EXCEPTION 'Mail task notes cannot exceed 100000 characters'
      USING ERRCODE = '22023';
  END IF;
  IF _start_date IS NULL THEN
    RAISE EXCEPTION 'Mail capture requires the owner planning date'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(_order_key), '') IS NULL OR char_length(_order_key) > 255 THEN
    RAISE EXCEPTION 'Mail capture requires a valid planning order key'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(_account_identifier), '') IS NULL
    OR NULLIF(btrim(_mailbox_identifier), '') IS NULL
    OR NULLIF(btrim(_message_identifier), '') IS NULL
    OR NULLIF(btrim(_deep_link), '') IS NULL
    OR _deep_link NOT LIKE 'message://%'
    OR NULLIF(btrim(_retirement_destination_identifier), '') IS NULL THEN
    RAISE EXCEPTION 'Mail capture requires complete structured source identity'
      USING ERRCODE = '22023';
  END IF;
  IF _area_id IS NULL AND _hierarchy_order_key IS NOT NULL THEN
    RAISE EXCEPTION 'Unassigned Mail capture cannot have hierarchy order'
      USING ERRCODE = '22023';
  END IF;
  IF _area_id IS NOT NULL AND NULLIF(btrim(_hierarchy_order_key), '') IS NULL THEN
    RAISE EXCEPTION 'Area-assigned Mail capture requires hierarchy order'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      _owner_id::text || E'\x1f' || btrim(_account_identifier)
        || E'\x1f' || btrim(_message_identifier),
      0
    )
  );

  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id
    AND task.client_mutation_id = _idempotency_key;

  IF _task.id IS NOT NULL THEN
    SELECT source.* INTO _source
    FROM public.tasks_mail_sources AS source
    WHERE source.task_id = _task.id AND source.owner_id = _owner_id;
    IF _task.title IS DISTINCT FROM btrim(_title)
      OR _task.notes IS DISTINCT FROM COALESCE(_notes, '')
      OR _task.destination IS DISTINCT FROM 'anytime'
      OR _task.today_section IS DISTINCT FROM 'later'
      OR _task.start_date IS NOT NULL
      OR _task.area_id IS DISTINCT FROM _area_id
      OR _task.source_kind IS DISTINCT FROM 'mail_message'
      OR _task.source_url IS DISTINCT FROM _deep_link
      OR _task.source_title IS DISTINCT FROM NULLIF(btrim(_source_title), '')
      OR _task.source_external_id IS DISTINCT FROM btrim(_message_identifier)
      OR _source.account_identifier IS DISTINCT FROM btrim(_account_identifier)
      OR _source.mailbox_identifier IS DISTINCT FROM btrim(_mailbox_identifier)
      OR _source.deep_link IS DISTINCT FROM _deep_link
      OR _source.retirement_destination_identifier
        IS DISTINCT FROM btrim(_retirement_destination_identifier) THEN
      RAISE EXCEPTION 'The idempotency key belongs to a different Mail capture request'
        USING ERRCODE = '23505';
    END IF;
    _outcome := 'already_applied';
  ELSE
    SELECT source.* INTO _source
    FROM public.tasks_mail_sources AS source
    WHERE source.owner_id = _owner_id
      AND source.account_identifier = btrim(_account_identifier)
      AND source.message_identifier = btrim(_message_identifier);

    IF _source.task_id IS NOT NULL THEN
      SELECT task.* INTO _task
      FROM public.tasks_todos AS task
      WHERE task.id = _source.task_id AND task.owner_id = _owner_id;
      IF _source.mailbox_identifier IS DISTINCT FROM btrim(_mailbox_identifier)
        OR _source.deep_link IS DISTINCT FROM _deep_link
        OR _source.retirement_destination_identifier
          IS DISTINCT FROM btrim(_retirement_destination_identifier) THEN
        RAISE EXCEPTION 'The Mail message identity is already captured with different source data'
          USING ERRCODE = '23505';
      END IF;
      _outcome := 'source_already_applied';
    ELSE
      INSERT INTO public.tasks_todos (
        id, owner_id, area_id, project_id, heading_id, title, notes,
        lifecycle, completed_at, canceled_at, disposition, deleted_at,
        deletion_root_id, destination, today_section, order_key,
        hierarchy_order_key, start_date, deadline, entry_channel,
        last_mutation_channel, last_actor_type, undo_source_event_id,
        source_kind, source_url, source_title, source_external_id,
        revision, client_mutation_id, created_at, updated_at
      ) VALUES (
        _task_id, _owner_id, _area_id, NULL, NULL, btrim(_title), COALESCE(_notes, ''),
        'open', NULL, NULL, 'present', NULL,
        NULL, 'anytime', 'later', _order_key,
        _hierarchy_order_key, NULL, NULL, 'mail_automation',
        'mail_automation', 'automation', NULL,
        'mail_message', _deep_link, NULLIF(btrim(_source_title), ''),
        btrim(_message_identifier), 1, _idempotency_key, _timestamp, _timestamp
      )
      RETURNING * INTO _task;

      INSERT INTO public.tasks_mail_sources (
        task_id, owner_id, account_identifier, mailbox_identifier,
        message_identifier, deep_link, retirement_destination_identifier,
        lifecycle, retirement_attempted_at, retired_at, last_error_code,
        revision, client_mutation_id, created_at, updated_at
      ) VALUES (
        _task_id, _owner_id, btrim(_account_identifier), btrim(_mailbox_identifier),
        btrim(_message_identifier), _deep_link,
        btrim(_retirement_destination_identifier),
        'retained', NULL, NULL, NULL, 1, _idempotency_key, _timestamp, _timestamp
      )
      RETURNING * INTO _source;
      _outcome := 'created';
    END IF;
  END IF;

  SELECT event.* INTO _event
  FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id
    AND event.task_id = _task.id
    AND event.transition = 'create'
  ORDER BY event.occurred_at, event.id
  LIMIT 1;

  RETURN jsonb_build_object(
    'idempotency_outcome', _outcome,
    'receipt', jsonb_build_object(
      'client_mutation_id', _event.client_mutation_id,
      'actor_type', _event.actor_type,
      'mutation_channel', _event.mutation_channel,
      'affected_ids', _event.affected_ids,
      'base_revision', _event.base_revision,
      'result_revision', _event.result_revision,
      'transition', _event.transition,
      'occurred_at', _event.occurred_at,
      'outcome', _event.outcome,
      'code', NULL
    ),
    'task', to_jsonb(_task) - 'owner_id',
    'mail_source', to_jsonb(_source) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_mail_capture(
  uuid, uuid, text, text, date, text, text, text, text, text, text, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_mail_capture(
  uuid, uuid, text, text, date, text, text, text, text, text, text, text, text, uuid
) TO authenticated;

-- Keep older checksummed exports restorable without allowing retired planning
-- vocabulary to reach the current table constraints. The original envelope is
-- always validated before any normalized copy is classified or inserted.
CREATE OR REPLACE FUNCTION tasks_private.normalize_task_planning_json(
  _value jsonb,
  _planning_date date
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _normalized jsonb;
  _destination text;
  _today_section text;
  _start_date date;
BEGIN
  IF _value IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(_value) = 'array' THEN
    SELECT COALESCE(
      jsonb_agg(tasks_private.normalize_task_planning_json(item.value, _planning_date)),
      '[]'::jsonb
    )
    INTO _normalized
    FROM jsonb_array_elements(_value) AS item(value);
    RETURN _normalized;
  END IF;

  IF jsonb_typeof(_value) <> 'object' THEN
    RETURN _value;
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(
      item.key,
      tasks_private.normalize_task_planning_json(item.value, _planning_date)
    ),
    '{}'::jsonb
  )
  INTO _normalized
  FROM jsonb_each(_value) AS item(key, value);

  IF NOT (_normalized ? 'destination') THEN
    RETURN _normalized;
  END IF;

  _destination := _normalized ->> 'destination';
  _today_section := _normalized ->> 'today_section';
  IF COALESCE(_normalized ->> 'start_date', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    BEGIN
      _start_date := (_normalized ->> 'start_date')::date;
    EXCEPTION WHEN OTHERS THEN
      _start_date := NULL;
    END;
  END IF;

  _normalized := _normalized || jsonb_build_object(
    'destination', CASE
      WHEN _destination IN ('inbox', 'today') THEN 'anytime'
      ELSE _destination
    END,
    'today_section', CASE
      WHEN _destination = 'inbox' THEN 'later'
      WHEN _destination = 'today' AND _start_date > _planning_date THEN 'none'
      WHEN _destination = 'today' AND _today_section = 'evening' THEN 'later'
      WHEN _destination = 'today' THEN 'next'
      WHEN _destination = 'someday' THEN 'none'
      WHEN _today_section IN ('daytime', 'evening') OR _today_section IS NULL THEN 'none'
      ELSE _today_section
    END
  );

  IF _destination IN ('inbox', 'someday') THEN
    _normalized := jsonb_set(_normalized, '{start_date}', 'null'::jsonb, true);
  END IF;
  RETURN _normalized;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_task_planning_json(jsonb, date)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.normalize_task_export_planning(
  _envelope jsonb,
  _planning_date date
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _normalized jsonb := _envelope;
  _collection text;
  _records jsonb;
BEGIN
  FOR _collection IN
    SELECT value
    FROM jsonb_array_elements_text(_envelope #> '{manifest,collections}') AS item(value)
  LOOP
    _records := tasks_private.normalize_task_planning_json(
      _envelope #> ARRAY['data', _collection],
      _planning_date
    );
    _normalized := jsonb_set(
      _normalized,
      ARRAY['data', _collection],
      _records,
      true
    );
    _normalized := jsonb_set(
      _normalized,
      ARRAY['manifest', 'counts', _collection],
      to_jsonb(jsonb_array_length(_records)),
      true
    );
    _normalized := jsonb_set(
      _normalized,
      ARRAY['manifest', 'checksums', _collection],
      to_jsonb(tasks_private.export_checksum(_records)),
      true
    );
  END LOOP;
  RETURN _normalized;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_task_export_planning(jsonb, date)
FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.tasks_create_export_v10()
RENAME TO tasks_create_export_v10_before_current_planning;
ALTER FUNCTION public.tasks_create_export_v10_before_current_planning()
SET SCHEMA tasks_private;
REVOKE ALL ON FUNCTION tasks_private.tasks_create_export_v10_before_current_planning()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v10()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _planning_date date;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data'
      USING ERRCODE = '42501';
  END IF;
  SELECT clock_timestamp() AT TIME ZONE COALESCE(setting.planning_timezone, 'UTC')
  INTO _planning_date
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.tasks_user_settings AS setting
    ON setting.owner_id = _owner_id;
  RETURN tasks_private.normalize_task_export_planning(
    tasks_private.tasks_create_export_v10_before_current_planning(),
    _planning_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v10() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v10() TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v11()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_set(public.tasks_create_export_v10(), '{schema_version}', '11'::jsonb);
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v11() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v11() TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v11(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _planning_date date;
  _as_v10 jsonb;
BEGIN
  IF COALESCE(_envelope ->> 'schema_version', '') !~ '^\d+$'
    OR (_envelope ->> 'schema_version')::integer <> 11 THEN
    RAISE EXCEPTION 'Task export schema version is invalid'
      USING ERRCODE = '22023';
  END IF;
  SELECT clock_timestamp() AT TIME ZONE COALESCE(setting.planning_timezone, 'UTC')
  INTO _planning_date
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.tasks_user_settings AS setting
    ON setting.owner_id = _owner_id;
  _as_v10 := jsonb_set(_envelope, '{schema_version}', '10'::jsonb);
  PERFORM tasks_private.validate_export_v10(_as_v10);
  IF tasks_private.normalize_task_export_planning(_envelope, _planning_date) #> '{data}'
    IS DISTINCT FROM _envelope #> '{data}' THEN
    RAISE EXCEPTION 'Task export v11 contains retired or invalid planning values'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v11(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v11(
  _envelope jsonb,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _report jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v11(_envelope);
  _report := public.tasks_restore_export_v10(
    jsonb_set(_envelope, '{schema_version}', '10'::jsonb),
    _dry_run
  );
  RETURN jsonb_set(_report, '{schema_version}', '11'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v11(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v11(jsonb, boolean)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_current(
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
  _version integer;
  _planning_date date;
  _normalized jsonb;
  _report jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;
  IF COALESCE(_envelope ->> 'schema_version', '') !~ '^\d+$' THEN
    RAISE EXCEPTION 'Task export schema version is invalid'
      USING ERRCODE = '22023';
  END IF;
  _version := (_envelope ->> 'schema_version')::integer;
  IF _version < 1 OR _version > 11 THEN
    RAISE EXCEPTION 'Task export schema version is unsupported'
      USING ERRCODE = '22023';
  END IF;

  CASE _version
    WHEN 1 THEN PERFORM tasks_private.validate_export_v1(_envelope);
    WHEN 2 THEN PERFORM tasks_private.validate_export_v2(_envelope);
    WHEN 3 THEN PERFORM tasks_private.validate_export_v3(_envelope);
    WHEN 4 THEN PERFORM tasks_private.validate_export_v4(_envelope);
    WHEN 5 THEN PERFORM tasks_private.validate_export_v5(_envelope);
    WHEN 6 THEN PERFORM tasks_private.validate_export_v6(_envelope);
    WHEN 7 THEN PERFORM tasks_private.validate_export_v7(_envelope);
    WHEN 8 THEN PERFORM tasks_private.validate_export_v8(_envelope);
    WHEN 9 THEN PERFORM tasks_private.validate_export_v9(_envelope);
    WHEN 10 THEN PERFORM tasks_private.validate_export_v10(_envelope);
    WHEN 11 THEN PERFORM tasks_private.validate_export_v11(_envelope);
  END CASE;

  SELECT clock_timestamp() AT TIME ZONE COALESCE(setting.planning_timezone, 'UTC')
  INTO _planning_date
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.tasks_user_settings AS setting
    ON setting.owner_id = _owner_id;
  _normalized := tasks_private.normalize_task_export_planning(
    _envelope,
    _planning_date
  );

  CASE _version
    WHEN 1 THEN _report := public.tasks_restore_export_v1(_normalized, _dry_run);
    WHEN 2 THEN _report := public.tasks_restore_export_v2(_normalized, _dry_run);
    WHEN 3 THEN _report := public.tasks_restore_export_v3(_normalized, _dry_run);
    WHEN 4 THEN _report := public.tasks_restore_export_v4(_normalized, _dry_run);
    WHEN 5 THEN _report := public.tasks_restore_export_v5(_normalized, _dry_run);
    WHEN 6 THEN _report := public.tasks_restore_export_v6(_normalized, _dry_run);
    WHEN 7 THEN _report := public.tasks_restore_export_v7(_normalized, _dry_run);
    WHEN 8 THEN _report := public.tasks_restore_export_v8(_normalized, _dry_run);
    WHEN 9 THEN _report := public.tasks_restore_export_v9(_normalized, _dry_run);
    WHEN 10 THEN _report := public.tasks_restore_export_v10(_normalized, _dry_run);
    WHEN 11 THEN _report := public.tasks_restore_export_v11(_normalized, _dry_run);
  END CASE;
  RETURN jsonb_set(_report, '{schema_version}', to_jsonb(_version));
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_current(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_current(jsonb, boolean)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_prepare_replace_restore_v11(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _backup jsonb;
  _backup_v10 jsonb;
  _restore_preview jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to prepare task replacement'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v11(_envelope);
  _backup := public.tasks_create_export_v11();
  _backup_v10 := jsonb_set(_backup, '{schema_version}', '10'::jsonb);
  _restore_preview := public.tasks_restore_export_v11(_envelope, true);
  RETURN jsonb_build_object(
    'schema_version', 11,
    'backup', _backup,
    'backup_digest', tasks_private.export_v10_digest(_backup_v10),
    'current_counts', _backup #> '{manifest,counts}',
    'incoming_counts', _envelope #> '{manifest,counts}',
    'restore_preview', _restore_preview
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_prepare_replace_restore_v11(jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_prepare_replace_restore_v11(jsonb)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_replace_restore_v11(
  _envelope jsonb,
  _expected_backup_digest text,
  _request_id uuid,
  _confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _result jsonb;
  _owner_id uuid := auth.uid();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to replace task data'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v11(_envelope);
  -- An explicitly confirmed replacement restore may intentionally recover
  -- content that previously passed its automatic retention boundary.
  DELETE FROM tasks_private.purged_creation_receipts
  WHERE owner_id = _owner_id;
  _result := public.tasks_replace_restore_v10(
    jsonb_set(_envelope, '{schema_version}', '10'::jsonb),
    _expected_backup_digest,
    _request_id,
    _confirmation
  );
  _result := jsonb_set(_result, '{schema_version}', '11'::jsonb);
  _result := jsonb_set(_result, '{restore_report,schema_version}', '11'::jsonb);
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_replace_restore_v11(
  jsonb, text, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_replace_restore_v11(
  jsonb, text, uuid, text
) TO authenticated;
