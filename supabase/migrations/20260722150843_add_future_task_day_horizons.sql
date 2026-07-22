-- Treat Today placement as an independent day horizon. Future-start work keeps
-- its selected horizon while Upcoming withholds it until the owner's planning
-- date reaches the start date.

ALTER TABLE public.tasks_todos
  ALTER COLUMN today_section SET DEFAULT 'inbox',
  DROP CONSTRAINT IF EXISTS tasks_todos_today_section_valid;

ALTER TABLE public.tasks_projects
  DROP CONSTRAINT IF EXISTS tasks_projects_today_section_valid;

ALTER TABLE public.tasks_todos
  ADD CONSTRAINT tasks_todos_today_section_valid CHECK (
    today_section IN ('none', 'inbox', 'now', 'next', 'later')
  );

ALTER TABLE public.tasks_projects
  ADD CONSTRAINT tasks_projects_today_section_valid CHECK (
    today_section IN ('none', 'inbox', 'now', 'next', 'later')
  );

DROP INDEX IF EXISTS public.tasks_todos_owner_today_section_order_idx;
CREATE INDEX tasks_todos_owner_today_section_order_idx
ON public.tasks_todos (owner_id, today_section, order_key, id)
WHERE destination = 'anytime'
  AND (today_section <> 'none' OR start_date IS NOT NULL)
  AND disposition = 'present'
  AND lifecycle = 'open';

DROP INDEX IF EXISTS public.tasks_projects_owner_today_section_order_idx;
CREATE INDEX tasks_projects_owner_today_section_order_idx
ON public.tasks_projects (owner_id, today_section, planning_order_key, id)
WHERE destination = 'anytime'
  AND (today_section <> 'none' OR start_date IS NOT NULL)
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
        WHEN COALESCE(_snapshot ->> 'destination', 'inbox') = 'inbox' THEN 'inbox'
        WHEN _snapshot ->> 'destination' = 'today'
          AND _snapshot ->> 'today_section' = 'evening' THEN 'later'
        WHEN _snapshot ->> 'destination' = 'today'
          AND _snapshot ->> 'today_section' IN ('inbox', 'now', 'next', 'later')
          THEN _snapshot ->> 'today_section'
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
        AND COALESCE(_task ->> 'today_section', '')
          IN ('none', 'inbox', 'now', 'next', 'later')
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
    WHEN _source_destination = 'inbox' THEN 'inbox'
    WHEN _source_destination = 'today' AND _source_today_section = 'evening' THEN 'later'
    WHEN _source_destination = 'today'
      AND _source_today_section IN ('inbox', 'now', 'next', 'later')
      THEN _source_today_section
    WHEN _source_destination = 'today' THEN 'next'
    WHEN COALESCE(_source_today_section, 'daytime') IN ('daytime', 'evening') THEN 'none'
    ELSE _source_today_section
  END;
  _start_date date := CASE WHEN _start_offset_days IS NULL
    THEN NULL ELSE _anchor_date + _start_offset_days END;
  _deadline date := CASE WHEN _deadline_offset_days IS NULL
    THEN NULL ELSE _anchor_date + _deadline_offset_days END;
