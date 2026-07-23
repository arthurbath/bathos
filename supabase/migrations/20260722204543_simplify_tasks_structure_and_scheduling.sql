-- Simplify Tasks planning around a single start date and flatten headings.

-- Relax the legacy placement contract before converting its `none` sentinel
-- to SQL NULL. Replacement constraints are installed immediately below after
-- the existing rows have been normalized through audited revisions.
ALTER TABLE public.tasks_todos
  ALTER COLUMN today_section DROP DEFAULT,
  ALTER COLUMN today_section DROP NOT NULL,
  DROP CONSTRAINT tasks_todos_today_section_valid,
  DROP CONSTRAINT tasks_todos_planning_placement_valid,
  DROP CONSTRAINT tasks_todos_calendar_range_valid,
  DROP CONSTRAINT tasks_todos_actionability_valid;

ALTER TABLE public.tasks_projects
  ALTER COLUMN today_section DROP DEFAULT,
  ALTER COLUMN today_section DROP NOT NULL,
  DROP CONSTRAINT tasks_projects_today_section_valid,
  DROP CONSTRAINT tasks_projects_planning_placement_valid,
  DROP CONSTRAINT tasks_projects_calendar_range_valid;

UPDATE public.tasks_todos AS task
SET start_date = COALESCE(
      task.start_date,
      (clock_timestamp() AT TIME ZONE COALESCE(settings.planning_timezone, 'UTC'))::date
    ),
    today_section = CASE
      WHEN task.today_section = 'none' THEN 'next'
      ELSE task.today_section
    END,
    revision = task.revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'import',
    last_actor_type = 'system'
FROM public.tasks_user_settings AS settings
WHERE settings.owner_id = task.owner_id
  AND task.destination = 'anytime'
  AND (task.start_date IS NOT NULL OR task.today_section <> 'none');

UPDATE public.tasks_todos
SET start_date = NULL,
    today_section = NULL,
    revision = revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'import',
    last_actor_type = 'system'
WHERE destination = 'someday'
  AND (start_date IS NOT NULL OR today_section IS NOT NULL);

UPDATE public.tasks_todos
SET today_section = NULL,
    revision = revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'import',
    last_actor_type = 'system'
WHERE start_date IS NULL
  AND today_section IS NOT NULL;

UPDATE public.tasks_projects AS project
SET start_date = COALESCE(
      project.start_date,
      (clock_timestamp() AT TIME ZONE COALESCE(settings.planning_timezone, 'UTC'))::date
    ),
    today_section = CASE
      WHEN project.today_section = 'none' THEN 'next'
      ELSE project.today_section
    END,
    revision = project.revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'import',
    last_actor_type = 'system'
FROM public.tasks_user_settings AS settings
WHERE settings.owner_id = project.owner_id
  AND project.destination = 'anytime'
  AND (project.start_date IS NOT NULL OR project.today_section <> 'none');

UPDATE public.tasks_projects
SET start_date = NULL,
    today_section = NULL,
    revision = revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'import',
    last_actor_type = 'system'
WHERE destination = 'someday'
  AND (start_date IS NOT NULL OR today_section IS NOT NULL);

UPDATE public.tasks_projects
SET today_section = NULL,
    revision = revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'import',
    last_actor_type = 'system'
WHERE start_date IS NULL
  AND today_section IS NOT NULL;

ALTER TABLE public.tasks_todos
  ADD CONSTRAINT tasks_todos_today_section_valid CHECK (
    today_section IS NULL OR today_section IN ('inbox', 'now', 'next', 'later')
  ),
  ADD CONSTRAINT tasks_todos_planning_placement_valid CHECK (
    (destination = 'someday' AND start_date IS NULL AND today_section IS NULL)
    OR
    (destination = 'anytime' AND (
      (start_date IS NULL AND today_section IS NULL)
      OR (start_date IS NOT NULL AND today_section IS NOT NULL)
    ))
  ),
  ADD CONSTRAINT tasks_todos_actionability_valid CHECK (
    actionability IN ('actionable', 'waiting', 'rechecking')
  );

ALTER TABLE public.tasks_projects
  ADD CONSTRAINT tasks_projects_today_section_valid CHECK (
    today_section IS NULL OR today_section IN ('inbox', 'now', 'next', 'later')
  ),
  ADD CONSTRAINT tasks_projects_planning_placement_valid CHECK (
    (destination = 'someday' AND start_date IS NULL AND today_section IS NULL)
    OR
    (destination = 'anytime' AND (
      (start_date IS NULL AND today_section IS NULL)
      OR (start_date IS NOT NULL AND today_section IS NOT NULL)
    ))
  );

CREATE OR REPLACE FUNCTION tasks_private.normalize_root_planning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.destination = 'someday' THEN
    NEW.start_date := NULL;
    NEW.today_section := NULL;
  ELSIF NEW.start_date IS NULL THEN
    NEW.today_section := NULL;
  ELSIF NEW.today_section IS NULL THEN
    NEW.today_section := 'next';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_todos_normalize_root_planning ON public.tasks_todos;
CREATE TRIGGER tasks_todos_normalize_root_planning
BEFORE INSERT OR UPDATE OF destination, start_date, today_section ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.normalize_root_planning();

DROP TRIGGER IF EXISTS tasks_projects_normalize_root_planning ON public.tasks_projects;
CREATE TRIGGER tasks_projects_normalize_root_planning
BEFORE INSERT OR UPDATE OF destination, start_date, today_section ON public.tasks_projects
FOR EACH ROW EXECUTE FUNCTION tasks_private.normalize_root_planning();

-- Existing reminders inherit their parent's start date. Invalid orphan schedules
-- are canceled instead of receiving an invented date.
UPDATE public.tasks_reminders AS reminder
SET local_date = parent.start_date,
    record_revision = reminder.record_revision + 1,
    last_mutation_channel = 'import',
    last_actor_type = 'system',
    client_mutation_id = gen_random_uuid(),
    updated_at = clock_timestamp()
FROM (
  SELECT id, owner_id, start_date FROM public.tasks_todos
  UNION ALL
  SELECT id, owner_id, start_date FROM public.tasks_projects
) AS parent
WHERE parent.owner_id = reminder.owner_id
  AND parent.id = COALESCE(reminder.task_id, reminder.project_id)
  AND reminder.status = 'active'
  AND parent.start_date IS NOT NULL;

UPDATE public.tasks_reminders AS reminder
SET status = 'canceled',
    record_revision = record_revision + 1,
    last_mutation_channel = 'web',
    last_actor_type = 'system',
    client_mutation_id = gen_random_uuid(),
    updated_at = clock_timestamp()
WHERE reminder.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.tasks_todos AS task
    WHERE reminder.root_type = 'todo'
      AND task.owner_id = reminder.owner_id
      AND task.id = reminder.task_id
      AND task.start_date IS NOT NULL
    UNION ALL
    SELECT 1 FROM public.tasks_projects AS project
    WHERE reminder.root_type = 'project'
      AND project.owner_id = reminder.owner_id
      AND project.id = reminder.project_id
      AND project.start_date IS NOT NULL
  );

UPDATE public.tasks_reminder_occurrences AS occurrence
SET status = 'canceled'
FROM public.tasks_reminders AS reminder
WHERE reminder.id = occurrence.reminder_id
  AND reminder.owner_id = occurrence.owner_id
  AND reminder.status = 'canceled'
  AND occurrence.status = 'scheduled';

CREATE OR REPLACE FUNCTION tasks_private.anchor_reminder_to_root_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _start_date date;
  _resolved_at timestamptz;
  _resolution_kind text;
BEGIN
  IF NEW.root_type = 'todo' THEN
    SELECT task.start_date INTO _start_date
    FROM public.tasks_todos AS task
    WHERE task.owner_id = NEW.owner_id AND task.id = NEW.task_id
      AND task.disposition = 'present' AND task.lifecycle = 'open';
  ELSIF NEW.root_type = 'project' THEN
    SELECT project.start_date INTO _start_date
    FROM public.tasks_projects AS project
    WHERE project.owner_id = NEW.owner_id AND project.id = NEW.project_id
      AND project.disposition = 'present' AND project.lifecycle = 'open';
  END IF;
  IF _start_date IS NULL AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'A reminder requires a start date' USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'active' THEN
    SELECT resolution.resolved_at, resolution.resolution_kind
    INTO _resolved_at, _resolution_kind
    FROM tasks_private.resolve_reminder_instant(
      _start_date, NEW.local_time, NEW.time_zone, NEW.ambiguity_choice
    ) AS resolution;
    NEW.local_date := _start_date;
    NEW.resolved_at := _resolved_at;
    NEW.resolution_kind := _resolution_kind;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_reminders_anchor_to_root_start ON public.tasks_reminders;
CREATE TRIGGER tasks_reminders_anchor_to_root_start
BEFORE INSERT OR UPDATE OF local_date, local_time, time_zone, ambiguity_choice, status
ON public.tasks_reminders
FOR EACH ROW EXECUTE FUNCTION tasks_private.anchor_reminder_to_root_start();

