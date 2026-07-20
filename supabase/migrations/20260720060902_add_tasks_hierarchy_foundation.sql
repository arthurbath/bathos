-- Owner-safe task hierarchy foundation with independent planning and container order

CREATE TABLE public.tasks_areas (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  order_key text NOT NULL,
  disposition text NOT NULL DEFAULT 'present',
  deleted_at timestamptz,
  entry_channel text NOT NULL DEFAULT 'web',
  last_mutation_channel text NOT NULL DEFAULT 'web',
  last_actor_type text NOT NULL DEFAULT 'user',
  revision bigint NOT NULL DEFAULT 1,
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_areas_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT tasks_areas_title_valid CHECK (btrim(title) <> '' AND char_length(title) <= 500),
  CONSTRAINT tasks_areas_order_key_valid CHECK (btrim(order_key) <> '' AND char_length(order_key) <= 255),
  CONSTRAINT tasks_areas_disposition_valid CHECK (disposition IN ('present', 'deleted')),
  CONSTRAINT tasks_areas_disposition_timestamp_valid CHECK (
    (disposition = 'present' AND deleted_at IS NULL)
    OR (disposition = 'deleted' AND deleted_at IS NOT NULL)
  ),
  CONSTRAINT tasks_areas_entry_channel_valid CHECK (
    entry_channel IN ('web', 'raycast', 'mcp', 'mail_automation', 'browser_capture', 'native', 'import')
  ),
  CONSTRAINT tasks_areas_last_mutation_channel_valid CHECK (
    last_mutation_channel IN ('web', 'raycast', 'mcp', 'mail_automation', 'browser_capture', 'native', 'import')
  ),
  CONSTRAINT tasks_areas_last_actor_type_valid CHECK (
    last_actor_type IN ('user', 'automation', 'system', 'import')
  ),
  CONSTRAINT tasks_areas_revision_valid CHECK (revision > 0)
);

CREATE TABLE public.tasks_projects (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id uuid,
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  lifecycle text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  canceled_at timestamptz,
  disposition text NOT NULL DEFAULT 'present',
  deleted_at timestamptz,
  destination text NOT NULL DEFAULT 'anytime',
  today_section text NOT NULL DEFAULT 'daytime',
  order_key text NOT NULL,
  planning_order_key text NOT NULL,
  start_date date,
  deadline date,
  entry_channel text NOT NULL DEFAULT 'web',
  last_mutation_channel text NOT NULL DEFAULT 'web',
  last_actor_type text NOT NULL DEFAULT 'user',
  revision bigint NOT NULL DEFAULT 1,
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_projects_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT tasks_projects_area_owner_fkey
    FOREIGN KEY (area_id, owner_id)
    REFERENCES public.tasks_areas(id, owner_id),
  CONSTRAINT tasks_projects_title_valid CHECK (btrim(title) <> '' AND char_length(title) <= 500),
  CONSTRAINT tasks_projects_lifecycle_valid CHECK (lifecycle IN ('open', 'completed', 'canceled')),
  CONSTRAINT tasks_projects_lifecycle_timestamps_valid CHECK (
    (lifecycle = 'open' AND completed_at IS NULL AND canceled_at IS NULL)
    OR (lifecycle = 'completed' AND completed_at IS NOT NULL AND canceled_at IS NULL)
    OR (lifecycle = 'canceled' AND canceled_at IS NOT NULL AND completed_at IS NULL)
  ),
  CONSTRAINT tasks_projects_disposition_valid CHECK (disposition IN ('present', 'deleted')),
  CONSTRAINT tasks_projects_disposition_timestamp_valid CHECK (
    (disposition = 'present' AND deleted_at IS NULL)
    OR (disposition = 'deleted' AND deleted_at IS NOT NULL)
  ),
  CONSTRAINT tasks_projects_destination_valid CHECK (destination IN ('today', 'anytime', 'someday')),
  CONSTRAINT tasks_projects_today_section_valid CHECK (today_section IN ('daytime', 'evening')),
  CONSTRAINT tasks_projects_evening_within_today CHECK (today_section = 'daytime' OR destination = 'today'),
  CONSTRAINT tasks_projects_unscheduled_placement_valid CHECK (
    destination <> 'someday' OR start_date IS NULL
  ),
  CONSTRAINT tasks_projects_calendar_range_valid CHECK (
    start_date IS NULL OR deadline IS NULL OR deadline >= start_date
  ),
  CONSTRAINT tasks_projects_order_key_valid CHECK (btrim(order_key) <> '' AND char_length(order_key) <= 255),
  CONSTRAINT tasks_projects_planning_order_key_valid CHECK (
    btrim(planning_order_key) <> '' AND char_length(planning_order_key) <= 255
  ),
  CONSTRAINT tasks_projects_entry_channel_valid CHECK (
    entry_channel IN ('web', 'raycast', 'mcp', 'mail_automation', 'browser_capture', 'native', 'import')
  ),
  CONSTRAINT tasks_projects_last_mutation_channel_valid CHECK (
    last_mutation_channel IN ('web', 'raycast', 'mcp', 'mail_automation', 'browser_capture', 'native', 'import')
  ),
  CONSTRAINT tasks_projects_last_actor_type_valid CHECK (
    last_actor_type IN ('user', 'automation', 'system', 'import')
  ),
  CONSTRAINT tasks_projects_revision_valid CHECK (revision > 0)
);