BEGIN
  -- Preserve the established helper signature while planning dates and
  -- project-kind gating no longer alter an item's independent day horizon.
  PERFORM _planning_date, _allow_inbox;

  IF _destination = 'someday' THEN
    _start_date := NULL;
    _today_section := 'none';
  ELSIF _destination <> 'anytime' THEN
    RAISE EXCEPTION 'Template planning destination is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF _today_section NOT IN ('none', 'inbox', 'now', 'next', 'later') THEN
    RAISE EXCEPTION 'Template day horizon is invalid'
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
      OR _task.today_section IS DISTINCT FROM 'inbox'
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
        NULL, 'anytime', 'inbox', _order_key,
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

  _normalized := _normalized || jsonb_build_object(
    'destination', CASE
      WHEN _destination IN ('inbox', 'today') THEN 'anytime'
      ELSE _destination
    END,
    'today_section', CASE
      WHEN _destination = 'inbox' THEN 'inbox'
      WHEN _destination = 'today' AND _today_section = 'evening' THEN 'later'
      WHEN _destination = 'today'
        AND _today_section IN ('inbox', 'now', 'next', 'later')
        THEN _today_section
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

-- Keep recoverable hierarchy restore compatible with the current planning model.
-- A child restored without its independently deleted parent becomes an
-- unparented Anytime item in Today Inbox and loses only the invalidated date.
CREATE OR REPLACE FUNCTION tasks_private.apply_hierarchy_operation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _current_revisions jsonb;
  _result_revisions jsonb;
  _affected_ids uuid[];
  _target_lifecycle text;
  _open_descendants integer;
  _root_found boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Hierarchy operation owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_object_agg(candidate.entity_id::text, candidate.revision
      ORDER BY candidate.entity_id), '{}'::jsonb),
    COALESCE(array_agg(candidate.entity_id ORDER BY candidate.entity_id), ARRAY[]::uuid[])
  INTO _current_revisions, _affected_ids
  FROM tasks_private.hierarchy_operation_candidates(
    NEW.owner_id, NEW.root_type, NEW.root_id, NEW.operation, NEW.descendant_policy
  ) AS candidate;

  _root_found := NEW.root_id::text = ANY(
    ARRAY(SELECT jsonb_object_keys(_current_revisions))
  );
  IF NOT _root_found THEN
    UPDATE public.tasks_hierarchy_operations
    SET outcome = 'rejected', code = 'root_not_found', completed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.operation IN ('complete_project', 'cancel_project')
    AND NEW.descendant_policy = 'reject' THEN
    SELECT count(*) INTO _open_descendants
    FROM public.tasks_todos AS task
    WHERE task.owner_id = NEW.owner_id
      AND task.project_id = NEW.root_id
      AND task.disposition = 'present'
      AND task.lifecycle = 'open';
    IF _open_descendants > 0 THEN
      UPDATE public.tasks_hierarchy_operations
      SET outcome = 'rejected', code = 'open_descendants', completed_at = now()
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;
  END IF;

  IF _current_revisions IS DISTINCT FROM NEW.expected_revisions THEN
    UPDATE public.tasks_hierarchy_operations
    SET outcome = 'conflict', code = 'revision_set_changed', completed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.operation = 'restore' AND NEW.root_type = 'heading' AND NOT EXISTS (
    SELECT 1
    FROM public.tasks_headings AS heading
    JOIN public.tasks_projects AS project
      ON project.id = heading.project_id AND project.owner_id = heading.owner_id
    WHERE heading.owner_id = NEW.owner_id AND heading.id = NEW.root_id
      AND project.disposition = 'present'
  ) THEN
    UPDATE public.tasks_hierarchy_operations
    SET outcome = 'rejected', code = 'parent_not_present', completed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.operation = 'restore' AND NEW.root_type = 'checklist_item' AND NOT EXISTS (
    SELECT 1
    FROM public.tasks_checklist_items AS item
    JOIN public.tasks_todos AS task
      ON task.id = item.task_id AND task.owner_id = item.owner_id
    WHERE item.owner_id = NEW.owner_id AND item.id = NEW.root_id
      AND task.disposition = 'present'
  ) THEN
    UPDATE public.tasks_hierarchy_operations
    SET outcome = 'rejected', code = 'parent_not_present', completed_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO tasks_private.hierarchy_operation_contexts (
    backend_pid, transaction_id, owner_id, operation_id
  ) VALUES (pg_backend_pid(), txid_current(), NEW.owner_id, NEW.id);

  IF NEW.operation IN ('complete_project', 'cancel_project', 'reopen_project') THEN
    _target_lifecycle := CASE NEW.operation
      WHEN 'complete_project' THEN 'completed'
      WHEN 'cancel_project' THEN 'canceled'
      ELSE 'open'
    END;

    IF EXISTS (
      SELECT 1 FROM public.tasks_projects AS project
      WHERE project.owner_id = NEW.owner_id AND project.id = NEW.root_id
        AND project.lifecycle = _target_lifecycle
    ) THEN
      DELETE FROM tasks_private.hierarchy_operation_contexts
      WHERE backend_pid = pg_backend_pid() AND transaction_id = txid_current();
      UPDATE public.tasks_hierarchy_operations
      SET outcome = 'noop', affected_ids = ARRAY[NEW.root_id],
        result_revisions = _current_revisions, completed_at = now()
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;

    UPDATE public.tasks_projects AS project
    SET lifecycle = _target_lifecycle,
      completed_at = CASE WHEN _target_lifecycle = 'completed' THEN NEW.requested_at ELSE NULL END,
      canceled_at = CASE WHEN _target_lifecycle = 'canceled' THEN NEW.requested_at ELSE NULL END,
      revision = project.revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE project.owner_id = NEW.owner_id AND project.id = NEW.root_id;

    IF NEW.descendant_policy = 'cascade'
      AND NEW.operation IN ('complete_project', 'cancel_project') THEN
      UPDATE public.tasks_todos AS task
      SET lifecycle = _target_lifecycle,
        completed_at = CASE WHEN _target_lifecycle = 'completed' THEN NEW.requested_at ELSE NULL END,
        canceled_at = CASE WHEN _target_lifecycle = 'canceled' THEN NEW.requested_at ELSE NULL END,
        revision = task.revision + 1,
        client_mutation_id = gen_random_uuid(),
        last_mutation_channel = NEW.mutation_channel,
        last_actor_type = NEW.actor_type
      WHERE task.owner_id = NEW.owner_id AND task.project_id = NEW.root_id
        AND task.disposition = 'present' AND task.lifecycle = 'open';
    END IF;
  ELSIF NEW.operation = 'delete' THEN
    UPDATE public.tasks_checklist_items AS item
    SET disposition = 'deleted', deleted_at = NEW.requested_at,
      deletion_root_id = NEW.root_id, revision = item.revision + 1,
      client_mutation_id = gen_random_uuid(), last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE item.owner_id = NEW.owner_id AND item.id = ANY(_affected_ids)
      AND item.disposition = 'present';
    UPDATE public.tasks_todos AS task
    SET disposition = 'deleted', deleted_at = NEW.requested_at,
      deletion_root_id = NEW.root_id, revision = task.revision + 1,
      client_mutation_id = gen_random_uuid(), last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE task.owner_id = NEW.owner_id AND task.id = ANY(_affected_ids)
      AND task.disposition = 'present';
    UPDATE public.tasks_headings AS heading
    SET disposition = 'deleted', deleted_at = NEW.requested_at,
      deletion_root_id = NEW.root_id, revision = heading.revision + 1,
      client_mutation_id = gen_random_uuid(), last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE heading.owner_id = NEW.owner_id AND heading.id = ANY(_affected_ids)
      AND heading.disposition = 'present';
    UPDATE public.tasks_projects AS project
    SET disposition = 'deleted', deleted_at = NEW.requested_at,
      deletion_root_id = NEW.root_id, revision = project.revision + 1,
      client_mutation_id = gen_random_uuid(), last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE project.owner_id = NEW.owner_id AND project.id = ANY(_affected_ids)
      AND project.disposition = 'present';
    UPDATE public.tasks_areas AS area
    SET disposition = 'deleted', deleted_at = NEW.requested_at,
      deletion_root_id = NEW.root_id, revision = area.revision + 1,
      client_mutation_id = gen_random_uuid(), last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE area.owner_id = NEW.owner_id AND area.id = ANY(_affected_ids)
      AND area.disposition = 'present';
  ELSE
    -- Restore parents before descendants so presentation validity can be evaluated deterministically.
    UPDATE public.tasks_areas AS area
    SET disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
      revision = area.revision + 1, client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel, last_actor_type = NEW.actor_type
    WHERE area.owner_id = NEW.owner_id AND area.deletion_root_id = NEW.root_id;
    UPDATE public.tasks_projects AS project
    SET disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
      area_id = CASE WHEN project.area_id IS NULL OR EXISTS (
        SELECT 1 FROM public.tasks_areas AS area
        WHERE area.owner_id = project.owner_id AND area.id = project.area_id
          AND area.disposition = 'present'
      ) THEN project.area_id ELSE NULL END,
      revision = project.revision + 1, client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel, last_actor_type = NEW.actor_type
    WHERE project.owner_id = NEW.owner_id AND project.deletion_root_id = NEW.root_id;
    UPDATE public.tasks_headings AS heading
    SET disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
      revision = heading.revision + 1, client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel, last_actor_type = NEW.actor_type
    WHERE heading.owner_id = NEW.owner_id AND heading.deletion_root_id = NEW.root_id
      AND EXISTS (
        SELECT 1 FROM public.tasks_projects AS project
        WHERE project.owner_id = heading.owner_id AND project.id = heading.project_id
          AND project.disposition = 'present'
      );
    UPDATE public.tasks_todos AS task
    SET disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
      area_id = CASE WHEN task.area_id IS NULL OR EXISTS (
        SELECT 1 FROM public.tasks_areas AS area
        WHERE area.owner_id = task.owner_id AND area.id = task.area_id
          AND area.disposition = 'present'
      ) THEN task.area_id ELSE NULL END,
      project_id = CASE WHEN task.project_id IS NULL OR EXISTS (
        SELECT 1 FROM public.tasks_projects AS project
        WHERE project.owner_id = task.owner_id AND project.id = task.project_id
          AND project.disposition = 'present'
      ) THEN task.project_id ELSE NULL END,
      heading_id = CASE WHEN task.heading_id IS NULL THEN NULL WHEN EXISTS (
        SELECT 1
        FROM public.tasks_headings AS heading
        JOIN public.tasks_projects AS project
          ON project.id = heading.project_id AND project.owner_id = heading.owner_id
        WHERE heading.owner_id = task.owner_id AND heading.id = task.heading_id
          AND heading.disposition = 'present' AND project.disposition = 'present'
      ) THEN task.heading_id ELSE NULL END,
      destination = CASE WHEN
        (task.area_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_areas AS area
          WHERE area.owner_id = task.owner_id AND area.id = task.area_id
            AND area.disposition = 'present'
        )) OR (task.project_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_projects AS project
          WHERE project.owner_id = task.owner_id AND project.id = task.project_id
            AND project.disposition = 'present'
        )) THEN 'anytime' ELSE task.destination END,
      today_section = CASE WHEN
        (task.area_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_areas AS area
          WHERE area.owner_id = task.owner_id AND area.id = task.area_id
            AND area.disposition = 'present'
        )) OR (task.project_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_projects AS project
          WHERE project.owner_id = task.owner_id AND project.id = task.project_id
            AND project.disposition = 'present'
        )) THEN 'inbox' ELSE task.today_section END,
      start_date = CASE WHEN
        (task.area_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_areas AS area
          WHERE area.owner_id = task.owner_id AND area.id = task.area_id
            AND area.disposition = 'present'
        )) OR (task.project_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.tasks_projects AS project
          WHERE project.owner_id = task.owner_id AND project.id = task.project_id
            AND project.disposition = 'present'
        )) THEN NULL ELSE task.start_date END,
      revision = task.revision + 1, client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel, last_actor_type = NEW.actor_type
    WHERE task.owner_id = NEW.owner_id AND task.deletion_root_id = NEW.root_id;
    UPDATE public.tasks_checklist_items AS item
    SET disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
      revision = item.revision + 1, client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel, last_actor_type = NEW.actor_type
    WHERE item.owner_id = NEW.owner_id AND item.deletion_root_id = NEW.root_id
      AND EXISTS (
        SELECT 1 FROM public.tasks_todos AS task
        WHERE task.owner_id = item.owner_id AND task.id = item.task_id
          AND task.disposition = 'present'
      );
  END IF;

  SELECT COALESCE(jsonb_object_agg(candidate.entity_id::text, candidate.revision
      ORDER BY candidate.entity_id), '{}'::jsonb)
  INTO _result_revisions
  FROM (
    SELECT area.id AS entity_id, area.revision FROM public.tasks_areas AS area
    WHERE area.owner_id = NEW.owner_id AND area.id = ANY(_affected_ids)
    UNION ALL
    SELECT project.id, project.revision FROM public.tasks_projects AS project
    WHERE project.owner_id = NEW.owner_id AND project.id = ANY(_affected_ids)
    UNION ALL
    SELECT heading.id, heading.revision FROM public.tasks_headings AS heading
    WHERE heading.owner_id = NEW.owner_id AND heading.id = ANY(_affected_ids)
    UNION ALL
    SELECT task.id, task.revision FROM public.tasks_todos AS task
    WHERE task.owner_id = NEW.owner_id AND task.id = ANY(_affected_ids)
    UNION ALL
    SELECT item.id, item.revision FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = NEW.owner_id AND item.id = ANY(_affected_ids)
  ) AS candidate;

  DELETE FROM tasks_private.hierarchy_operation_contexts
  WHERE backend_pid = pg_backend_pid() AND transaction_id = txid_current();

  UPDATE public.tasks_hierarchy_operations
  SET outcome = 'accepted', affected_ids = _affected_ids,
    result_revisions = _result_revisions, completed_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.apply_hierarchy_operation()
FROM PUBLIC, anon, authenticated;