CREATE OR REPLACE FUNCTION public.tasks_save_start_reminder(
  _reminder_id uuid,
  _expected_record_revision bigint,
  _root_type text,
  _root_id uuid,
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
  _start_date date;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save reminders' USING ERRCODE = '42501';
  END IF;
  IF _root_type = 'todo' THEN
    SELECT task.start_date INTO _start_date
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id AND task.id = _root_id
      AND task.disposition = 'present' AND task.lifecycle = 'open';
  ELSIF _root_type = 'project' THEN
    SELECT project.start_date INTO _start_date
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id AND project.id = _root_id
      AND project.disposition = 'present' AND project.lifecycle = 'open';
  ELSE
    RAISE EXCEPTION 'The reminder request is invalid' USING ERRCODE = '22023';
  END IF;
  IF _start_date IS NULL THEN
    RAISE EXCEPTION 'A reminder requires a start date' USING ERRCODE = '22023';
  END IF;

  RETURN public.tasks_save_reminder(
    _reminder_id,
    _expected_record_revision,
    _root_type,
    _root_id,
    _start_date,
    _local_time,
    _time_zone,
    _ambiguity_choice,
    _mutation_id,
    _mutation_channel,
    _actor_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_save_start_reminder(
  uuid, bigint, text, uuid, text, text, text, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_save_start_reminder(
  uuid, bigint, text, uuid, text, text, text, uuid, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.rebind_root_reminder_to_start_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _reminder public.tasks_reminders;
  _resolved_at timestamptz;
  _resolution_kind text;
  _mutation_id uuid;
BEGIN
  IF NEW.start_date IS NOT DISTINCT FROM OLD.start_date THEN
    RETURN NEW;
  END IF;

  FOR _reminder IN
    SELECT reminder.*
    FROM public.tasks_reminders AS reminder
    WHERE reminder.owner_id = NEW.owner_id
      AND reminder.status = 'active'
      AND (
        (TG_TABLE_NAME = 'tasks_todos' AND reminder.task_id = NEW.id)
        OR (TG_TABLE_NAME = 'tasks_projects' AND reminder.project_id = NEW.id)
      )
    FOR UPDATE
  LOOP
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

    IF NEW.start_date IS NULL THEN
      UPDATE public.tasks_reminders
      SET status = 'canceled',
          record_revision = record_revision + 1,
          last_mutation_channel = NEW.last_mutation_channel,
          last_actor_type = 'system',
          client_mutation_id = _mutation_id,
          updated_at = clock_timestamp()
      WHERE id = _reminder.id AND owner_id = NEW.owner_id;
      CONTINUE;
    END IF;

    SELECT resolution.resolved_at, resolution.resolution_kind
    INTO _resolved_at, _resolution_kind
    FROM tasks_private.resolve_reminder_instant(
      NEW.start_date,
      _reminder.local_time,
      _reminder.time_zone,
      _reminder.ambiguity_choice
    ) AS resolution;

    UPDATE public.tasks_reminders
    SET local_date = NEW.start_date,
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
END;
$$;

DROP TRIGGER IF EXISTS tasks_todos_rebind_reminder_to_start_date ON public.tasks_todos;
CREATE TRIGGER tasks_todos_rebind_reminder_to_start_date
AFTER UPDATE OF start_date ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.rebind_root_reminder_to_start_date();

DROP TRIGGER IF EXISTS tasks_projects_rebind_reminder_to_start_date ON public.tasks_projects;
CREATE TRIGGER tasks_projects_rebind_reminder_to_start_date
AFTER UPDATE OF start_date ON public.tasks_projects
FOR EACH ROW EXECUTE FUNCTION tasks_private.rebind_root_reminder_to_start_date();

-- Flatten heading children in place before removing the heading persistence layer.
UPDATE public.tasks_todos
SET heading_id = NULL,
    revision = revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'import',
    last_actor_type = 'system'
WHERE heading_id IS NOT NULL;
ALTER TABLE public.tasks_todos DROP CONSTRAINT tasks_todos_heading_project_owner_fkey;
ALTER TABLE public.tasks_todos DROP CONSTRAINT tasks_todos_container_valid;
ALTER TABLE public.tasks_todos DROP COLUMN heading_id;
ALTER TABLE public.tasks_todos ADD CONSTRAINT tasks_todos_container_valid CHECK (
  NOT (area_id IS NOT NULL AND project_id IS NOT NULL)
);

DELETE FROM public.tasks_hierarchy_history_events
WHERE entity_type = 'heading'
  OR operation_id IN (
    SELECT id FROM public.tasks_hierarchy_operations WHERE root_type = 'heading'
  );
DELETE FROM public.tasks_hierarchy_operations
WHERE root_type = 'heading';

ALTER TABLE public.tasks_hierarchy_operations
  DROP CONSTRAINT tasks_hierarchy_operations_root_type_valid,
  ADD CONSTRAINT tasks_hierarchy_operations_root_type_valid CHECK (
    root_type IN ('area', 'project', 'todo', 'checklist_item')
  );
ALTER TABLE public.tasks_hierarchy_history_events
  DROP CONSTRAINT tasks_hierarchy_history_entity_type_valid,
  ADD CONSTRAINT tasks_hierarchy_history_entity_type_valid CHECK (
    entity_type IN ('area', 'project', 'checklist_item')
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync') THEN
    ALTER PUBLICATION powersync DROP TABLE public.tasks_headings;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END;
$$;

DROP TABLE public.tasks_headings;

-- After-completion recurrences can export a successor before its predecessor
-- because stable export ordering is identifier-based. Defer the self-reference
-- so a restore validates the complete occurrence graph at transaction end.
ALTER TABLE public.tasks_recurrence_occurrences
  DROP CONSTRAINT tasks_recurrence_occurrences_predecessor_owner_fkey,
  ADD CONSTRAINT tasks_recurrence_occurrences_predecessor_owner_fkey
    FOREIGN KEY (predecessor_occurrence_id, owner_id)
    REFERENCES public.tasks_recurrence_occurrences(id, owner_id)
    DEFERRABLE INITIALLY DEFERRED;

-- Export schema 12 removes headings and normalizes every active planning record
-- to the start-dependent horizon contract. Older envelopes are upgraded in
-- memory so their to-dos remain in their projects while heading records vanish.
CREATE OR REPLACE FUNCTION tasks_private.normalize_export_v12_record(
  _collection text,
  _record jsonb,
  _planning_date date
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _normalized jsonb := _record - 'owner_id' - 'heading_id';
  _destination text;
  _horizon text;
  _start_date date;
  _snapshot jsonb;
BEGIN
  IF _collection IN ('tasks_todos', 'tasks_projects') THEN
    _destination := CASE
      WHEN _normalized ->> 'destination' IN ('inbox', 'today') THEN 'anytime'
      WHEN _normalized ->> 'destination' = 'someday' THEN 'someday'
      ELSE 'anytime'
    END;
    BEGIN
      _start_date := NULLIF(_normalized ->> 'start_date', '')::date;
    EXCEPTION WHEN OTHERS THEN
      _start_date := NULL;
    END;
    _horizon := CASE _normalized ->> 'today_section'
      WHEN 'inbox' THEN 'inbox'
      WHEN 'now' THEN 'now'
      WHEN 'next' THEN 'next'
      WHEN 'later' THEN 'later'
      WHEN 'daytime' THEN 'next'
      WHEN 'evening' THEN 'later'
      ELSE NULL
    END;
    IF _destination = 'someday' THEN
      _start_date := NULL;
      _horizon := NULL;
    ELSIF _start_date IS NULL AND (
      _horizon IS NOT NULL OR _normalized ->> 'destination' IN ('inbox', 'today')
    ) THEN
      _start_date := _planning_date;
      _horizon := COALESCE(_horizon, 'next');
    ELSIF _start_date IS NOT NULL THEN
      _horizon := COALESCE(_horizon, 'next');
    ELSE
      _horizon := NULL;
    END IF;
    _normalized := _normalized || jsonb_build_object(
      'destination', _destination,
      'start_date', to_jsonb(_start_date),
      'today_section', to_jsonb(_horizon)
    );
  END IF;

  IF _collection = 'tasks_todos' THEN
    _normalized := jsonb_build_object(
      'actionability', 'actionable',
      'area_id', NULL,
      'project_id', NULL,
      'hierarchy_order_key', NULL,
      'deletion_root_id', NULL,
      'template_definition_id', NULL,
      'template_revision', NULL,
      'template_instantiation_id', NULL,
      'template_node_id', NULL,
      'recurrence_definition_id', NULL,
      'recurrence_revision', NULL,
      'recurrence_occurrence_id', NULL,
      'recurrence_logical_key', NULL
    ) || _normalized;
    IF _normalized ->> 'actionability' NOT IN ('actionable', 'waiting', 'rechecking') THEN
      _normalized := jsonb_set(_normalized, '{actionability}', '"actionable"'::jsonb);
    END IF;
  ELSIF _collection = 'tasks_projects' THEN
    _normalized := jsonb_build_object(
      'area_id', NULL,
      'deletion_root_id', NULL,
      'template_definition_id', NULL,
      'template_revision', NULL,
      'template_instantiation_id', NULL,
      'template_node_id', NULL,
      'recurrence_definition_id', NULL,
      'recurrence_revision', NULL,
      'recurrence_occurrence_id', NULL,
      'recurrence_logical_key', NULL
    ) || _normalized;
  ELSIF _collection = 'tasks_areas' THEN
    _normalized := jsonb_build_object(
      'deletion_root_id', NULL
    ) || _normalized;
  ELSIF _collection = 'tasks_checklist_items' THEN
    _normalized := jsonb_build_object(
      'deletion_root_id', NULL,
      'template_definition_id', NULL,
      'template_revision', NULL,
      'template_instantiation_id', NULL,
      'template_node_id', NULL
    ) || _normalized;
  ELSIF _collection = 'tasks_template_revisions' THEN
    _snapshot := _normalized -> 'snapshot';
    IF jsonb_typeof(_snapshot) = 'object' AND _snapshot ->> 'kind' = 'project' THEN
      _snapshot := (_snapshot - 'headings') || jsonb_build_object(
        'todos', COALESCE((
          SELECT jsonb_agg(todo.value - 'heading_node_id')
          FROM jsonb_array_elements(COALESCE(_snapshot -> 'todos', '[]'::jsonb)) AS todo(value)
        ), '[]'::jsonb)
      );
      _normalized := jsonb_set(_normalized, '{snapshot}', _snapshot, true);
    ELSIF jsonb_typeof(_snapshot) = 'object' AND _snapshot ->> 'kind' = 'todo' THEN
      _normalized := jsonb_set(
        _normalized, '{snapshot,root}', (_snapshot -> 'root') - 'heading_node_id', true
      );
    END IF;
  ELSIF _collection = 'tasks_template_instantiations' THEN
    _normalized := jsonb_set(
      _normalized,
      '{result}',
      COALESCE(_normalized -> 'result', '{}'::jsonb) - 'heading_ids',
      true
    );
  ELSIF _collection = 'tasks_history_events' THEN
    _normalized := tasks_private.normalize_history_event_v4(_normalized);
  END IF;
  RETURN _normalized;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_export_v12_record(text, jsonb, date)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.upgrade_export_to_v12(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _version integer;
  _planning_date date;
  _collection text;
  _records jsonb;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(_envelope ->> 'schema_version', '') !~ '^\d+$' THEN
    RAISE EXCEPTION 'Task export schema version is invalid' USING ERRCODE = '22023';
  END IF;
  _version := (_envelope ->> 'schema_version')::integer;
  IF _version < 3 OR _version > 12 THEN
    RAISE EXCEPTION 'Task export schema version is unsupported' USING ERRCODE = '22023';
  END IF;
  CASE _version
    WHEN 3 THEN PERFORM tasks_private.validate_export_v3(_envelope);
    WHEN 4 THEN PERFORM tasks_private.validate_export_v4(_envelope);
    WHEN 5 THEN PERFORM tasks_private.validate_export_v5(_envelope);
    WHEN 6 THEN PERFORM tasks_private.validate_export_v6(_envelope);
    WHEN 7 THEN PERFORM tasks_private.validate_export_v7(_envelope);
    WHEN 8 THEN PERFORM tasks_private.validate_export_v8(_envelope);
    WHEN 9 THEN PERFORM tasks_private.validate_export_v9(_envelope);
    WHEN 10 THEN PERFORM tasks_private.validate_export_v10(_envelope);
    WHEN 11 THEN PERFORM tasks_private.validate_export_v11(_envelope);
    WHEN 12 THEN PERFORM tasks_private.validate_export_v12(_envelope);
  END CASE;
  SELECT (clock_timestamp() AT TIME ZONE COALESCE(settings.planning_timezone, 'UTC'))::date
  INTO _planning_date
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.tasks_user_settings AS settings ON settings.owner_id = _owner_id;
  FOREACH _collection IN ARRAY _collections LOOP
    SELECT COALESCE(jsonb_agg(
      tasks_private.normalize_export_v12_record(_collection, item.value, _planning_date)
      ORDER BY item.value ->> 'id'
    ), '[]'::jsonb)
    INTO _records
    FROM jsonb_array_elements(COALESCE(
      _envelope #> ARRAY['data', _collection], '[]'::jsonb
    )) AS item(value)
    WHERE NOT (
      (_collection = 'tasks_hierarchy_history_events'
        AND item.value ->> 'entity_type' = 'heading')
      OR (_collection = 'tasks_hierarchy_operations'
        AND item.value ->> 'root_type' = 'heading')
    );
    _data := _data || jsonb_build_object(_collection, _records);
    _counts := _counts || jsonb_build_object(_collection, jsonb_array_length(_records));
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export', 'schema_version', 12,
    'created_at', COALESCE(_envelope -> 'created_at', to_jsonb(clock_timestamp())),
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections), 'counts', _counts, 'checksums', _checksums
    ),
    'data', _data
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.upgrade_export_to_v12(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.export_v12_collection(
  _collection text,
  _owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _records jsonb;
BEGIN
  CASE _collection
    WHEN 'tasks_areas' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_areas AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_projects' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_projects AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_todos' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_todos AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_checklist_items' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_checklist_items AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_history_events' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_history_events AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_hierarchy_operations' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_hierarchy_operations AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_hierarchy_history_events' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_hierarchy_history_events AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_user_settings' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_user_settings AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_mail_sources' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_mail_sources AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_mail_source_events' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_mail_source_events AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_templates' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_templates AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_template_revisions' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_template_revisions AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_template_instantiations' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_template_instantiations AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_recurrence_definitions' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_recurrence_definitions AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_recurrence_revisions' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_recurrence_revisions AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_recurrence_occurrences' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_recurrence_occurrences AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_recurrence_evaluations' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_recurrence_evaluations AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_recurrence_status_events' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_recurrence_status_events AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_reminders' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_reminders AS record WHERE record.owner_id = _owner_id;
    WHEN 'tasks_reminder_occurrences' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(record) - 'owner_id' ORDER BY (to_jsonb(record) - 'owner_id')::text), '[]'::jsonb)
      INTO _records FROM public.tasks_reminder_occurrences AS record WHERE record.owner_id = _owner_id;
    ELSE
      RAISE EXCEPTION 'Unsupported schema-12 export collection' USING ERRCODE = '22023';
  END CASE;
  RETURN _records;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.export_v12_collection(text, uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v12()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _collection text;
  _records jsonb;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
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
  FOREACH _collection IN ARRAY _collections LOOP
    _records := tasks_private.export_v12_collection(_collection, _owner_id);
    IF _collection = 'tasks_template_revisions' THEN
      SELECT COALESCE(jsonb_agg(
        tasks_private.normalize_export_v12_record(_collection, item.value, CURRENT_DATE)
        ORDER BY item.value ->> 'id'
      ), '[]'::jsonb) INTO _records
      FROM jsonb_array_elements(_records) AS item(value);
    END IF;
    _data := _data || jsonb_build_object(_collection, _records);
    _counts := _counts || jsonb_build_object(_collection, jsonb_array_length(_records));
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export', 'schema_version', 12,
    'created_at', clock_timestamp(),
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections), 'counts', _counts, 'checksums', _checksums
    ),
    'data', _data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v12() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v12() TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.normalize_export_v10_validation_json(
  _value jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _normalized jsonb;
  _start_date date;
  _deadline date;
BEGIN
  IF _value IS NULL OR _value = 'null'::jsonb THEN
    RETURN _value;
  END IF;
  IF jsonb_typeof(_value) = 'array' THEN
    SELECT COALESCE(jsonb_agg(
      tasks_private.normalize_export_v10_validation_json(item.value)
      ORDER BY item.ordinal
    ), '[]'::jsonb)
    INTO _normalized
    FROM jsonb_array_elements(_value) WITH ORDINALITY AS item(value, ordinal);
    RETURN _normalized;
  END IF;
  IF jsonb_typeof(_value) <> 'object' THEN
    RETURN _value;
  END IF;

  SELECT COALESCE(jsonb_object_agg(
    item.key,
    tasks_private.normalize_export_v10_validation_json(item.value)
  ), '{}'::jsonb)
  INTO _normalized
  FROM jsonb_each(_value) AS item(key, value);

  IF _normalized ->> 'actionability' = 'rechecking' THEN
    _normalized := jsonb_set(_normalized, '{actionability}', '"actionable"'::jsonb);
  END IF;
  IF _normalized ? 'destination' THEN
    BEGIN
      _start_date := NULLIF(_normalized ->> 'start_date', '')::date;
      _deadline := NULLIF(_normalized ->> 'deadline', '')::date;
    EXCEPTION WHEN OTHERS THEN
      _start_date := NULL;
      _deadline := NULL;
    END;
    IF _start_date IS NOT NULL AND _deadline IS NOT NULL AND _deadline < _start_date THEN
      _normalized := jsonb_set(_normalized, '{deadline}', to_jsonb(_start_date), true);
    END IF;
  END IF;
  RETURN _normalized;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_export_v10_validation_json(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.export_v12_as_v10_for_validation(
  _envelope jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _records jsonb;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
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
  FOREACH _collection IN ARRAY _collections LOOP
    _records := CASE WHEN _collection = 'tasks_headings' THEN '[]'::jsonb
      ELSE tasks_private.normalize_export_v10_validation_json(
        COALESCE(_envelope #> ARRAY['data', _collection], '[]'::jsonb)
      ) END;
    _data := _data || jsonb_build_object(_collection, _records);
    _counts := _counts || jsonb_build_object(_collection, jsonb_array_length(_records));
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;
  RETURN tasks_private.normalize_task_export_planning(jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 10,
    'created_at', _envelope -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections),
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  ), DATE '2000-01-01');
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.export_v12_as_v10_for_validation(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v12(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _records jsonb;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export'
    OR _envelope ->> 'schema_version' IS DISTINCT FROM '12'
    OR _envelope #> '{manifest,collections}' IS DISTINCT FROM to_jsonb(_collections)
    OR _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256' THEN
    RAISE EXCEPTION 'Task export v12 manifest is invalid' USING ERRCODE = '22023';
  END IF;
  FOREACH _collection IN ARRAY _collections LOOP
    _records := _envelope #> ARRAY['data', _collection];
    IF jsonb_typeof(_records) IS DISTINCT FROM 'array'
      OR (_envelope #>> ARRAY['manifest', 'counts', _collection])::integer
        <> jsonb_array_length(_records)
      OR _envelope #>> ARRAY['manifest', 'checksums', _collection]
        IS DISTINCT FROM tasks_private.export_checksum(_records) THEN
      RAISE EXCEPTION 'Task export v12 collection % is invalid', _collection
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS item(value)
    WHERE item.value ? 'heading_id'
      OR (item.value ->> 'actionability') NOT IN ('actionable', 'waiting', 'rechecking')
      OR (
        (item.value ->> 'start_date') IS NULL
        AND (item.value ->> 'today_section') IS NOT NULL
      ) OR (
        (item.value ->> 'start_date') IS NOT NULL
        AND item.value ->> 'today_section' NOT IN ('inbox', 'now', 'next', 'later')
      )
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_projects}') AS item(value)
    WHERE ((item.value ->> 'start_date') IS NULL) <> ((item.value ->> 'today_section') IS NULL)
  ) THEN
    RAISE EXCEPTION 'Task export v12 contains invalid planning data' USING ERRCODE = '22023';
  END IF;
  PERFORM tasks_private.validate_export_v10(
    tasks_private.export_v12_as_v10_for_validation(_envelope)
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v12(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v12(
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
  _collection text;
  _table regclass;
  _collection_report jsonb;
  _record jsonb;
  _report jsonb := jsonb_build_object('schema_version', 12, 'dry_run', _dry_run);
  _conflicts bigint := 0;
  _inserts bigint := 0;
  _collections constant text[] := ARRAY[
    'tasks_user_settings', 'tasks_areas', 'tasks_projects', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
  _insert_order constant text[] := ARRAY[
    'tasks_user_settings', 'tasks_areas', 'tasks_templates',
    'tasks_template_revisions', 'tasks_template_instantiations',
    'tasks_recurrence_definitions', 'tasks_recurrence_revisions',
    'tasks_projects', 'tasks_todos', 'tasks_checklist_items',
    'tasks_recurrence_occurrences', 'tasks_recurrence_evaluations',
    'tasks_recurrence_status_events', 'tasks_history_events',
    'tasks_hierarchy_operations', 'tasks_hierarchy_history_events',
    'tasks_mail_sources', 'tasks_mail_source_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data' USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v12(_envelope);
  FOREACH _collection IN ARRAY _collections LOOP
    _table := ('public.' || _collection)::regclass;
    IF _collection = 'tasks_mail_sources' THEN
      _collection_report := tasks_private.classify_restore_v5_mail_sources(
        _owner_id, _envelope #> ARRAY['data', _collection]
      );
    ELSE
      _collection_report := tasks_private.classify_restore_v4_collection(
        _owner_id, _table, _envelope #> ARRAY['data', _collection],
        _collection <> 'tasks_hierarchy_operations'
      );
    END IF;
    _report := _report || jsonb_build_object(_collection, _collection_report);
    _conflicts := _conflicts + (_collection_report ->> 'conflicts')::bigint;
    _inserts := _inserts + (_collection_report ->> 'inserts')::bigint;
  END LOOP;
  IF NOT _dry_run AND _conflicts = 0 AND _inserts > 0 THEN
    SET CONSTRAINTS ALL DEFERRED;
    INSERT INTO tasks_private.restore_contexts (backend_pid, transaction_id, owner_id)
    VALUES (pg_backend_pid(), txid_current(), _owner_id);

    FOREACH _collection IN ARRAY _insert_order LOOP
      _table := ('public.' || _collection)::regclass;
      IF _collection = 'tasks_mail_sources' THEN
        FOR _record IN SELECT value
          FROM jsonb_array_elements(_envelope #> ARRAY['data', _collection])
        LOOP
          IF _report -> _collection -> 'insert_ids'
            @> jsonb_build_array(_record -> 'task_id') THEN
            INSERT INTO public.tasks_mail_sources
            SELECT (jsonb_populate_record(
              NULL::public.tasks_mail_sources,
              (_record - 'owner_id') || jsonb_build_object('owner_id', _owner_id)
            )).*;
          END IF;
        END LOOP;
      ELSE
        PERFORM tasks_private.insert_restore_v4_collection(
          _owner_id, _table, _envelope #> ARRAY['data', _collection],
          _report -> _collection
        );
      END IF;
    END LOOP;

    DELETE FROM tasks_private.restore_contexts
    WHERE backend_pid = pg_backend_pid()
      AND transaction_id = txid_current()
      AND owner_id = _owner_id;

    _report := _report || jsonb_build_object('applied', true, 'code', NULL);
  ELSIF NOT _dry_run AND _conflicts = 0 THEN
    _report := _report || jsonb_build_object(
      'applied', false,
      'code', 'already_applied'
    );
  ELSE
    _report := _report || jsonb_build_object(
      'applied', false,
      'code', CASE WHEN _conflicts > 0 THEN 'restore_conflict' ELSE NULL END
    );
  END IF;
  RETURN _report;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v12(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v12(jsonb, boolean)
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
  _upgraded jsonb;
BEGIN
  _upgraded := tasks_private.upgrade_export_to_v12(_envelope);
  RETURN public.tasks_restore_export_v12(_upgraded, _dry_run);
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_current(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_current(jsonb, boolean)
TO authenticated;

CREATE OR REPLACE FUNCTION tasks_private.lock_replace_restore_scope()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  LOCK TABLE
    public.tasks_areas, public.tasks_projects, public.tasks_todos,
    public.tasks_checklist_items, public.tasks_history_events,
    public.tasks_hierarchy_operations, public.tasks_hierarchy_history_events,
    public.tasks_user_settings, public.tasks_mail_sources,
    public.tasks_mail_source_events, public.tasks_templates,
    public.tasks_template_revisions, public.tasks_template_instantiations,
    public.tasks_recurrence_definitions, public.tasks_recurrence_revisions,
    public.tasks_recurrence_occurrences, public.tasks_recurrence_evaluations,
    public.tasks_recurrence_status_events, public.tasks_reminders,
    public.tasks_reminder_occurrences, public.tasks_reminder_deliveries,
    public.tasks_reminder_claims, tasks_private.permanent_deletion_receipts,
    tasks_private.replace_restore_receipts
  IN SHARE ROW EXCLUSIVE MODE;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.lock_replace_restore_scope()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_prepare_replace_restore_v12(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _backup jsonb;
  _preview jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to prepare task replacement'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v12(_envelope);
  _backup := public.tasks_create_export_v12();
  _preview := public.tasks_restore_export_v12(_envelope, true);
  RETURN jsonb_build_object(
    'schema_version', 12,
    'backup', _backup,
    'backup_digest', tasks_private.export_v10_digest(_backup),
    'current_counts', _backup #> '{manifest,counts}',
    'incoming_counts', _envelope #> '{manifest,counts}',
    'restore_preview', _preview
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_prepare_replace_restore_v12(jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_prepare_replace_restore_v12(jsonb)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_replace_restore_v12(
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
  _owner_id uuid := auth.uid();
  _target_digest text;
  _request_digest text;
  _receipt tasks_private.replace_restore_receipts;
  _backup jsonb;
  _backup_digest text;
  _restore_report jsonb;
  _result jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to replace task data' USING ERRCODE = '42501';
  END IF;
  IF _confirmation IS DISTINCT FROM 'REPLACE TASK DATA' THEN
    RAISE EXCEPTION 'Task replacement requires explicit confirmation' USING ERRCODE = '22023';
  END IF;
  IF _expected_backup_digest IS NULL OR _expected_backup_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'The pre-restore backup digest is invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM tasks_private.validate_export_v12(_envelope);
  _target_digest := tasks_private.export_v10_digest(_envelope);
  _request_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'backup_digest', _expected_backup_digest,
    'target_digest', _target_digest
  )::text, 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO _receipt
  FROM tasks_private.replace_restore_receipts AS receipt
  WHERE receipt.request_id = _request_id AND receipt.owner_id = _owner_id;
  IF FOUND THEN
    IF _receipt.request_digest IS DISTINCT FROM _request_digest THEN
      RAISE EXCEPTION 'Task replacement request identifier was reused with different input'
        USING ERRCODE = '22023';
    END IF;
    RETURN _receipt.result;
  END IF;

  PERFORM tasks_private.lock_replace_restore_scope();
  PERFORM pg_advisory_xact_lock(hashtextextended('tasks-replace-restore:' || _owner_id::text, 0));
  _backup := public.tasks_create_export_v12();
  _backup_digest := tasks_private.export_v10_digest(_backup);
  IF _backup_digest IS DISTINCT FROM _expected_backup_digest THEN
    RAISE EXCEPTION 'The pre-restore backup is stale' USING ERRCODE = '40001';
  END IF;

  SET CONSTRAINTS ALL DEFERRED;
  DELETE FROM public.tasks_reminder_deliveries WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminder_claims WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminder_occurrences WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminders WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_status_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_evaluations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_occurrences WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_revisions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_definitions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_template_instantiations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_template_revisions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_templates WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_mail_source_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_mail_sources WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_history_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_hierarchy_history_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_hierarchy_operations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_checklist_items WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_todos WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_projects WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_areas WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_user_settings WHERE owner_id = _owner_id;
  DELETE FROM tasks_private.permanent_deletion_receipts WHERE owner_id = _owner_id;
  DELETE FROM tasks_private.purged_creation_receipts WHERE owner_id = _owner_id;

  _restore_report := public.tasks_restore_export_v12(_envelope, false);
  IF COALESCE((_restore_report ->> 'applied')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Task replacement restore was rejected'
      USING ERRCODE = '40001', DETAIL = _restore_report::text;
  END IF;
  _result := jsonb_build_object(
    'outcome', 'accepted', 'schema_version', 12, 'request_id', _request_id,
    'backup_digest', _expected_backup_digest, 'target_digest', _target_digest,
    'removed_counts', _backup #> '{manifest,counts}',
    'restore_report', _restore_report
  );
  INSERT INTO tasks_private.replace_restore_receipts (
    request_id, owner_id, request_digest, result
  ) VALUES (_request_id, _owner_id, _request_digest, _result);
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_replace_restore_v12(jsonb, text, uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_replace_restore_v12(jsonb, text, uuid, text)
TO authenticated;

-- Keep every ordinary capture path on the same active Next default and remove
-- the retired heading column from Mail capture and todo history.
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

  PERFORM pg_advisory_xact_lock(hashtextextended(
    _owner_id::text || E'\x1f' || btrim(_account_identifier)
      || E'\x1f' || btrim(_message_identifier), 0
  ));

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
      OR _task.today_section IS DISTINCT FROM 'next'
      OR _task.start_date IS DISTINCT FROM _start_date
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
        id, owner_id, area_id, project_id, title, notes,
        lifecycle, completed_at, canceled_at, disposition, deleted_at,
        deletion_root_id, destination, today_section, order_key,
        hierarchy_order_key, start_date, deadline, entry_channel,
        last_mutation_channel, last_actor_type, undo_source_event_id,
        source_kind, source_url, source_title, source_external_id,
        revision, client_mutation_id, created_at, updated_at
      ) VALUES (
        _task_id, _owner_id, _area_id, NULL, btrim(_title), COALESCE(_notes, ''),
        'open', NULL, NULL, 'present', NULL,
        NULL, 'anytime', 'next', _order_key,
        _hierarchy_order_key, _start_date, NULL, 'mail_automation',
        'mail_automation', 'automation', NULL,
        'mail_message', _deep_link, NULLIF(btrim(_source_title), ''),
        btrim(_message_identifier), 1, _idempotency_key, _timestamp, _timestamp
      ) RETURNING * INTO _task;

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
      ) RETURNING * INTO _source;
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

CREATE OR REPLACE FUNCTION tasks_private.append_todo_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _base_revision bigint;
  _before_state jsonb;
  _after_state jsonb;
  _transition text;
  _history_source public.tasks_history_events;
  _source_before jsonb;
  _source_after jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM tasks_private.restore_contexts AS context
    WHERE context.backend_pid = pg_backend_pid()
      AND context.transaction_id = txid_current()
      AND context.owner_id = NEW.owner_id
  ) THEN
    RETURN NEW;
  END IF;
  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Task history owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  _after_state := tasks_private.todo_snapshot_v7(NEW);
  IF TG_OP = 'INSERT' THEN
    IF NEW.undo_source_event_id IS NOT NULL THEN
      RAISE EXCEPTION 'A new task cannot be an undo or redo mutation'
        USING ERRCODE = '23514';
    END IF;
    _base_revision := 0;
    _before_state := NULL;
    _transition := 'create';
  ELSE
    _base_revision := OLD.revision;
    _before_state := tasks_private.todo_snapshot_v7(OLD);
    IF NEW.undo_source_event_id IS NOT NULL THEN
      SELECT event.* INTO _history_source
      FROM public.tasks_history_events AS event
      WHERE event.id = NEW.undo_source_event_id
        AND event.owner_id = NEW.owner_id
        AND event.task_id = NEW.id;
      _source_before := tasks_private.normalize_todo_snapshot_v7(_history_source.before_state);
      _source_after := tasks_private.normalize_todo_snapshot_v7(_history_source.after_state);
      IF NOT FOUND
        OR _history_source.transition IN ('baseline', 'create', 'undo', 'redo')
        OR _source_before IS NULL THEN
        RAISE EXCEPTION 'The requested task history traversal is no longer safe'
          USING ERRCODE = '23514';
      ELSIF _before_state IS NOT DISTINCT FROM _source_after
        AND _after_state IS NOT DISTINCT FROM _source_before THEN
        _transition := 'undo';
      ELSIF _before_state IS NOT DISTINCT FROM _source_before
        AND _after_state IS NOT DISTINCT FROM _source_after THEN
        _transition := 'redo';
      ELSE
        RAISE EXCEPTION 'The requested task history traversal is no longer safe'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.lifecycle IS DISTINCT FROM OLD.lifecycle THEN
      _transition := CASE NEW.lifecycle
        WHEN 'completed' THEN 'complete'
        WHEN 'canceled' THEN 'cancel'
        ELSE 'reopen'
      END;
    ELSIF NEW.disposition IS DISTINCT FROM OLD.disposition THEN
      _transition := CASE NEW.disposition WHEN 'deleted' THEN 'delete' ELSE 'restore' END;
    ELSIF NEW.actionability IS DISTINCT FROM OLD.actionability THEN
      _transition := 'set_actionability';
    ELSIF NEW.destination IS DISTINCT FROM OLD.destination
      OR NEW.today_section IS DISTINCT FROM OLD.today_section
      OR NEW.area_id IS DISTINCT FROM OLD.area_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      _transition := 'move';
    ELSIF NEW.order_key IS DISTINCT FROM OLD.order_key
      OR NEW.hierarchy_order_key IS DISTINCT FROM OLD.hierarchy_order_key THEN
      _transition := 'reorder';
    ELSE
      _transition := 'update';
    END IF;
  END IF;

  INSERT INTO public.tasks_history_events (
    owner_id, task_id, client_mutation_id, actor_type, mutation_channel,
    affected_ids, base_revision, result_revision, transition, occurred_at,
    outcome, code, before_state, after_state
  ) VALUES (
    NEW.owner_id, NEW.id, NEW.client_mutation_id, NEW.last_actor_type,
    NEW.last_mutation_channel, ARRAY[NEW.id], _base_revision, NEW.revision,
    _transition, NEW.updated_at, 'accepted', NULL, _before_state, _after_state
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.append_todo_history()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot_v7(_task public.tasks_todos)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'title', _task.title,
    'notes', _task.notes,
    'lifecycle', _task.lifecycle,
    'completed_at', _task.completed_at,
    'canceled_at', _task.canceled_at,
    'disposition', _task.disposition,
    'deleted_at', _task.deleted_at,
    'deletion_root_id', _task.deletion_root_id,
    'destination', _task.destination,
    'today_section', _task.today_section,
    'order_key', _task.order_key,
    'area_id', _task.area_id,
    'project_id', _task.project_id,
    'hierarchy_order_key', _task.hierarchy_order_key,
    'start_date', _task.start_date,
    'deadline', _task.deadline,
    'source_kind', _task.source_kind,
    'source_url', _task.source_url,
    'source_title', _task.source_title,
    'source_external_id', _task.source_external_id,
    'actionability', _task.actionability
  );
$$;

CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_snapshot_v7(_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _destination text;
  _start_date text;
  _today_section text;
BEGIN
  IF _snapshot IS NULL OR _snapshot = 'null'::jsonb THEN
    RETURN NULL;
  END IF;
  _destination := CASE
    WHEN _snapshot ->> 'destination' IN ('inbox', 'today') THEN 'anytime'
    ELSE COALESCE(_snapshot ->> 'destination', 'anytime')
  END;
  _start_date := _snapshot ->> 'start_date';
  IF _destination = 'someday' THEN
    _start_date := NULL;
    _today_section := NULL;
  ELSIF _start_date IS NULL THEN
    _today_section := NULL;
  ELSE
    _today_section := CASE _snapshot ->> 'today_section'
      WHEN 'inbox' THEN 'inbox'
      WHEN 'now' THEN 'now'
      WHEN 'next' THEN 'next'
      WHEN 'later' THEN 'later'
      WHEN 'evening' THEN 'later'
      ELSE 'next'
    END;
  END IF;
  RETURN jsonb_build_object(
    'title', _snapshot -> 'title',
    'notes', COALESCE(_snapshot -> 'notes', '""'::jsonb),
    'lifecycle', COALESCE(_snapshot -> 'lifecycle', '"open"'::jsonb),
    'completed_at', _snapshot -> 'completed_at',
    'canceled_at', _snapshot -> 'canceled_at',
    'disposition', COALESCE(_snapshot -> 'disposition', '"present"'::jsonb),
    'deleted_at', _snapshot -> 'deleted_at',
    'deletion_root_id', _snapshot -> 'deletion_root_id',
    'destination', to_jsonb(_destination),
    'today_section', to_jsonb(_today_section),
    'order_key', _snapshot -> 'order_key',
    'area_id', _snapshot -> 'area_id',
    'project_id', _snapshot -> 'project_id',
    'hierarchy_order_key', _snapshot -> 'hierarchy_order_key',
    'start_date', to_jsonb(_start_date),
    'deadline', _snapshot -> 'deadline',
    'source_kind', COALESCE(_snapshot -> 'source_kind', '"manual"'::jsonb),
    'source_url', _snapshot -> 'source_url',
    'source_title', _snapshot -> 'source_title',
    'source_external_id', _snapshot -> 'source_external_id',
    'actionability', to_jsonb(COALESCE(_snapshot ->> 'actionability', 'actionable'))
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_snapshot_v7(public.tasks_todos),
  tasks_private.normalize_todo_snapshot_v7(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.normalize_history_event_v4(_event jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_set(
    jsonb_set(
      _event,
      '{before_state}',
      COALESCE(
        tasks_private.normalize_todo_snapshot_v7(_event -> 'before_state'),
        'null'::jsonb
      )
    ),
    '{after_state}',
    tasks_private.normalize_todo_snapshot_v7(_event -> 'after_state')
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_history_event_v4(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.hierarchy_operation_candidates(
  _owner_id uuid,
  _root_type text,
  _root_id uuid,
  _operation text,
  _descendant_policy text
)
RETURNS TABLE(entity_type text, entity_id uuid, revision bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF _operation IN ('complete_project', 'cancel_project', 'reopen_project') THEN
    RETURN QUERY
    SELECT 'project'::text, project.id, project.revision
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id
      AND project.id = _root_id
      AND project.disposition = 'present';
    IF _descendant_policy = 'cascade'
      AND _operation IN ('complete_project', 'cancel_project') THEN
      RETURN QUERY
      SELECT 'todo'::text, task.id, task.revision
      FROM public.tasks_todos AS task
      WHERE task.owner_id = _owner_id
        AND task.project_id = _root_id
        AND task.disposition = 'present'
        AND task.lifecycle = 'open';
    END IF;
    RETURN;
  END IF;

  IF _operation = 'restore' THEN
    RETURN QUERY
    SELECT 'area'::text, area.id, area.revision
    FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id AND area.deletion_root_id = _root_id
    UNION ALL
    SELECT 'project', project.id, project.revision
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id AND project.deletion_root_id = _root_id
    UNION ALL
    SELECT 'todo', task.id, task.revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id AND task.deletion_root_id = _root_id
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id AND item.deletion_root_id = _root_id;
    RETURN;
  END IF;

  IF _root_type = 'area' THEN
    RETURN QUERY
    SELECT 'area'::text, area.id, area.revision
    FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id AND area.id = _root_id AND area.disposition = 'present'
    UNION ALL
    SELECT 'project', project.id, project.revision
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id AND project.area_id = _root_id
      AND project.disposition = 'present'
    UNION ALL
    SELECT 'todo', task.id, task.revision
    FROM public.tasks_todos AS task
    LEFT JOIN public.tasks_projects AS project
      ON project.id = task.project_id AND project.owner_id = task.owner_id
    WHERE task.owner_id = _owner_id
      AND (task.area_id = _root_id OR project.area_id = _root_id)
      AND task.disposition = 'present'
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    JOIN public.tasks_todos AS task
      ON task.id = item.task_id AND task.owner_id = item.owner_id
    LEFT JOIN public.tasks_projects AS project
      ON project.id = task.project_id AND project.owner_id = task.owner_id
    WHERE item.owner_id = _owner_id
      AND (task.area_id = _root_id OR project.area_id = _root_id)
      AND task.disposition = 'present'
      AND item.disposition = 'present';
  ELSIF _root_type = 'project' THEN
    RETURN QUERY
    SELECT 'project'::text, project.id, project.revision
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id AND project.id = _root_id
      AND project.disposition = 'present'
    UNION ALL
    SELECT 'todo', task.id, task.revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id AND task.project_id = _root_id
      AND task.disposition = 'present'
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    JOIN public.tasks_todos AS task
      ON task.id = item.task_id AND task.owner_id = item.owner_id
    WHERE item.owner_id = _owner_id AND task.project_id = _root_id
      AND task.disposition = 'present'
      AND item.disposition = 'present';
  ELSIF _root_type = 'todo' THEN
    RETURN QUERY
    SELECT 'todo'::text, task.id, task.revision
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id AND task.id = _root_id
      AND task.disposition = 'present'
    UNION ALL
    SELECT 'checklist_item', item.id, item.revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id AND item.task_id = _root_id
      AND item.disposition = 'present';
  ELSE
    RETURN QUERY
    SELECT 'checklist_item'::text, item.id, item.revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id AND item.id = _root_id
      AND item.disposition = 'present';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.hierarchy_operation_candidates(uuid, text, uuid, text, text)
FROM PUBLIC, anon, authenticated;

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
  _root_found := NEW.root_id::text = ANY(ARRAY(SELECT jsonb_object_keys(_current_revisions)));
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
    WHERE task.owner_id = NEW.owner_id AND task.project_id = NEW.root_id
      AND task.disposition = 'present' AND task.lifecycle = 'open';
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
  IF NEW.operation = 'restore' AND NEW.root_type = 'checklist_item' AND NOT EXISTS (
    SELECT 1 FROM public.tasks_checklist_items AS item
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
      revision = project.revision + 1, client_mutation_id = gen_random_uuid(),
      last_mutation_channel = NEW.mutation_channel,
      last_actor_type = NEW.actor_type
    WHERE project.owner_id = NEW.owner_id AND project.id = NEW.root_id;
    IF NEW.descendant_policy = 'cascade'
      AND NEW.operation IN ('complete_project', 'cancel_project') THEN
      UPDATE public.tasks_todos AS task
      SET lifecycle = _target_lifecycle,
        completed_at = CASE WHEN _target_lifecycle = 'completed' THEN NEW.requested_at ELSE NULL END,
        canceled_at = CASE WHEN _target_lifecycle = 'canceled' THEN NEW.requested_at ELSE NULL END,
        revision = task.revision + 1, client_mutation_id = gen_random_uuid(),
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

CREATE OR REPLACE FUNCTION public.tasks_request_mcp_hierarchy_operation(
  _request_id uuid,
  _root_type text,
  _root_id uuid,
  _expected_revision bigint,
  _operation text,
  _descendant_policy text DEFAULT 'reject'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := (SELECT auth.uid());
  _existing public.tasks_hierarchy_operations%ROWTYPE;
  _receipt public.tasks_hierarchy_operations%ROWTYPE;
  _root_revision bigint;
  _root_lifecycle text;
  _existing_expected_revision bigint;
  _expected_revisions jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL OR _root_id IS NULL OR _expected_revision IS NULL
    OR _expected_revision < 1 THEN
    RAISE EXCEPTION 'A request ID, root ID, and positive expected revision are required';
  END IF;
  IF _root_type IS NULL
    OR _root_type NOT IN ('area', 'project', 'checklist_item') THEN
    RAISE EXCEPTION 'Unsupported task hierarchy root type';
  END IF;
  IF _operation IS NULL OR _operation NOT IN (
    'complete_project', 'cancel_project', 'reopen_project', 'delete', 'restore'
  ) THEN
    RAISE EXCEPTION 'Unsupported task hierarchy operation';
  END IF;
  IF _operation IN ('complete_project', 'cancel_project', 'reopen_project')
    AND _root_type <> 'project' THEN
    RAISE EXCEPTION 'Project lifecycle operations require a project root';
  END IF;
  IF _descendant_policy IS NULL THEN
    RAISE EXCEPTION 'A hierarchy descendant policy is required';
  END IF;
  IF _operation IN ('complete_project', 'cancel_project')
    AND _descendant_policy NOT IN ('reject', 'cascade') THEN
    RAISE EXCEPTION 'Unsupported project descendant policy';
  END IF;
  IF _operation = 'reopen_project' AND _descendant_policy <> 'reject' THEN
    RAISE EXCEPTION 'Reopening a project does not accept a cascade policy';
  END IF;
  IF _operation IN ('delete', 'restore') AND _descendant_policy <> 'cascade' THEN
    RAISE EXCEPTION 'Hierarchy deletion and restoration require the cascade policy';
  END IF;

  SELECT operation.* INTO _existing
  FROM public.tasks_hierarchy_operations AS operation
  WHERE operation.id = _request_id;
  IF FOUND THEN
    IF _existing.owner_id IS DISTINCT FROM _owner_id THEN
      RAISE EXCEPTION 'The mutation identifier is unavailable. Use a new UUID for a new request.';
    END IF;
    _existing_expected_revision := CASE
      WHEN jsonb_typeof(_existing.expected_revisions -> _root_id::text) = 'number'
        AND (_existing.expected_revisions ->> _root_id::text) ~ '^[1-9][0-9]*$'
        THEN (_existing.expected_revisions ->> _root_id::text)::bigint
      ELSE NULL
    END;
    IF _existing.root_type IS DISTINCT FROM _root_type
      OR _existing.root_id IS DISTINCT FROM _root_id
      OR _existing.operation IS DISTINCT FROM _operation
      OR _existing.descendant_policy IS DISTINCT FROM _descendant_policy
      OR _existing.actor_type IS DISTINCT FROM 'automation'
      OR _existing.mutation_channel IS DISTINCT FROM 'mcp'
      OR _existing_expected_revision IS DISTINCT FROM _expected_revision THEN
      RAISE EXCEPTION 'The mutation identifier was already used for a different hierarchy operation.';
    END IF;
    RETURN to_jsonb(_existing) - 'owner_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tasks_history_events AS event
    WHERE event.owner_id = _owner_id AND event.client_mutation_id = _request_id
  ) OR EXISTS (
    SELECT 1 FROM public.tasks_hierarchy_history_events AS event
    WHERE event.owner_id = _owner_id AND event.client_mutation_id = _request_id
  ) THEN
    RAISE EXCEPTION 'The mutation identifier is unavailable. Use a new UUID for a new request.';
  END IF;

  IF _root_type = 'area' THEN
    SELECT area.revision INTO _root_revision
    FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id AND area.id = _root_id
      AND ((_operation = 'delete' AND area.disposition = 'present')
        OR (_operation = 'restore' AND area.disposition = 'deleted'
          AND area.deletion_root_id = _root_id));
  ELSIF _root_type = 'project' THEN
    SELECT project.revision, project.lifecycle INTO _root_revision, _root_lifecycle
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id AND project.id = _root_id
      AND ((_operation IN ('complete_project', 'cancel_project', 'reopen_project')
          AND project.disposition = 'present')
        OR (_operation = 'delete' AND project.disposition = 'present')
        OR (_operation = 'restore' AND project.disposition = 'deleted'
          AND project.deletion_root_id = _root_id));
  ELSE
    SELECT item.revision INTO _root_revision
    FROM public.tasks_checklist_items AS item
    WHERE item.owner_id = _owner_id AND item.id = _root_id
      AND ((_operation = 'delete' AND item.disposition = 'present')
        OR (_operation = 'restore' AND item.disposition = 'deleted'
          AND item.deletion_root_id = _root_id));
  END IF;

  IF _root_revision IS NULL THEN
    RAISE EXCEPTION 'The task hierarchy root is unavailable.';
  END IF;
  IF _operation = 'complete_project' AND _root_lifecycle NOT IN ('open', 'completed') THEN
    RAISE EXCEPTION 'Reopen the project before completing it.';
  END IF;
  IF _operation = 'cancel_project' AND _root_lifecycle NOT IN ('open', 'canceled') THEN
    RAISE EXCEPTION 'Reopen the project before canceling it.';
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(candidate.entity_id::text, candidate.revision ORDER BY candidate.entity_id),
    '{}'::jsonb
  ) INTO _expected_revisions
  FROM tasks_private.hierarchy_operation_candidates(
    _owner_id, _root_type, _root_id, _operation, _descendant_policy
  ) AS candidate;
  _expected_revisions := _expected_revisions
    || jsonb_build_object(_root_id::text, _expected_revision);

  BEGIN
    INSERT INTO public.tasks_hierarchy_operations (
      id, owner_id, root_type, root_id, operation, descendant_policy,
      expected_revisions, actor_type, mutation_channel, requested_at
    ) VALUES (
      _request_id, _owner_id, _root_type, _root_id, _operation, _descendant_policy,
      _expected_revisions, 'automation', 'mcp', now()
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT operation.* INTO _existing
    FROM public.tasks_hierarchy_operations AS operation
    WHERE operation.id = _request_id;
    IF NOT FOUND OR _existing.owner_id IS DISTINCT FROM _owner_id THEN
      RAISE EXCEPTION 'The mutation identifier is unavailable. Use a new UUID for a new request.';
    END IF;
    _existing_expected_revision := CASE
      WHEN jsonb_typeof(_existing.expected_revisions -> _root_id::text) = 'number'
        AND (_existing.expected_revisions ->> _root_id::text) ~ '^[1-9][0-9]*$'
        THEN (_existing.expected_revisions ->> _root_id::text)::bigint
      ELSE NULL
    END;
    IF _existing.root_type IS DISTINCT FROM _root_type
      OR _existing.root_id IS DISTINCT FROM _root_id
      OR _existing.operation IS DISTINCT FROM _operation
      OR _existing.descendant_policy IS DISTINCT FROM _descendant_policy
      OR _existing.actor_type IS DISTINCT FROM 'automation'
      OR _existing.mutation_channel IS DISTINCT FROM 'mcp'
      OR _existing_expected_revision IS DISTINCT FROM _expected_revision THEN
      RAISE EXCEPTION 'The mutation identifier was already used for a different hierarchy operation.';
    END IF;
    RETURN to_jsonb(_existing) - 'owner_id';
  END;

  SELECT operation.* INTO STRICT _receipt
  FROM public.tasks_hierarchy_operations AS operation
  WHERE operation.id = _request_id AND operation.owner_id = _owner_id;
  RETURN to_jsonb(_receipt) - 'owner_id';
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_request_mcp_hierarchy_operation(
  uuid, text, uuid, bigint, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_request_mcp_hierarchy_operation(
  uuid, text, uuid, bigint, text, text
) TO authenticated;

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
    WHEN _source_today_section IN ('inbox', 'now', 'next', 'later') THEN _source_today_section
    ELSE NULL
  END;
  _start_date date := CASE WHEN _start_offset_days IS NULL
    THEN NULL ELSE _anchor_date + _start_offset_days END;
  _deadline date := CASE WHEN _deadline_offset_days IS NULL
    THEN NULL ELSE _anchor_date + _deadline_offset_days END;
BEGIN
  PERFORM _planning_date, _allow_inbox;
  IF _destination = 'someday' THEN
    _start_date := NULL;
    _today_section := NULL;
  ELSIF _destination <> 'anytime' THEN
    RAISE EXCEPTION 'Template planning destination is invalid'
      USING ERRCODE = '22023';
  ELSIF _start_date IS NULL THEN
    _today_section := NULL;
  ELSIF _today_section IS NULL THEN
    _today_section := 'next';
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

CREATE OR REPLACE FUNCTION tasks_private.template_snapshot_from_project(
  _owner_id uuid,
  _project_id uuid,
  _anchor_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _project public.tasks_projects;
  _todos jsonb;
BEGIN
  SELECT project.* INTO _project
  FROM public.tasks_projects AS project
  WHERE project.id = _project_id
    AND project.owner_id = _owner_id
    AND project.disposition = 'present';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The template source project is unavailable'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'node_id', task.id,
      'title', task.title,
      'notes', task.notes,
      'actionability', task.actionability,
      'destination', task.destination,
      'today_section', task.today_section,
      'order_key', task.order_key,
      'hierarchy_order_key', COALESCE(task.hierarchy_order_key, task.order_key),
      'start_offset_days', CASE WHEN task.start_date IS NULL
        THEN NULL ELSE task.start_date - _anchor_date END,
      'deadline_offset_days', CASE WHEN task.deadline IS NULL
        THEN NULL ELSE task.deadline - _anchor_date END,
      'checklist', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'node_id', item.id,
            'title', item.title,
            'order_key', item.order_key
          ) ORDER BY item.order_key, item.id
        ), '[]'::jsonb)
        FROM public.tasks_checklist_items AS item
        WHERE item.owner_id = _owner_id
          AND item.task_id = task.id
          AND item.disposition = 'present'
      )
    ) ORDER BY COALESCE(task.hierarchy_order_key, task.order_key), task.id
  ), '[]'::jsonb) INTO _todos
  FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id
    AND task.project_id = _project_id
    AND task.disposition = 'present'
    AND task.lifecycle = 'open';

  RETURN jsonb_build_object(
    'version', 1,
    'kind', 'project',
    'root', jsonb_build_object(
      'node_id', _project.id,
      'title', _project.title,
      'notes', _project.notes,
      'destination', _project.destination,
      'today_section', _project.today_section,
      'order_key', _project.order_key,
      'planning_order_key', _project.planning_order_key,
      'start_offset_days', CASE WHEN _project.start_date IS NULL
        THEN NULL ELSE _project.start_date - _anchor_date END,
      'deadline_offset_days', CASE WHEN _project.deadline IS NULL
        THEN NULL ELSE _project.deadline - _anchor_date END
    ),
    'todos', _todos
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.template_snapshot_from_project(uuid, uuid, date)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_instantiate_template(
  _template_id uuid,
  _template_revision bigint,
  _anchor_date date,
  _request_id uuid,
  _entry_channel text DEFAULT 'web',
  _actor_type text DEFAULT 'user',
  _target_area_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _template public.tasks_templates;
  _revision_record public.tasks_template_revisions;
  _existing public.tasks_template_instantiations;
  _instantiation public.tasks_template_instantiations;
  _planning_timezone text;
  _planning_date date;
  _selected_revision bigint;
  _root jsonb;
  _node jsonb;
  _child jsonb;
  _planning jsonb;
  _root_id uuid := gen_random_uuid();
  _task_map jsonb := '{}'::jsonb;
  _checklist_map jsonb := '{}'::jsonb;
  _task_ids jsonb := '[]'::jsonb;
  _checklist_ids jsonb := '[]'::jsonb;
  _generated_id uuid;
  _project_id uuid;
  _task_id uuid;
  _result jsonb;
  _timestamp timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to instantiate templates'
      USING ERRCODE = '42501';
  END IF;
  IF _template_id IS NULL OR _anchor_date IS NULL OR _request_id IS NULL
    OR _entry_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    )
    OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
    RAISE EXCEPTION 'Template instantiation input is invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _request_id::text, 0)
  );
  SELECT instance.* INTO _existing
  FROM public.tasks_template_instantiations AS instance
  WHERE instance.owner_id = _owner_id
    AND instance.client_mutation_id = _request_id;
  IF FOUND THEN
    IF _existing.template_id IS DISTINCT FROM _template_id
      OR (_template_revision IS NOT NULL
        AND _existing.template_revision IS DISTINCT FROM _template_revision)
      OR _existing.anchor_date IS DISTINCT FROM _anchor_date
      OR _existing.entry_channel IS DISTINCT FROM _entry_channel
      OR _existing.actor_type IS DISTINCT FROM _actor_type
      OR _existing.target_area_id IS DISTINCT FROM _target_area_id THEN
      RAISE EXCEPTION 'The request identifier belongs to a different template instance'
        USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'instantiation', to_jsonb(_existing) - 'owner_id',
      'result', _existing.result
    );
  END IF;

  SELECT template.* INTO _template
  FROM public.tasks_templates AS template
  WHERE template.id = _template_id AND template.owner_id = _owner_id
  FOR SHARE;
  IF NOT FOUND OR _template.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'The template is unavailable' USING ERRCODE = '22023';
  END IF;
  _selected_revision := COALESCE(_template_revision, _template.current_revision);
  SELECT revision.* INTO _revision_record
  FROM public.tasks_template_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.template_id = _template_id
    AND revision.revision = _selected_revision;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The requested template revision is unavailable'
      USING ERRCODE = '22023';
  END IF;
  IF _target_area_id IS NOT NULL THEN
    IF _template.kind <> 'project' OR NOT EXISTS (
      SELECT 1 FROM public.tasks_areas AS area
      WHERE area.id = _target_area_id
        AND area.owner_id = _owner_id
        AND area.disposition = 'present'
    ) THEN
      RAISE EXCEPTION 'The target area is unavailable for this template'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT setting.planning_timezone INTO _planning_timezone
  FROM public.tasks_user_settings AS setting
  WHERE setting.owner_id = _owner_id;
  IF _planning_timezone IS NULL THEN
    RAISE EXCEPTION 'Task planning settings must be initialized before instantiation'
      USING ERRCODE = '22023';
  END IF;
  _planning_date := (now() AT TIME ZONE _planning_timezone)::date;
  _root := _revision_record.snapshot -> 'root';

  IF _template.kind = 'project' THEN
    _project_id := _root_id;
    FOR _node IN SELECT value
      FROM jsonb_array_elements(COALESCE(_revision_record.snapshot -> 'todos', '[]'::jsonb))
    LOOP
      _generated_id := gen_random_uuid();
      _task_map := _task_map || jsonb_build_object(_node ->> 'node_id', _generated_id);
      _task_ids := _task_ids || jsonb_build_array(_generated_id);
      FOR _child IN SELECT value
        FROM jsonb_array_elements(COALESCE(_node -> 'checklist', '[]'::jsonb))
      LOOP
        _generated_id := gen_random_uuid();
        _checklist_map := _checklist_map || jsonb_build_object(
          _child ->> 'node_id', _generated_id
        );
        _checklist_ids := _checklist_ids || jsonb_build_array(_generated_id);
      END LOOP;
    END LOOP;
    _result := jsonb_build_object(
      'root_type', 'project',
      'root_id', _project_id,
      'project_id', _project_id,
      'task_ids', _task_ids,
      'checklist_item_ids', _checklist_ids
    );
  ELSE
    _task_id := _root_id;
    _task_ids := jsonb_build_array(_task_id);
    FOR _child IN SELECT value
      FROM jsonb_array_elements(COALESCE(_root -> 'checklist', '[]'::jsonb))
    LOOP
      _generated_id := gen_random_uuid();
      _checklist_map := _checklist_map || jsonb_build_object(
        _child ->> 'node_id', _generated_id
      );
      _checklist_ids := _checklist_ids || jsonb_build_array(_generated_id);
    END LOOP;
    _result := jsonb_build_object(
      'root_type', 'todo',
      'root_id', _task_id,
      'project_id', NULL,
      'task_ids', _task_ids,
      'checklist_item_ids', _checklist_ids
    );
  END IF;

  INSERT INTO public.tasks_template_instantiations (
    owner_id, template_id, template_revision, anchor_date, entry_channel,
    actor_type, target_area_id, root_type, root_id, result,
    client_mutation_id, created_at
  ) VALUES (
    _owner_id, _template.id, _selected_revision, _anchor_date, _entry_channel,
    _actor_type, _target_area_id, _template.kind, _root_id, _result,
    _request_id, _timestamp
  ) RETURNING * INTO _instantiation;

  INSERT INTO tasks_private.template_contexts (backend_pid, transaction_id, owner_id)
  VALUES (pg_backend_pid(), txid_current(), _owner_id);

  IF _template.kind = 'project' THEN
    _planning := tasks_private.resolve_template_planning(
      _root ->> 'destination', _root ->> 'today_section',
      (_root ->> 'start_offset_days')::integer,
      (_root ->> 'deadline_offset_days')::integer,
      _anchor_date, _planning_date, false
    );
    INSERT INTO public.tasks_projects (
      id, owner_id, area_id, title, notes, lifecycle, disposition,
      destination, today_section, order_key, planning_order_key,
      start_date, deadline, entry_channel, last_mutation_channel,
      last_actor_type, revision, client_mutation_id, created_at, updated_at,
      template_definition_id, template_revision,
      template_instantiation_id, template_node_id
    ) VALUES (
      _project_id, _owner_id, _target_area_id, _root ->> 'title',
      COALESCE(_root ->> 'notes', ''), 'open', 'present',
      _planning ->> 'destination', _planning ->> 'today_section',
      _root ->> 'order_key', _root ->> 'planning_order_key',
      (_planning ->> 'start_date')::date, (_planning ->> 'deadline')::date,
      _entry_channel, _entry_channel, _actor_type, 1, gen_random_uuid(),
      _timestamp, _timestamp, _template.id, _selected_revision,
      _instantiation.id, (_root ->> 'node_id')::uuid
    );

    FOR _node IN SELECT value
      FROM jsonb_array_elements(COALESCE(_revision_record.snapshot -> 'todos', '[]'::jsonb))
    LOOP
      _task_id := (_task_map ->> (_node ->> 'node_id'))::uuid;
      _planning := tasks_private.resolve_template_planning(
        _node ->> 'destination', _node ->> 'today_section',
        (_node ->> 'start_offset_days')::integer,
        (_node ->> 'deadline_offset_days')::integer,
        _anchor_date, _planning_date, true
      );
      INSERT INTO public.tasks_todos (
        id, owner_id, project_id, title, notes, lifecycle,
        disposition, destination, today_section, actionability, order_key,
        hierarchy_order_key, start_date, deadline, entry_channel,
        last_mutation_channel, last_actor_type, source_kind, source_title,
        source_external_id, revision, client_mutation_id, created_at, updated_at,
        template_definition_id, template_revision,
        template_instantiation_id, template_node_id
      ) VALUES (
        _task_id, _owner_id, _project_id, _node ->> 'title',
        COALESCE(_node ->> 'notes', ''), 'open', 'present',
        _planning ->> 'destination', _planning ->> 'today_section',
        COALESCE(_node ->> 'actionability', 'actionable'),
        _node ->> 'order_key', _node ->> 'hierarchy_order_key',
        (_planning ->> 'start_date')::date, (_planning ->> 'deadline')::date,
        _entry_channel, _entry_channel, _actor_type, 'template',
        _revision_record.name, _template.id::text, 1, gen_random_uuid(),
        _timestamp, _timestamp, _template.id, _selected_revision,
        _instantiation.id, (_node ->> 'node_id')::uuid
      );
      FOR _child IN SELECT value
        FROM jsonb_array_elements(COALESCE(_node -> 'checklist', '[]'::jsonb))
      LOOP
        INSERT INTO public.tasks_checklist_items (
          id, owner_id, task_id, title, completed, order_key, disposition,
          entry_channel, last_mutation_channel, last_actor_type, revision,
          client_mutation_id, created_at, updated_at, template_definition_id,
          template_revision, template_instantiation_id, template_node_id
        ) VALUES (
          (_checklist_map ->> (_child ->> 'node_id'))::uuid,
          _owner_id, _task_id, _child ->> 'title', false,
          _child ->> 'order_key', 'present', _entry_channel, _entry_channel,
          _actor_type, 1, gen_random_uuid(), _timestamp, _timestamp,
          _template.id, _selected_revision, _instantiation.id,
          (_child ->> 'node_id')::uuid
        );
      END LOOP;
    END LOOP;
  ELSE
    _planning := tasks_private.resolve_template_planning(
      _root ->> 'destination', _root ->> 'today_section',
      (_root ->> 'start_offset_days')::integer,
      (_root ->> 'deadline_offset_days')::integer,
      _anchor_date, _planning_date, true
    );
    INSERT INTO public.tasks_todos (
      id, owner_id, title, notes, lifecycle, disposition, destination,
      today_section, actionability, order_key, start_date, deadline,
      entry_channel, last_mutation_channel, last_actor_type, source_kind,
      source_title, source_external_id, revision, client_mutation_id,
      created_at, updated_at, template_definition_id, template_revision,
      template_instantiation_id, template_node_id
    ) VALUES (
      _task_id, _owner_id, _root ->> 'title', COALESCE(_root ->> 'notes', ''),
      'open', 'present', _planning ->> 'destination',
      _planning ->> 'today_section',
      COALESCE(_root ->> 'actionability', 'actionable'),
      _root ->> 'order_key', (_planning ->> 'start_date')::date,
      (_planning ->> 'deadline')::date, _entry_channel, _entry_channel,
      _actor_type, 'template', _revision_record.name, _template.id::text,
      1, gen_random_uuid(), _timestamp, _timestamp, _template.id,
      _selected_revision, _instantiation.id, (_root ->> 'node_id')::uuid
    );
    FOR _child IN SELECT value
      FROM jsonb_array_elements(COALESCE(_root -> 'checklist', '[]'::jsonb))
    LOOP
      INSERT INTO public.tasks_checklist_items (
        id, owner_id, task_id, title, completed, order_key, disposition,
        entry_channel, last_mutation_channel, last_actor_type, revision,
        client_mutation_id, created_at, updated_at, template_definition_id,
        template_revision, template_instantiation_id, template_node_id
      ) VALUES (
        (_checklist_map ->> (_child ->> 'node_id'))::uuid,
        _owner_id, _task_id, _child ->> 'title', false,
        _child ->> 'order_key', 'present', _entry_channel, _entry_channel,
        _actor_type, 1, gen_random_uuid(), _timestamp, _timestamp,
        _template.id, _selected_revision, _instantiation.id,
        (_child ->> 'node_id')::uuid
      );
    END LOOP;
  END IF;

  DELETE FROM tasks_private.template_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'instantiation', to_jsonb(_instantiation) - 'owner_id',
    'result', _result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_instantiate_template(
  uuid, bigint, date, uuid, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_instantiate_template(
  uuid, bigint, date, uuid, text, text, uuid
) TO authenticated;

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
    _todo_ids := ARRAY[]::uuid[];
    _checklist_ids := ARRAY[]::uuid[];

    IF _candidate.root_type = 'area' THEN
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _area_ids
      FROM public.tasks_areas
      WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
      SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _project_ids
      FROM public.tasks_projects
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
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _todo_ids
        FROM public.tasks_todos
        WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _checklist_ids
        FROM public.tasks_checklist_items
        WHERE owner_id = _candidate.owner_id AND deletion_root_id = _candidate.root_id;
      ELSE
        _project_ids := ARRAY[_candidate.root_id];
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _todo_ids
        FROM public.tasks_todos
        WHERE owner_id = _candidate.owner_id AND project_id = _candidate.root_id;
        SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _checklist_ids
        FROM public.tasks_checklist_items
        WHERE owner_id = _candidate.owner_id AND task_id = ANY(_todo_ids);
      END IF;
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

    IF cardinality(_area_ids) + cardinality(_project_ids)
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

    _entity_ids := _area_ids || _project_ids || _todo_ids || _checklist_ids;
    INSERT INTO tasks_private.purged_creation_receipts (
      owner_id, entity_type, entity_id, client_mutation_id, purged_at
    )
    SELECT receipt.owner_id, receipt.entity_type, receipt.entity_id,
      receipt.client_mutation_id, _now
    FROM (
      SELECT todo_receipt.* FROM (
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
      SELECT hierarchy_receipt.* FROM (
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

CREATE OR REPLACE FUNCTION tasks_private.permanent_deletion_scope(
  _owner_id uuid,
  _root_type text,
  _root_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _root_title text;
  _project_ids uuid[] := ARRAY[]::uuid[];
  _todo_ids uuid[] := ARRAY[]::uuid[];
  _checklist_ids uuid[] := ARRAY[]::uuid[];
  _task_history_ids uuid[] := ARRAY[]::uuid[];
  _hierarchy_history_ids uuid[] := ARRAY[]::uuid[];
  _mail_source_ids uuid[] := ARRAY[]::uuid[];
  _mail_event_ids uuid[] := ARRAY[]::uuid[];
  _reminder_ids uuid[] := ARRAY[]::uuid[];
  _reminder_occurrence_ids uuid[] := ARRAY[]::uuid[];
  _reminder_delivery_ids uuid[] := ARRAY[]::uuid[];
  _operation_ids uuid[] := ARRAY[]::uuid[];
  _template_instantiation_ids uuid[] := ARRAY[]::uuid[];
  _recurrence_occurrence_ids uuid[] := ARRAY[]::uuid[];
  _hierarchy_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _root_type = 'todo' THEN
    SELECT task.title INTO _root_title
    FROM public.tasks_todos AS task
    WHERE task.owner_id = _owner_id AND task.id = _root_id
      AND task.disposition = 'deleted' AND task.deletion_root_id = task.id;
  ELSIF _root_type = 'project' THEN
    SELECT project.title INTO _root_title
    FROM public.tasks_projects AS project
    WHERE project.owner_id = _owner_id AND project.id = _root_id
      AND project.disposition = 'deleted' AND project.deletion_root_id = project.id;
  ELSE
    RAISE EXCEPTION 'Permanent deletion supports deleted to-do and project roots only'
      USING ERRCODE = '22023';
  END IF;
  IF _root_title IS NULL THEN
    RAISE EXCEPTION 'The deleted task root is unavailable' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tasks_areas AS area
    WHERE area.owner_id = _owner_id AND area.deletion_root_id = _root_id
  ) THEN
    RAISE EXCEPTION 'The deletion root contains an unsupported area record'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(project.id ORDER BY project.id), ARRAY[]::uuid[])
  INTO _project_ids FROM public.tasks_projects AS project
  WHERE project.owner_id = _owner_id AND project.deletion_root_id = _root_id;
  SELECT COALESCE(array_agg(task.id ORDER BY task.id), ARRAY[]::uuid[])
  INTO _todo_ids FROM public.tasks_todos AS task
  WHERE task.owner_id = _owner_id AND task.deletion_root_id = _root_id;
  SELECT COALESCE(array_agg(item.id ORDER BY item.id), ARRAY[]::uuid[])
  INTO _checklist_ids FROM public.tasks_checklist_items AS item
  WHERE item.owner_id = _owner_id AND item.deletion_root_id = _root_id;
  _hierarchy_ids := _project_ids || _todo_ids || _checklist_ids;

  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _task_history_ids FROM public.tasks_history_events AS event
  WHERE event.owner_id = _owner_id AND event.task_id = ANY(_todo_ids);
  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _hierarchy_history_ids FROM public.tasks_hierarchy_history_events AS event
  WHERE event.owner_id = _owner_id AND event.entity_id = ANY(_hierarchy_ids);
  SELECT COALESCE(array_agg(source.task_id ORDER BY source.task_id), ARRAY[]::uuid[])
  INTO _mail_source_ids FROM public.tasks_mail_sources AS source
  WHERE source.owner_id = _owner_id AND source.task_id = ANY(_todo_ids);
  SELECT COALESCE(array_agg(event.id ORDER BY event.id), ARRAY[]::uuid[])
  INTO _mail_event_ids FROM public.tasks_mail_source_events AS event
  WHERE event.owner_id = _owner_id AND event.task_id = ANY(_todo_ids);
  SELECT COALESCE(array_agg(reminder.id ORDER BY reminder.id), ARRAY[]::uuid[])
  INTO _reminder_ids FROM public.tasks_reminders AS reminder
  WHERE reminder.owner_id = _owner_id
    AND (reminder.task_id = ANY(_todo_ids) OR reminder.project_id = ANY(_project_ids));
  SELECT COALESCE(array_agg(occurrence.id ORDER BY occurrence.id), ARRAY[]::uuid[])
  INTO _reminder_occurrence_ids FROM public.tasks_reminder_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id AND occurrence.reminder_id = ANY(_reminder_ids);
  SELECT COALESCE(array_agg(delivery.id ORDER BY delivery.id), ARRAY[]::uuid[])
  INTO _reminder_delivery_ids FROM public.tasks_reminder_deliveries AS delivery
  WHERE delivery.owner_id = _owner_id
    AND delivery.occurrence_id = ANY(_reminder_occurrence_ids);
  SELECT COALESCE(array_agg(operation.id ORDER BY operation.id), ARRAY[]::uuid[])
  INTO _operation_ids FROM public.tasks_hierarchy_operations AS operation
  WHERE operation.owner_id = _owner_id
    AND (operation.root_id = ANY(_hierarchy_ids) OR operation.affected_ids && _hierarchy_ids);
  SELECT COALESCE(array_agg(instantiation.id ORDER BY instantiation.id), ARRAY[]::uuid[])
  INTO _template_instantiation_ids
  FROM public.tasks_template_instantiations AS instantiation
  WHERE instantiation.owner_id = _owner_id
    AND ((instantiation.root_type = 'todo' AND instantiation.root_id = ANY(_todo_ids))
      OR (instantiation.root_type = 'project' AND instantiation.root_id = ANY(_project_ids)));
  SELECT COALESCE(array_agg(occurrence.id ORDER BY occurrence.id), ARRAY[]::uuid[])
  INTO _recurrence_occurrence_ids
  FROM public.tasks_recurrence_occurrences AS occurrence
  WHERE occurrence.owner_id = _owner_id
    AND ((occurrence.root_type = 'todo' AND occurrence.root_id = ANY(_todo_ids))
      OR (occurrence.root_type = 'project' AND occurrence.root_id = ANY(_project_ids)));

  RETURN jsonb_build_object(
    'root', jsonb_build_object('type', _root_type, 'id', _root_id, 'title', _root_title),
    'hierarchy', jsonb_build_object(
      'projects', to_jsonb(_project_ids),
      'todos', to_jsonb(_todo_ids),
      'checklist_items', to_jsonb(_checklist_ids)
    ),
    'hierarchy_revisions', jsonb_build_object(
      'projects', COALESCE((SELECT jsonb_agg(
        jsonb_build_object('id', project.id, 'revision', project.revision) ORDER BY project.id
      ) FROM public.tasks_projects AS project
        WHERE project.owner_id = _owner_id AND project.id = ANY(_project_ids)), '[]'::jsonb),
      'todos', COALESCE((SELECT jsonb_agg(
        jsonb_build_object('id', task.id, 'revision', task.revision) ORDER BY task.id
      ) FROM public.tasks_todos AS task
        WHERE task.owner_id = _owner_id AND task.id = ANY(_todo_ids)), '[]'::jsonb),
      'checklist_items', COALESCE((SELECT jsonb_agg(
        jsonb_build_object('id', item.id, 'revision', item.revision) ORDER BY item.id
      ) FROM public.tasks_checklist_items AS item
        WHERE item.owner_id = _owner_id AND item.id = ANY(_checklist_ids)), '[]'::jsonb)
    ),
    'related', jsonb_build_object(
      'task_history_events', to_jsonb(_task_history_ids),
      'hierarchy_history_events', to_jsonb(_hierarchy_history_ids),
      'mail_sources', to_jsonb(_mail_source_ids),
      'mail_source_events', to_jsonb(_mail_event_ids),
      'reminders', to_jsonb(_reminder_ids),
      'reminder_occurrences', to_jsonb(_reminder_occurrence_ids),
      'reminder_deliveries', to_jsonb(_reminder_delivery_ids)
    ),
    'preserved_receipts', jsonb_build_object(
      'hierarchy_operations', to_jsonb(_operation_ids),
      'template_instantiations', to_jsonb(_template_instantiation_ids),
      'recurrence_occurrences', to_jsonb(_recurrence_occurrence_ids)
    ),
    'erased_record_count', cardinality(_hierarchy_ids)
      + cardinality(_task_history_ids) + cardinality(_hierarchy_history_ids)
      + cardinality(_mail_source_ids) + cardinality(_mail_event_ids)
      + cardinality(_reminder_ids) + cardinality(_reminder_occurrence_ids)
      + cardinality(_reminder_delivery_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.permanent_deletion_scope(uuid, text, uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.tasks_permanently_delete_after_confirmation(
  _root_type text,
  _root_id uuid,
  _scope_digest text,
  _request_id uuid,
  _confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _existing tasks_private.permanent_deletion_receipts;
  _scope jsonb;
  _current_digest text;
  _result jsonb;
  _project_ids uuid[];
  _todo_ids uuid[];
  _checklist_ids uuid[];
  _hierarchy_history_ids uuid[];
  _reminder_ids uuid[];
  _reminder_occurrence_ids uuid[];
  _reminder_delivery_ids uuid[];
  _completed_at timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF _confirmation <> 'PERMANENTLY DELETE' THEN
    RAISE EXCEPTION 'Permanent deletion requires explicit confirmation' USING ERRCODE = '22023';
  END IF;
  IF _scope_digest IS NULL OR _scope_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Permanent deletion requires a valid preview digest' USING ERRCODE = '22023';
  END IF;
  SELECT receipt.* INTO _existing
  FROM tasks_private.permanent_deletion_receipts AS receipt
  WHERE receipt.owner_id = _owner_id AND receipt.id = _request_id;
  IF FOUND THEN
    IF _existing.root_type <> _root_type OR _existing.root_id <> _root_id
      OR _existing.scope_digest <> _scope_digest THEN
      RAISE EXCEPTION 'Permanent-deletion request identifier was reused with changed input'
        USING ERRCODE = '22023';
    END IF;
    RETURN _existing.result;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_owner_id::text || ':' || _root_type || ':' || _root_id::text, 0)
  );
  SELECT receipt.* INTO _existing
  FROM tasks_private.permanent_deletion_receipts AS receipt
  WHERE receipt.owner_id = _owner_id AND receipt.id = _request_id;
  IF FOUND THEN
    IF _existing.root_type <> _root_type OR _existing.root_id <> _root_id
      OR _existing.scope_digest <> _scope_digest THEN
      RAISE EXCEPTION 'Permanent-deletion request identifier was reused with changed input'
        USING ERRCODE = '22023';
    END IF;
    RETURN _existing.result;
  END IF;

  LOCK TABLE public.tasks_projects, public.tasks_todos, public.tasks_checklist_items,
    public.tasks_history_events, public.tasks_hierarchy_history_events,
    public.tasks_hierarchy_operations, public.tasks_mail_sources,
    public.tasks_mail_source_events, public.tasks_reminders,
    public.tasks_reminder_occurrences, public.tasks_reminder_deliveries,
    public.tasks_template_instantiations, public.tasks_recurrence_occurrences
  IN SHARE ROW EXCLUSIVE MODE;
  _scope := tasks_private.permanent_deletion_scope(_owner_id, _root_type, _root_id);
  _current_digest := tasks_private.export_checksum(_scope);
  IF _current_digest <> _scope_digest THEN
    RAISE EXCEPTION 'Permanent-deletion preview is stale' USING ERRCODE = '40001';
  END IF;

  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO _project_ids
  FROM jsonb_array_elements_text(_scope #> '{hierarchy,projects}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO _todo_ids
  FROM jsonb_array_elements_text(_scope #> '{hierarchy,todos}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO _checklist_ids
  FROM jsonb_array_elements_text(_scope #> '{hierarchy,checklist_items}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO _hierarchy_history_ids
  FROM jsonb_array_elements_text(_scope #> '{related,hierarchy_history_events}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO _reminder_ids
  FROM jsonb_array_elements_text(_scope #> '{related,reminders}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO _reminder_occurrence_ids
  FROM jsonb_array_elements_text(_scope #> '{related,reminder_occurrences}') AS value;
  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO _reminder_delivery_ids
  FROM jsonb_array_elements_text(_scope #> '{related,reminder_deliveries}') AS value;

  DELETE FROM public.tasks_reminder_deliveries
  WHERE owner_id = _owner_id AND id = ANY(_reminder_delivery_ids);
  DELETE FROM public.tasks_reminder_occurrences
  WHERE owner_id = _owner_id AND id = ANY(_reminder_occurrence_ids);
  DELETE FROM public.tasks_reminders
  WHERE owner_id = _owner_id AND id = ANY(_reminder_ids);
  DELETE FROM public.tasks_hierarchy_history_events
  WHERE owner_id = _owner_id AND id = ANY(_hierarchy_history_ids);
  DELETE FROM public.tasks_checklist_items
  WHERE owner_id = _owner_id AND id = ANY(_checklist_ids);
  DELETE FROM public.tasks_todos
  WHERE owner_id = _owner_id AND id = ANY(_todo_ids);
  DELETE FROM public.tasks_projects
  WHERE owner_id = _owner_id AND id = ANY(_project_ids);

  _result := ((_scope #- ARRAY['root', 'title']::text[]) - 'hierarchy_revisions'::text)
    || jsonb_build_object(
      'outcome', 'accepted', 'request_id', _request_id,
      'scope_digest', _scope_digest, 'completed_at', _completed_at
    );
  INSERT INTO tasks_private.permanent_deletion_receipts (
    owner_id, id, root_type, root_id, scope_digest, result, completed_at
  ) VALUES (
    _owner_id, _request_id, _root_type, _root_id, _scope_digest, _result, _completed_at
  );
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.tasks_permanently_delete_after_confirmation(
  text, uuid, text, uuid, text
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.append_hierarchy_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _entity_type text := CASE TG_TABLE_NAME
    WHEN 'tasks_areas' THEN 'area'
    WHEN 'tasks_projects' THEN 'project'
    WHEN 'tasks_checklist_items' THEN 'checklist_item'
  END;
  _transition text;
  _before_state jsonb;
  _base_revision bigint;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Hierarchy history owner does not match the authenticated user'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    _transition := 'create';
    _before_state := NULL;
    _base_revision := 0;
  ELSE
    _before_state := to_jsonb(OLD) - 'owner_id';
    _base_revision := OLD.revision;
    IF TG_TABLE_NAME = 'tasks_projects'
      AND to_jsonb(NEW) -> 'lifecycle' IS DISTINCT FROM to_jsonb(OLD) -> 'lifecycle' THEN
      _transition := CASE to_jsonb(NEW) ->> 'lifecycle'
        WHEN 'completed' THEN 'complete'
        WHEN 'canceled' THEN 'cancel'
        ELSE 'reopen'
      END;
    ELSIF NEW.disposition IS DISTINCT FROM OLD.disposition THEN
      _transition := CASE NEW.disposition WHEN 'deleted' THEN 'delete' ELSE 'restore' END;
    ELSIF (TG_TABLE_NAME = 'tasks_projects'
        AND to_jsonb(NEW) -> 'area_id' IS DISTINCT FROM to_jsonb(OLD) -> 'area_id')
      OR (TG_TABLE_NAME = 'tasks_checklist_items'
        AND to_jsonb(NEW) -> 'task_id' IS DISTINCT FROM to_jsonb(OLD) -> 'task_id') THEN
      _transition := 'move';
    ELSIF NEW.order_key IS DISTINCT FROM OLD.order_key
      OR (TG_TABLE_NAME = 'tasks_projects'
        AND to_jsonb(NEW) -> 'planning_order_key'
          IS DISTINCT FROM to_jsonb(OLD) -> 'planning_order_key') THEN
      _transition := 'reorder';
    ELSE
      _transition := 'update';
    END IF;
  END IF;
  INSERT INTO public.tasks_hierarchy_history_events (
    owner_id, entity_type, entity_id, client_mutation_id, operation_id,
    actor_type, mutation_channel, affected_ids, base_revision, result_revision,
    transition, occurred_at, before_state, after_state
  ) VALUES (
    NEW.owner_id, _entity_type, NEW.id, NEW.client_mutation_id,
    tasks_private.current_hierarchy_operation_id(NEW.owner_id),
    NEW.last_actor_type, NEW.last_mutation_channel, ARRAY[NEW.id],
    _base_revision, NEW.revision, _transition, NEW.updated_at,
    _before_state, to_jsonb(NEW) - 'owner_id'
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.append_hierarchy_history()
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
    WHEN 'tasks_todos' THEN 'todo'
    WHEN 'tasks_checklist_items' THEN 'checklist_item'
  END;
BEGIN
  IF EXISTS (
    SELECT 1 FROM tasks_private.purged_creation_receipts AS receipt
    WHERE receipt.owner_id = NEW.owner_id
      AND (receipt.client_mutation_id = NEW.client_mutation_id
        OR (receipt.entity_type = _entity_type AND receipt.entity_id = NEW.id))
  ) THEN
    RAISE EXCEPTION 'The creation request refers to content that has expired from Done'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.reject_purged_creation_retry()
FROM PUBLIC, anon, authenticated;

-- Retire historical export and replacement RPCs whose implementations refer
-- to the removed heading table. Schema 3 through 11 input remains supported by
-- tasks_restore_export_current through explicit schema-12 normalization.
DROP FUNCTION IF EXISTS public.tasks_prepare_replace_restore(jsonb);
DROP FUNCTION IF EXISTS public.tasks_prepare_replace_restore_v11(jsonb);
DROP FUNCTION IF EXISTS public.tasks_replace_restore_v11(jsonb, text, uuid, text);
DROP FUNCTION IF EXISTS public.tasks_replace_restore_v10(jsonb, text, uuid, text);
DROP FUNCTION IF EXISTS public.tasks_restore_export_v11(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tasks_restore_export_v10(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tasks_restore_export_v9(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tasks_restore_export_v8(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tasks_restore_export_v7(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tasks_restore_export_v6(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tasks_restore_export_v5(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tasks_restore_export_v4(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tasks_restore_export_v4_pre_actionability(jsonb, boolean);
DROP FUNCTION IF EXISTS public.tasks_create_export_v11();
DROP FUNCTION IF EXISTS public.tasks_create_export_v10();
DROP FUNCTION IF EXISTS public.tasks_create_export_v9();
DROP FUNCTION IF EXISTS public.tasks_create_export_v8();
DROP FUNCTION IF EXISTS public.tasks_create_export_v7();
DROP FUNCTION IF EXISTS public.tasks_create_export_v6();
DROP FUNCTION IF EXISTS public.tasks_create_export_v5();
DROP FUNCTION IF EXISTS public.tasks_create_export_v4();
DROP FUNCTION IF EXISTS tasks_private.tasks_create_export_v10_before_current_planning();
DROP FUNCTION IF EXISTS tasks_private.tasks_restore_export_v10_before_exact_replay_fix(jsonb, boolean);

-- Finalize Start Date as future-only deferral, retain active day horizons,
-- and add the editable Primary Link independently from audited provenance.
ALTER TABLE public.tasks_todos
  ADD COLUMN primary_link text,
  ADD CONSTRAINT tasks_todos_primary_link_valid CHECK (
    primary_link IS NULL OR (
      btrim(primary_link) <> '' AND char_length(primary_link) <= 8000
    )
  );

ALTER TABLE public.tasks_todos
  DROP CONSTRAINT tasks_todos_planning_placement_valid,
  ADD CONSTRAINT tasks_todos_planning_placement_valid CHECK (
    (destination = 'someday' AND start_date IS NULL AND today_section IS NULL)
    OR
    (destination = 'anytime' AND (start_date IS NULL OR today_section IS NOT NULL))
  );

ALTER TABLE public.tasks_projects
  DROP CONSTRAINT tasks_projects_planning_placement_valid,
  ADD CONSTRAINT tasks_projects_planning_placement_valid CHECK (
    (destination = 'someday' AND start_date IS NULL AND today_section IS NULL)
    OR
    (destination = 'anytime' AND (start_date IS NULL OR today_section IS NOT NULL))
  );

CREATE OR REPLACE FUNCTION tasks_private.normalize_root_planning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _planning_date date;
BEGIN
  IF NEW.destination = 'someday' THEN
    NEW.start_date := NULL;
    NEW.today_section := NULL;
    RETURN NEW;
  END IF;

  IF NEW.start_date IS NOT NULL THEN
    SELECT (clock_timestamp() AT TIME ZONE COALESCE(settings.planning_timezone, 'UTC'))::date
    INTO _planning_date
    FROM public.tasks_user_settings AS settings
    WHERE settings.owner_id = NEW.owner_id;
    _planning_date := COALESCE(_planning_date, (clock_timestamp() AT TIME ZONE 'UTC')::date);
    IF NEW.start_date <= _planning_date THEN
      RAISE EXCEPTION 'Start Date must be later than today in the owner planning time zone'
        USING ERRCODE = '22023';
    END IF;
    NEW.today_section := COALESCE(NEW.today_section, 'next');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_primary_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.primary_link := NULLIF(btrim(NEW.primary_link), '');
  IF NEW.primary_link IS NULL
    AND NEW.entry_channel = 'mail_automation'
    AND NEW.source_kind = 'mail_message'
    AND NEW.source_url LIKE 'message://%' THEN
    NEW.primary_link := NEW.source_url;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_todos_normalize_primary_link ON public.tasks_todos;
CREATE TRIGGER tasks_todos_normalize_primary_link
BEFORE INSERT OR UPDATE OF primary_link, entry_channel, source_kind, source_url
ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.normalize_todo_primary_link();

REVOKE ALL ON FUNCTION tasks_private.normalize_root_planning(),
  tasks_private.normalize_todo_primary_link()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.rebind_root_reminder_to_start_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _reminder public.tasks_reminders;
  _resolved_at timestamptz;
  _resolution_kind text;
  _mutation_id uuid;
  _planning_date date;
  _automatic_activation boolean := COALESCE(
    current_setting('garden.bath.tasks_activation', true), ''
  ) = 'on';
BEGIN
  IF NEW.start_date IS NOT DISTINCT FROM OLD.start_date THEN
    RETURN NEW;
  END IF;

  IF NOT _automatic_activation
    AND NEW.start_date IS NULL
    AND NEW.last_mutation_channel = 'native'
    AND NEW.last_actor_type = 'system' THEN
    SELECT (clock_timestamp() AT TIME ZONE settings.planning_timezone)::date
    INTO _planning_date
    FROM public.tasks_user_settings AS settings
    WHERE settings.owner_id = NEW.owner_id;
    _automatic_activation := OLD.start_date IS NOT NULL
      AND OLD.start_date <= COALESCE(
        _planning_date,
        (clock_timestamp() AT TIME ZONE 'UTC')::date
      );
  END IF;

  FOR _reminder IN
    SELECT reminder.*
    FROM public.tasks_reminders AS reminder
    WHERE reminder.owner_id = NEW.owner_id
      AND reminder.status = 'active'
      AND (
        (TG_TABLE_NAME = 'tasks_todos' AND reminder.task_id = NEW.id)
        OR (TG_TABLE_NAME = 'tasks_projects' AND reminder.project_id = NEW.id)
      )
    FOR UPDATE
  LOOP
    IF NEW.start_date IS NULL
      AND _automatic_activation
      AND _reminder.local_date = OLD.start_date
      AND _reminder.resolved_at >= clock_timestamp() THEN
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

    IF NEW.start_date IS NULL THEN
      UPDATE public.tasks_reminders
      SET status = 'canceled',
          record_revision = record_revision + 1,
          last_mutation_channel = NEW.last_mutation_channel,
          last_actor_type = 'system',
          client_mutation_id = _mutation_id,
          updated_at = clock_timestamp()
      WHERE id = _reminder.id AND owner_id = NEW.owner_id;
      CONTINUE;
    END IF;

    SELECT resolution.resolved_at, resolution.resolution_kind
    INTO _resolved_at, _resolution_kind
    FROM tasks_private.resolve_reminder_instant(
      NEW.start_date,
      _reminder.local_time,
      _reminder.time_zone,
      _reminder.ambiguity_choice
    ) AS resolution;

    UPDATE public.tasks_reminders
    SET local_date = NEW.start_date,
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
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.rebind_root_reminder_to_start_date()
FROM PUBLIC, anon, authenticated;

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
  _todo_count integer := 0;
  _project_count integer := 0;
BEGIN
  PERFORM set_config('garden.bath.tasks_activation', 'on', true);

  UPDATE public.tasks_todos AS task
  SET start_date = NULL,
      revision = task.revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = 'native',
      last_actor_type = 'system',
      updated_at = _now
  FROM public.tasks_user_settings AS settings
  WHERE settings.owner_id = task.owner_id
    AND (_owner_id IS NULL OR task.owner_id = _owner_id)
    AND task.destination = 'anytime'
    AND task.lifecycle = 'open'
    AND task.disposition = 'present'
    AND task.start_date IS NOT NULL
    AND task.start_date <= (_now AT TIME ZONE settings.planning_timezone)::date;
  GET DIAGNOSTICS _todo_count = ROW_COUNT;

  UPDATE public.tasks_projects AS project
  SET start_date = NULL,
      revision = project.revision + 1,
      client_mutation_id = gen_random_uuid(),
      last_mutation_channel = 'native',
      last_actor_type = 'system',
      updated_at = _now
  FROM public.tasks_user_settings AS settings
  WHERE settings.owner_id = project.owner_id
    AND (_owner_id IS NULL OR project.owner_id = _owner_id)
    AND project.destination = 'anytime'
    AND project.lifecycle = 'open'
    AND project.disposition = 'present'
    AND project.start_date IS NOT NULL
    AND project.start_date <= (_now AT TIME ZONE settings.planning_timezone)::date;
  GET DIAGNOSTICS _project_count = ROW_COUNT;

  PERFORM set_config('garden.bath.tasks_activation', 'off', true);
  RETURN jsonb_build_object(
    'activated_todos', _todo_count,
    'activated_projects', _project_count,
    'evaluated_at', _now
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.activate_due_roots(timestamptz, uuid)
FROM PUBLIC, anon, authenticated, service_role;

-- Normalize the dates synthesized earlier in this migration through the same
-- activation path, retaining their chosen active horizons.
SELECT tasks_private.activate_due_roots(clock_timestamp(), NULL);

DO $schedule_activation$
DECLARE
  _job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR _job_id IN
      SELECT jobid FROM cron.job WHERE jobname = 'tasks-activate-due-roots'
    LOOP
      PERFORM cron.unschedule(_job_id);
    END LOOP;
    PERFORM cron.schedule(
      'tasks-activate-due-roots',
      '* * * * *',
      'SELECT tasks_private.activate_due_roots(clock_timestamp(), NULL);'
    );
  END IF;
END;
$schedule_activation$;

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot_v7(_task public.tasks_todos)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'title', _task.title,
    'notes', _task.notes,
    'lifecycle', _task.lifecycle,
    'completed_at', _task.completed_at,
    'canceled_at', _task.canceled_at,
    'disposition', _task.disposition,
    'deleted_at', _task.deleted_at,
    'deletion_root_id', _task.deletion_root_id,
    'destination', _task.destination,
    'today_section', _task.today_section,
    'order_key', _task.order_key,
    'area_id', _task.area_id,
    'project_id', _task.project_id,
    'hierarchy_order_key', _task.hierarchy_order_key,
    'start_date', _task.start_date,
    'deadline', _task.deadline,
    'source_kind', _task.source_kind,
    'source_url', _task.source_url,
    'source_title', _task.source_title,
    'source_external_id', _task.source_external_id,
    'primary_link', _task.primary_link,
    'actionability', _task.actionability
  );
$$;

CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_snapshot_v7(_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _destination text;
  _start_date text;
  _today_section text;
  _primary_link text;
BEGIN
  IF _snapshot IS NULL OR _snapshot = 'null'::jsonb THEN
    RETURN NULL;
  END IF;
  _destination := CASE
    WHEN _snapshot ->> 'destination' IN ('inbox', 'today') THEN 'anytime'
    ELSE COALESCE(_snapshot ->> 'destination', 'anytime')
  END;
  _start_date := _snapshot ->> 'start_date';
  _today_section := CASE _snapshot ->> 'today_section'
    WHEN 'inbox' THEN 'inbox'
    WHEN 'now' THEN 'now'
    WHEN 'next' THEN 'next'
    WHEN 'later' THEN 'later'
    WHEN 'evening' THEN 'later'
    ELSE NULL
  END;
  IF _destination = 'someday' THEN
    _start_date := NULL;
    _today_section := NULL;
  ELSIF _start_date IS NOT NULL THEN
    _today_section := COALESCE(_today_section, 'next');
  END IF;
  _primary_link := NULLIF(btrim(_snapshot ->> 'primary_link'), '');
  RETURN jsonb_build_object(
    'title', _snapshot -> 'title',
    'notes', COALESCE(_snapshot -> 'notes', '""'::jsonb),
    'lifecycle', COALESCE(_snapshot -> 'lifecycle', '"open"'::jsonb),
    'completed_at', _snapshot -> 'completed_at',
    'canceled_at', _snapshot -> 'canceled_at',
    'disposition', COALESCE(_snapshot -> 'disposition', '"present"'::jsonb),
    'deleted_at', _snapshot -> 'deleted_at',
    'deletion_root_id', _snapshot -> 'deletion_root_id',
    'destination', to_jsonb(_destination),
    'today_section', to_jsonb(_today_section),
    'order_key', _snapshot -> 'order_key',
    'area_id', _snapshot -> 'area_id',
    'project_id', _snapshot -> 'project_id',
    'hierarchy_order_key', _snapshot -> 'hierarchy_order_key',
    'start_date', to_jsonb(_start_date),
    'deadline', _snapshot -> 'deadline',
    'source_kind', COALESCE(_snapshot -> 'source_kind', '"manual"'::jsonb),
    'source_url', _snapshot -> 'source_url',
    'source_title', _snapshot -> 'source_title',
    'source_external_id', _snapshot -> 'source_external_id',
    'primary_link', to_jsonb(_primary_link),
    'actionability', to_jsonb(COALESCE(_snapshot ->> 'actionability', 'actionable'))
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_snapshot_v7(public.tasks_todos),
  tasks_private.normalize_todo_snapshot_v7(jsonb)
FROM PUBLIC, anon, authenticated;

-- Backfill the editable shortcut only after current history snapshots include
-- Primary Link, so the audited migration revision remains undoable.
UPDATE public.tasks_todos
SET primary_link = source_url,
    revision = revision + 1,
    client_mutation_id = gen_random_uuid(),
    last_mutation_channel = 'import',
    last_actor_type = 'system'
WHERE primary_link IS NULL
  AND (
    source_url LIKE 'message://%'
    OR source_url LIKE 'http://%'
    OR source_url LIKE 'https://%'
  );

ALTER FUNCTION tasks_private.normalize_export_v12_record(text, jsonb, date)
RENAME TO normalize_export_v12_record_start_dependent;

CREATE OR REPLACE FUNCTION tasks_private.normalize_export_v12_record(
  _collection text,
  _record jsonb,
  _planning_date date
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _normalized jsonb := tasks_private.normalize_export_v12_record_start_dependent(
    _collection, _record, _planning_date
  );
  _start_date date;
  _horizon text;
  _primary_link text;
BEGIN
  IF _collection IN ('tasks_todos', 'tasks_projects') THEN
    _start_date := NULLIF(_normalized ->> 'start_date', '')::date;
    _horizon := _normalized ->> 'today_section';
    IF _normalized ->> 'destination' = 'someday' THEN
      _start_date := NULL;
      _horizon := NULL;
    ELSIF _start_date IS NOT NULL AND _start_date <= _planning_date THEN
      _start_date := NULL;
      _horizon := COALESCE(_horizon, 'next');
    ELSIF _start_date IS NOT NULL THEN
      _horizon := COALESCE(_horizon, 'next');
    END IF;
    _normalized := _normalized || jsonb_build_object(
      'start_date', to_jsonb(_start_date),
      'today_section', to_jsonb(_horizon)
    );
  END IF;
  IF _collection = 'tasks_todos' THEN
    _primary_link := NULLIF(btrim(_record ->> 'primary_link'), '');
    IF _primary_link IS NULL AND (
      _normalized ->> 'source_url' LIKE 'message://%'
      OR _normalized ->> 'source_url' LIKE 'http://%'
      OR _normalized ->> 'source_url' LIKE 'https://%'
    ) THEN
      _primary_link := _normalized ->> 'source_url';
    END IF;
    _normalized := _normalized || jsonb_build_object('primary_link', to_jsonb(_primary_link));
  END IF;
  RETURN _normalized;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_export_v12_record(text, jsonb, date),
  tasks_private.normalize_export_v12_record_start_dependent(text, jsonb, date)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v12(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _records jsonb;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export'
    OR _envelope ->> 'schema_version' IS DISTINCT FROM '12'
    OR _envelope #> '{manifest,collections}' IS DISTINCT FROM to_jsonb(_collections)
    OR _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256' THEN
    RAISE EXCEPTION 'Task export v12 manifest is invalid' USING ERRCODE = '22023';
  END IF;
  FOREACH _collection IN ARRAY _collections LOOP
    _records := _envelope #> ARRAY['data', _collection];
    IF jsonb_typeof(_records) IS DISTINCT FROM 'array'
      OR (_envelope #>> ARRAY['manifest', 'counts', _collection])::integer
        <> jsonb_array_length(_records)
      OR _envelope #>> ARRAY['manifest', 'checksums', _collection]
        IS DISTINCT FROM tasks_private.export_checksum(_records) THEN
      RAISE EXCEPTION 'Task export v12 collection % is invalid', _collection
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}') AS item(value)
    WHERE item.value ? 'heading_id'
      OR (item.value ->> 'actionability') NOT IN ('actionable', 'waiting', 'rechecking')
      OR char_length(COALESCE(item.value ->> 'primary_link', '')) > 8000
      OR (
        (item.value ->> 'start_date') IS NOT NULL
        AND item.value ->> 'today_section' NOT IN ('inbox', 'now', 'next', 'later')
      )
      OR (
        item.value ->> 'destination' = 'someday'
        AND ((item.value ->> 'start_date') IS NOT NULL OR (item.value ->> 'today_section') IS NOT NULL)
      )
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(_envelope #> '{data,tasks_projects}') AS item(value)
    WHERE (
      (item.value ->> 'start_date') IS NOT NULL
      AND item.value ->> 'today_section' NOT IN ('inbox', 'now', 'next', 'later')
    ) OR (
      item.value ->> 'destination' = 'someday'
      AND ((item.value ->> 'start_date') IS NOT NULL OR (item.value ->> 'today_section') IS NOT NULL)
    )
  ) THEN
    RAISE EXCEPTION 'Task export v12 contains invalid planning data' USING ERRCODE = '22023';
  END IF;
  PERFORM tasks_private.validate_export_v10(
    tasks_private.export_v12_as_v10_for_validation(_envelope)
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v12(jsonb)
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
    WHEN _source_today_section IN ('inbox', 'now', 'next', 'later') THEN _source_today_section
    ELSE NULL
  END;
  _start_date date := CASE WHEN _start_offset_days IS NULL
    THEN NULL ELSE _anchor_date + _start_offset_days END;
  _deadline date := CASE WHEN _deadline_offset_days IS NULL
    THEN NULL ELSE _anchor_date + _deadline_offset_days END;
BEGIN
  PERFORM _allow_inbox;
  IF _destination = 'someday' THEN
    _start_date := NULL;
    _today_section := NULL;
  ELSIF _destination <> 'anytime' THEN
    RAISE EXCEPTION 'Template planning destination is invalid'
      USING ERRCODE = '22023';
  ELSIF _start_date IS NOT NULL AND _start_date <= _planning_date THEN
    _start_date := NULL;
    _today_section := COALESCE(_today_section, 'next');
  ELSIF _start_date IS NOT NULL THEN
    _today_section := COALESCE(_today_section, 'next');
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