CREATE TABLE public.tasks_headings (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  title text NOT NULL,
  order_key text NOT NULL,
  disposition text NOT NULL DEFAULT 'present',
  deleted_at timestamptz,
  entry_channel text NOT NULL DEFAULT 'web',
  last_mutation_channel text NOT NULL DEFAULT 'web',
  last_actor_type text NOT NULL DEFAULT 'user',
  revision bigint NOT NULL DEFAULT 1,
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_headings_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT tasks_headings_id_project_owner_key UNIQUE (id, project_id, owner_id),
  CONSTRAINT tasks_headings_project_owner_fkey
    FOREIGN KEY (project_id, owner_id)
    REFERENCES public.tasks_projects(id, owner_id),
  CONSTRAINT tasks_headings_title_valid CHECK (btrim(title) <> '' AND char_length(title) <= 500),
  CONSTRAINT tasks_headings_order_key_valid CHECK (btrim(order_key) <> '' AND char_length(order_key) <= 255),
  CONSTRAINT tasks_headings_disposition_valid CHECK (disposition IN ('present', 'deleted')),
  CONSTRAINT tasks_headings_disposition_timestamp_valid CHECK (
    (disposition = 'present' AND deleted_at IS NULL)
    OR (disposition = 'deleted' AND deleted_at IS NOT NULL)
  ),
  CONSTRAINT tasks_headings_entry_channel_valid CHECK (
    entry_channel IN ('web', 'raycast', 'mcp', 'mail_automation', 'browser_capture', 'native', 'import')
  ),
  CONSTRAINT tasks_headings_last_mutation_channel_valid CHECK (
    last_mutation_channel IN ('web', 'raycast', 'mcp', 'mail_automation', 'browser_capture', 'native', 'import')
  ),
  CONSTRAINT tasks_headings_last_actor_type_valid CHECK (
    last_actor_type IN ('user', 'automation', 'system', 'import')
  ),
  CONSTRAINT tasks_headings_revision_valid CHECK (revision > 0)
);

ALTER TABLE public.tasks_todos
  ADD COLUMN area_id uuid,
  ADD COLUMN project_id uuid,
  ADD COLUMN heading_id uuid,
  ADD COLUMN hierarchy_order_key text,
  ADD CONSTRAINT tasks_todos_area_owner_fkey
    FOREIGN KEY (area_id, owner_id)
    REFERENCES public.tasks_areas(id, owner_id),
  ADD CONSTRAINT tasks_todos_project_owner_fkey
    FOREIGN KEY (project_id, owner_id)
    REFERENCES public.tasks_projects(id, owner_id),
  ADD CONSTRAINT tasks_todos_heading_project_owner_fkey
    FOREIGN KEY (heading_id, project_id, owner_id)
    REFERENCES public.tasks_headings(id, project_id, owner_id),
  ADD CONSTRAINT tasks_todos_container_valid CHECK (
    NOT (area_id IS NOT NULL AND project_id IS NOT NULL)
    AND (heading_id IS NULL OR project_id IS NOT NULL)
  ),
  ADD CONSTRAINT tasks_todos_hierarchy_order_key_valid CHECK (
    hierarchy_order_key IS NULL
    OR (btrim(hierarchy_order_key) <> '' AND char_length(hierarchy_order_key) <= 255)
  );

CREATE TABLE public.tasks_checklist_items (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  order_key text NOT NULL,
  disposition text NOT NULL DEFAULT 'present',
  deleted_at timestamptz,
  entry_channel text NOT NULL DEFAULT 'web',
  last_mutation_channel text NOT NULL DEFAULT 'web',
  last_actor_type text NOT NULL DEFAULT 'user',
  revision bigint NOT NULL DEFAULT 1,
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_checklist_items_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT tasks_checklist_items_task_owner_fkey
    FOREIGN KEY (task_id, owner_id)
    REFERENCES public.tasks_todos(id, owner_id),
  CONSTRAINT tasks_checklist_items_title_valid CHECK (btrim(title) <> '' AND char_length(title) <= 500),
  CONSTRAINT tasks_checklist_items_completion_valid CHECK (
    (completed AND completed_at IS NOT NULL)
    OR (NOT completed AND completed_at IS NULL)
  ),
  CONSTRAINT tasks_checklist_items_order_key_valid CHECK (
    btrim(order_key) <> '' AND char_length(order_key) <= 255
  ),
  CONSTRAINT tasks_checklist_items_disposition_valid CHECK (disposition IN ('present', 'deleted')),
  CONSTRAINT tasks_checklist_items_disposition_timestamp_valid CHECK (
    (disposition = 'present' AND deleted_at IS NULL)
    OR (disposition = 'deleted' AND deleted_at IS NOT NULL)
  ),
  CONSTRAINT tasks_checklist_items_entry_channel_valid CHECK (
    entry_channel IN ('web', 'raycast', 'mcp', 'mail_automation', 'browser_capture', 'native', 'import')
  ),
  CONSTRAINT tasks_checklist_items_last_mutation_channel_valid CHECK (
    last_mutation_channel IN ('web', 'raycast', 'mcp', 'mail_automation', 'browser_capture', 'native', 'import')
  ),
  CONSTRAINT tasks_checklist_items_last_actor_type_valid CHECK (
    last_actor_type IN ('user', 'automation', 'system', 'import')
  ),
  CONSTRAINT tasks_checklist_items_revision_valid CHECK (revision > 0)
);

ALTER TABLE public.tasks_areas REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_projects REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_headings REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_checklist_items REPLICA IDENTITY FULL;

ALTER TABLE public.tasks_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_headings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX tasks_areas_owner_client_mutation_key
ON public.tasks_areas (owner_id, client_mutation_id);
CREATE UNIQUE INDEX tasks_projects_owner_client_mutation_key
ON public.tasks_projects (owner_id, client_mutation_id);
CREATE UNIQUE INDEX tasks_headings_owner_client_mutation_key
ON public.tasks_headings (owner_id, client_mutation_id);
CREATE UNIQUE INDEX tasks_checklist_items_owner_client_mutation_key
ON public.tasks_checklist_items (owner_id, client_mutation_id);

CREATE INDEX tasks_areas_owner_order_idx
ON public.tasks_areas (owner_id, order_key, id) WHERE disposition = 'present';
CREATE INDEX tasks_projects_owner_area_order_idx
ON public.tasks_projects (owner_id, area_id, order_key, id) WHERE disposition = 'present';
CREATE INDEX tasks_projects_owner_planning_order_idx
ON public.tasks_projects (owner_id, destination, today_section, planning_order_key, id)
WHERE disposition = 'present' AND lifecycle = 'open';
CREATE INDEX tasks_headings_owner_project_order_idx
ON public.tasks_headings (owner_id, project_id, order_key, id) WHERE disposition = 'present';
CREATE INDEX tasks_todos_owner_container_order_idx
ON public.tasks_todos (owner_id, area_id, project_id, heading_id, hierarchy_order_key, id)
WHERE disposition = 'present';
CREATE INDEX tasks_checklist_items_owner_task_order_idx
ON public.tasks_checklist_items (owner_id, task_id, order_key, id) WHERE disposition = 'present';

CREATE OR REPLACE FUNCTION tasks_private.prepare_hierarchy_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Hierarchy identifier is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Hierarchy owner is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Hierarchy creation time is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.entry_channel IS DISTINCT FROM OLD.entry_channel THEN
    RAISE EXCEPTION 'Hierarchy entry channel is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Hierarchy revision must increment by exactly one' USING ERRCODE = '23514';
  END IF;
  IF NEW.client_mutation_id = OLD.client_mutation_id THEN
    RAISE EXCEPTION 'Hierarchy updates require a new client mutation identifier'
      USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.prepare_hierarchy_write()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_areas_prepare_update
BEFORE UPDATE ON public.tasks_areas
FOR EACH ROW EXECUTE FUNCTION tasks_private.prepare_hierarchy_write();
CREATE TRIGGER tasks_projects_prepare_update
BEFORE UPDATE ON public.tasks_projects
FOR EACH ROW EXECUTE FUNCTION tasks_private.prepare_hierarchy_write();
CREATE TRIGGER tasks_headings_prepare_update
BEFORE UPDATE ON public.tasks_headings
FOR EACH ROW EXECUTE FUNCTION tasks_private.prepare_hierarchy_write();
CREATE TRIGGER tasks_checklist_items_prepare_update
BEFORE UPDATE ON public.tasks_checklist_items
FOR EACH ROW EXECUTE FUNCTION tasks_private.prepare_hierarchy_write();

CREATE POLICY "Task owners can view their areas"
ON public.tasks_areas FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can create their areas"
ON public.tasks_areas FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can update their areas"
ON public.tasks_areas FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Task owners can view their projects"
ON public.tasks_projects FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can create their projects"
ON public.tasks_projects FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can update their projects"
ON public.tasks_projects FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Task owners can view their headings"
ON public.tasks_headings FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can create their headings"
ON public.tasks_headings FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can update their headings"
ON public.tasks_headings FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Task owners can view their checklist items"
ON public.tasks_checklist_items FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can create their checklist items"
ON public.tasks_checklist_items FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can update their checklist items"
ON public.tasks_checklist_items FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.tasks_areas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tasks_projects FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tasks_headings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tasks_checklist_items FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.tasks_areas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tasks_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tasks_headings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tasks_checklist_items TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_areas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_headings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_checklist_items TO service_role;

-- Keep schema-version-three exports restorable by normalizing absent hierarchy
-- fields to null while preserving those fields in new history snapshots.
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
      'today_section', COALESCE(_snapshot ->> 'today_section', 'daytime'),
      'area_id', _snapshot -> 'area_id',
      'project_id', _snapshot -> 'project_id',
      'heading_id', _snapshot -> 'heading_id',
      'hierarchy_order_key', _snapshot -> 'hierarchy_order_key'
    )
  END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_todo_snapshot_v3(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot_v3(_task public.tasks_todos)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
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
    'destination', _task.destination,
    'today_section', _task.today_section,
    'order_key', _task.order_key,
    'area_id', _task.area_id,
    'project_id', _task.project_id,
    'heading_id', _task.heading_id,
    'hierarchy_order_key', _task.hierarchy_order_key,
    'start_date', _task.start_date,
    'deadline', _task.deadline,
    'source_kind', _task.source_kind,
    'source_url', _task.source_url,
    'source_title', _task.source_title,
    'source_external_id', _task.source_external_id
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_snapshot_v3(public.tasks_todos)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.normalize_todo_snapshot_v4(_snapshot jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN _snapshot IS NULL OR _snapshot = 'null'::jsonb THEN NULL
    ELSE tasks_private.normalize_todo_snapshot_v3(_snapshot) || jsonb_build_object(
      'area_id', _snapshot -> 'area_id',
      'project_id', _snapshot -> 'project_id',
      'heading_id', _snapshot -> 'heading_id',
      'hierarchy_order_key', _snapshot -> 'hierarchy_order_key'
    )
  END;
$$;

REVOKE ALL ON FUNCTION tasks_private.normalize_todo_snapshot_v4(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.todo_snapshot_v4(_task public.tasks_todos)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT tasks_private.todo_snapshot_v3(_task) || jsonb_build_object(
    'area_id', _task.area_id,
    'project_id', _task.project_id,
    'heading_id', _task.heading_id,
    'hierarchy_order_key', _task.hierarchy_order_key
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.todo_snapshot_v4(public.tasks_todos)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.append_todo_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _base_revision bigint;
  _before_state jsonb;
  _transition text;
  _undo_source public.tasks_history_events;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tasks_private.restore_contexts AS context
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

  IF TG_OP = 'INSERT' THEN
    IF NEW.undo_source_event_id IS NOT NULL THEN
      RAISE EXCEPTION 'A new task cannot be an undo mutation' USING ERRCODE = '23514';
    END IF;
    _base_revision := 0;
    _before_state := NULL;
    _transition := 'create';
  ELSE
    _base_revision := OLD.revision;
    _before_state := tasks_private.todo_snapshot_v4(OLD);

    IF NEW.undo_source_event_id IS NOT NULL THEN
      SELECT event.* INTO _undo_source
      FROM public.tasks_history_events AS event
      WHERE event.id = NEW.undo_source_event_id
        AND event.owner_id = NEW.owner_id
        AND event.task_id = NEW.id;

      IF NOT FOUND
        OR _undo_source.transition IN ('baseline', 'create')
        OR _undo_source.result_revision <> OLD.revision
        OR tasks_private.normalize_todo_snapshot_v4(_undo_source.before_state)
          IS DISTINCT FROM tasks_private.todo_snapshot_v4(NEW) THEN
        RAISE EXCEPTION 'The requested undo is no longer safe' USING ERRCODE = '23514';
      END IF;
      _transition := 'undo';
    ELSIF NEW.lifecycle IS DISTINCT FROM OLD.lifecycle THEN
      _transition := CASE NEW.lifecycle
        WHEN 'completed' THEN 'complete'
        WHEN 'canceled' THEN 'cancel'
        ELSE 'reopen'
      END;
    ELSIF NEW.disposition IS DISTINCT FROM OLD.disposition THEN
      _transition := CASE NEW.disposition WHEN 'deleted' THEN 'delete' ELSE 'restore' END;
    ELSIF NEW.destination IS DISTINCT FROM OLD.destination
      OR NEW.today_section IS DISTINCT FROM OLD.today_section
      OR NEW.area_id IS DISTINCT FROM OLD.area_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.heading_id IS DISTINCT FROM OLD.heading_id THEN
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
    _transition, NEW.updated_at, 'accepted', NULL, _before_state,
    tasks_private.todo_snapshot_v4(NEW)
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.append_todo_history()
FROM PUBLIC, anon, authenticated;
