-- Revisioned native task templates, atomic provenance-aware instantiation,
-- and portable export schema version eight.

CREATE TABLE public.tasks_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  current_revision bigint NOT NULL DEFAULT 1,
  record_revision bigint NOT NULL DEFAULT 1,
  archived_at timestamptz,
  last_mutation_channel text NOT NULL DEFAULT 'web',
  last_actor_type text NOT NULL DEFAULT 'user',
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_templates_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT tasks_templates_kind_valid CHECK (kind IN ('todo', 'project')),
  CONSTRAINT tasks_templates_name_valid CHECK (
    btrim(name) <> '' AND char_length(name) <= 500
  ),
  CONSTRAINT tasks_templates_current_revision_valid CHECK (current_revision > 0),
  CONSTRAINT tasks_templates_record_revision_valid CHECK (record_revision > 0),
  CONSTRAINT tasks_templates_channel_valid CHECK (
    last_mutation_channel IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    )
  ),
  CONSTRAINT tasks_templates_actor_valid CHECK (
    last_actor_type IN ('user', 'automation', 'system', 'import')
  )
);

CREATE TABLE public.tasks_template_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL,
  revision bigint NOT NULL,
  name text NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  source_revision bigint NOT NULL,
  anchor_date date NOT NULL,
  snapshot jsonb NOT NULL,
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_template_revisions_template_owner_fkey
    FOREIGN KEY (template_id, owner_id)
    REFERENCES public.tasks_templates(id, owner_id) ON DELETE CASCADE,
  CONSTRAINT tasks_template_revisions_template_revision_key
    UNIQUE (template_id, revision),
  CONSTRAINT tasks_template_revisions_template_revision_owner_key
    UNIQUE (template_id, revision, owner_id),
  CONSTRAINT tasks_template_revisions_source_type_valid CHECK (
    source_type IN ('todo', 'project')
  ),
  CONSTRAINT tasks_template_revisions_revision_valid CHECK (
    revision > 0 AND source_revision > 0
  ),
  CONSTRAINT tasks_template_revisions_name_valid CHECK (
    btrim(name) <> '' AND char_length(name) <= 500
  ),
  CONSTRAINT tasks_template_revisions_snapshot_valid CHECK (
    jsonb_typeof(snapshot) = 'object'
    AND snapshot ->> 'version' = '1'
    AND snapshot ->> 'kind' = source_type
    AND jsonb_typeof(snapshot -> 'root') = 'object'
  )
);

CREATE TABLE public.tasks_template_instantiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL,
  template_revision bigint NOT NULL,
  anchor_date date NOT NULL,
  entry_channel text NOT NULL,
  actor_type text NOT NULL,
  target_area_id uuid,
  root_type text NOT NULL,
  root_id uuid NOT NULL,
  result jsonb NOT NULL,
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_template_instantiations_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT tasks_template_instantiations_template_revision_owner_fkey
    FOREIGN KEY (template_id, template_revision, owner_id)
    REFERENCES public.tasks_template_revisions(template_id, revision, owner_id),
  CONSTRAINT tasks_template_instantiations_target_area_owner_fkey
    FOREIGN KEY (target_area_id, owner_id)
    REFERENCES public.tasks_areas(id, owner_id)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT tasks_template_instantiations_root_type_valid CHECK (
    root_type IN ('todo', 'project')
  ),
  CONSTRAINT tasks_template_instantiations_channel_valid CHECK (
    entry_channel IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    )
  ),
  CONSTRAINT tasks_template_instantiations_actor_valid CHECK (
    actor_type IN ('user', 'automation', 'system', 'import')
  ),
  CONSTRAINT tasks_template_instantiations_result_valid CHECK (
    jsonb_typeof(result) = 'object'
    AND result ->> 'root_type' = root_type
    AND result ->> 'root_id' = root_id::text
  )
);

CREATE UNIQUE INDEX tasks_templates_owner_client_mutation_key
ON public.tasks_templates (owner_id, client_mutation_id);
CREATE INDEX tasks_templates_owner_active_name_idx
ON public.tasks_templates (owner_id, kind, lower(name), id)
WHERE archived_at IS NULL;
CREATE UNIQUE INDEX tasks_template_revisions_owner_client_mutation_key
ON public.tasks_template_revisions (owner_id, client_mutation_id);
CREATE INDEX tasks_template_revisions_owner_template_idx
ON public.tasks_template_revisions (owner_id, template_id, revision DESC);
CREATE UNIQUE INDEX tasks_template_instantiations_owner_client_mutation_key
ON public.tasks_template_instantiations (owner_id, client_mutation_id);
CREATE INDEX tasks_template_instantiations_owner_template_idx
ON public.tasks_template_instantiations (
  owner_id, template_id, template_revision, created_at DESC
);

ALTER TABLE public.tasks_templates REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_template_revisions REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_template_instantiations REPLICA IDENTITY FULL;

ALTER TABLE public.tasks_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_template_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_template_instantiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task owners can view their templates"
ON public.tasks_templates FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can view their template revisions"
ON public.tasks_template_revisions FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Task owners can view their template instantiations"
ON public.tasks_template_instantiations FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.tasks_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tasks_template_revisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tasks_template_instantiations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tasks_templates TO authenticated;
GRANT SELECT ON TABLE public.tasks_template_revisions TO authenticated;
GRANT SELECT ON TABLE public.tasks_template_instantiations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_template_revisions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_template_instantiations TO service_role;

CREATE TABLE tasks_private.template_contexts (
  backend_pid integer NOT NULL,
  transaction_id bigint NOT NULL,
  owner_id uuid NOT NULL,
  PRIMARY KEY (backend_pid, transaction_id, owner_id)
);
REVOKE ALL ON TABLE tasks_private.template_contexts
FROM PUBLIC, anon, authenticated;

ALTER TABLE public.tasks_todos
  ADD COLUMN template_definition_id uuid,
  ADD COLUMN template_revision bigint,
  ADD COLUMN template_instantiation_id uuid,
  ADD COLUMN template_node_id uuid;
ALTER TABLE public.tasks_projects
  ADD COLUMN template_definition_id uuid,
  ADD COLUMN template_revision bigint,
  ADD COLUMN template_instantiation_id uuid,
  ADD COLUMN template_node_id uuid;
ALTER TABLE public.tasks_headings
  ADD COLUMN template_definition_id uuid,
  ADD COLUMN template_revision bigint,
  ADD COLUMN template_instantiation_id uuid,
  ADD COLUMN template_node_id uuid;
ALTER TABLE public.tasks_checklist_items
  ADD COLUMN template_definition_id uuid,
  ADD COLUMN template_revision bigint,
  ADD COLUMN template_instantiation_id uuid,
  ADD COLUMN template_node_id uuid;

ALTER TABLE public.tasks_todos
  ADD CONSTRAINT tasks_todos_template_provenance_complete CHECK (
    (template_definition_id IS NULL AND template_revision IS NULL
      AND template_instantiation_id IS NULL AND template_node_id IS NULL)
    OR (template_definition_id IS NOT NULL AND template_revision IS NOT NULL
      AND template_instantiation_id IS NOT NULL AND template_node_id IS NOT NULL)
  ),
  ADD CONSTRAINT tasks_todos_template_source_valid CHECK (
    template_definition_id IS NULL OR source_kind = 'template'
  ),
  ADD CONSTRAINT tasks_todos_template_definition_owner_fkey
    FOREIGN KEY (template_definition_id, owner_id)
    REFERENCES public.tasks_templates(id, owner_id),
  ADD CONSTRAINT tasks_todos_template_revision_owner_fkey
    FOREIGN KEY (template_definition_id, template_revision, owner_id)
    REFERENCES public.tasks_template_revisions(template_id, revision, owner_id),
  ADD CONSTRAINT tasks_todos_template_instantiation_owner_fkey
    FOREIGN KEY (template_instantiation_id, owner_id)
    REFERENCES public.tasks_template_instantiations(id, owner_id);

ALTER TABLE public.tasks_projects
  ADD CONSTRAINT tasks_projects_template_provenance_complete CHECK (
    (template_definition_id IS NULL AND template_revision IS NULL
      AND template_instantiation_id IS NULL AND template_node_id IS NULL)
    OR (template_definition_id IS NOT NULL AND template_revision IS NOT NULL
      AND template_instantiation_id IS NOT NULL AND template_node_id IS NOT NULL)
  ),
  ADD CONSTRAINT tasks_projects_template_definition_owner_fkey
    FOREIGN KEY (template_definition_id, owner_id)
    REFERENCES public.tasks_templates(id, owner_id),
  ADD CONSTRAINT tasks_projects_template_revision_owner_fkey
    FOREIGN KEY (template_definition_id, template_revision, owner_id)
    REFERENCES public.tasks_template_revisions(template_id, revision, owner_id),
  ADD CONSTRAINT tasks_projects_template_instantiation_owner_fkey
    FOREIGN KEY (template_instantiation_id, owner_id)
    REFERENCES public.tasks_template_instantiations(id, owner_id);

ALTER TABLE public.tasks_headings
  ADD CONSTRAINT tasks_headings_template_provenance_complete CHECK (
    (template_definition_id IS NULL AND template_revision IS NULL
      AND template_instantiation_id IS NULL AND template_node_id IS NULL)
    OR (template_definition_id IS NOT NULL AND template_revision IS NOT NULL
      AND template_instantiation_id IS NOT NULL AND template_node_id IS NOT NULL)
  ),
  ADD CONSTRAINT tasks_headings_template_definition_owner_fkey
    FOREIGN KEY (template_definition_id, owner_id)
    REFERENCES public.tasks_templates(id, owner_id),
  ADD CONSTRAINT tasks_headings_template_revision_owner_fkey
    FOREIGN KEY (template_definition_id, template_revision, owner_id)
    REFERENCES public.tasks_template_revisions(template_id, revision, owner_id),
  ADD CONSTRAINT tasks_headings_template_instantiation_owner_fkey
    FOREIGN KEY (template_instantiation_id, owner_id)
    REFERENCES public.tasks_template_instantiations(id, owner_id);

ALTER TABLE public.tasks_checklist_items
  ADD CONSTRAINT tasks_checklist_items_template_provenance_complete CHECK (
    (template_definition_id IS NULL AND template_revision IS NULL
      AND template_instantiation_id IS NULL AND template_node_id IS NULL)
    OR (template_definition_id IS NOT NULL AND template_revision IS NOT NULL
      AND template_instantiation_id IS NOT NULL AND template_node_id IS NOT NULL)
  ),
  ADD CONSTRAINT tasks_checklist_items_template_definition_owner_fkey
    FOREIGN KEY (template_definition_id, owner_id)
    REFERENCES public.tasks_templates(id, owner_id),
  ADD CONSTRAINT tasks_checklist_items_template_revision_owner_fkey
    FOREIGN KEY (template_definition_id, template_revision, owner_id)
    REFERENCES public.tasks_template_revisions(template_id, revision, owner_id),
  ADD CONSTRAINT tasks_checklist_items_template_instantiation_owner_fkey
    FOREIGN KEY (template_instantiation_id, owner_id)
    REFERENCES public.tasks_template_instantiations(id, owner_id);

CREATE INDEX tasks_todos_owner_template_idx
ON public.tasks_todos (owner_id, template_definition_id, template_revision)
WHERE template_definition_id IS NOT NULL;
CREATE INDEX tasks_projects_owner_template_idx
ON public.tasks_projects (owner_id, template_definition_id, template_revision)
WHERE template_definition_id IS NOT NULL;

CREATE OR REPLACE FUNCTION tasks_private.guard_template_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _has_context boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.template_definition_id IS DISTINCT FROM OLD.template_definition_id
    OR NEW.template_revision IS DISTINCT FROM OLD.template_revision
    OR NEW.template_instantiation_id IS DISTINCT FROM OLD.template_instantiation_id
    OR NEW.template_node_id IS DISTINCT FROM OLD.template_node_id
  ) THEN
    RAISE EXCEPTION 'Template provenance is immutable' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.template_definition_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM tasks_private.template_contexts AS context
      WHERE context.backend_pid = pg_backend_pid()
        AND context.transaction_id = txid_current()
        AND context.owner_id = NEW.owner_id
    ) OR EXISTS (
      SELECT 1 FROM tasks_private.restore_contexts AS context
      WHERE context.backend_pid = pg_backend_pid()
        AND context.transaction_id = txid_current()
        AND context.owner_id = NEW.owner_id
    ) INTO _has_context;
    IF NOT _has_context THEN
      RAISE EXCEPTION 'Template provenance can be assigned only by instantiation or restore'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.guard_template_provenance()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_todos_guard_template_provenance
BEFORE INSERT OR UPDATE ON public.tasks_todos
FOR EACH ROW EXECUTE FUNCTION tasks_private.guard_template_provenance();
CREATE TRIGGER tasks_projects_guard_template_provenance
BEFORE INSERT OR UPDATE ON public.tasks_projects
FOR EACH ROW EXECUTE FUNCTION tasks_private.guard_template_provenance();
CREATE TRIGGER tasks_headings_guard_template_provenance
BEFORE INSERT OR UPDATE ON public.tasks_headings
FOR EACH ROW EXECUTE FUNCTION tasks_private.guard_template_provenance();
CREATE TRIGGER tasks_checklist_items_guard_template_provenance
BEFORE INSERT OR UPDATE ON public.tasks_checklist_items
FOR EACH ROW EXECUTE FUNCTION tasks_private.guard_template_provenance();

CREATE OR REPLACE FUNCTION tasks_private.prepare_template_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Template identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.record_revision <> OLD.record_revision + 1 THEN
    RAISE EXCEPTION 'Template record revision must increment by exactly one'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.current_revision NOT IN (OLD.current_revision, OLD.current_revision + 1) THEN
    RAISE EXCEPTION 'Template content revision is invalid' USING ERRCODE = '23514';
  END IF;
  IF OLD.archived_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Archived templates are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.client_mutation_id = OLD.client_mutation_id THEN
    RAISE EXCEPTION 'Template updates require a new mutation identifier'
      USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.prepare_template_update()
FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tasks_templates_prepare_update
BEFORE UPDATE ON public.tasks_templates
FOR EACH ROW EXECUTE FUNCTION tasks_private.prepare_template_update();

CREATE OR REPLACE FUNCTION tasks_private.reject_template_immutable_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND (SELECT auth.uid()) IS NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Template revisions and instantiations are immutable'
    USING ERRCODE = '23514';
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.reject_template_immutable_write()
FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tasks_template_revisions_immutable
BEFORE UPDATE OR DELETE ON public.tasks_template_revisions
FOR EACH ROW EXECUTE FUNCTION tasks_private.reject_template_immutable_write();
CREATE TRIGGER tasks_template_instantiations_immutable
BEFORE UPDATE OR DELETE ON public.tasks_template_instantiations
FOR EACH ROW EXECUTE FUNCTION tasks_private.reject_template_immutable_write();

CREATE OR REPLACE FUNCTION tasks_private.template_snapshot_from_todo(
  _owner_id uuid,
  _task_id uuid,
  _anchor_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _task public.tasks_todos;
  _checklist jsonb;
BEGIN
  SELECT task.* INTO _task
  FROM public.tasks_todos AS task
  WHERE task.id = _task_id
    AND task.owner_id = _owner_id
    AND task.disposition = 'present';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The template source to-do is unavailable'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'node_id', item.id,
        'title', item.title,
        'order_key', item.order_key
      ) ORDER BY item.order_key, item.id
    ),
    '[]'::jsonb
  ) INTO _checklist
  FROM public.tasks_checklist_items AS item
  WHERE item.owner_id = _owner_id
    AND item.task_id = _task_id
    AND item.disposition = 'present';

  RETURN jsonb_build_object(
    'version', 1,
    'kind', 'todo',
    'root', jsonb_build_object(
      'node_id', _task.id,
      'title', _task.title,
      'notes', _task.notes,
      'actionability', _task.actionability,
      'destination', _task.destination,
      'today_section', _task.today_section,
      'order_key', _task.order_key,
      'start_offset_days', CASE WHEN _task.start_date IS NULL
        THEN NULL ELSE _task.start_date - _anchor_date END,
      'deadline_offset_days', CASE WHEN _task.deadline IS NULL
        THEN NULL ELSE _task.deadline - _anchor_date END,
      'checklist', _checklist
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.template_snapshot_from_todo(uuid, uuid, date)
FROM PUBLIC, anon, authenticated;

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
  _headings jsonb;
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

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'node_id', heading.id,
        'title', heading.title,
        'order_key', heading.order_key
      ) ORDER BY heading.order_key, heading.id
    ),
    '[]'::jsonb
  ) INTO _headings
  FROM public.tasks_headings AS heading
  WHERE heading.owner_id = _owner_id
    AND heading.project_id = _project_id
    AND heading.disposition = 'present';

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'node_id', task.id,
        'heading_node_id', task.heading_id,
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
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'node_id', item.id,
                'title', item.title,
                'order_key', item.order_key
              ) ORDER BY item.order_key, item.id
            ),
            '[]'::jsonb
          )
          FROM public.tasks_checklist_items AS item
          WHERE item.owner_id = _owner_id
            AND item.task_id = task.id
            AND item.disposition = 'present'
        )
      ) ORDER BY task.heading_id NULLS FIRST,
        COALESCE(task.hierarchy_order_key, task.order_key), task.id
    ),
    '[]'::jsonb
  ) INTO _todos
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
    'headings', _headings,
    'todos', _todos
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.template_snapshot_from_project(uuid, uuid, date)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_capture_template(
  _template_id uuid,
  _source_type text,
  _source_id uuid,
  _name text,
  _anchor_date date,
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
  _template public.tasks_templates;
  _revision public.tasks_template_revisions;
  _source_revision bigint;
  _next_revision bigint;
  _snapshot jsonb;
  _normalized_name text := btrim(_name);
  _timestamp timestamptz := clock_timestamp();
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save templates'
      USING ERRCODE = '42501';
  END IF;
  IF _source_type NOT IN ('todo', 'project')
    OR _source_id IS NULL
    OR _mutation_id IS NULL
    OR _anchor_date IS NULL
    OR NULLIF(_normalized_name, '') IS NULL
    OR char_length(_normalized_name) > 500
    OR _mutation_channel NOT IN (
      'web', 'raycast', 'mcp', 'mail_automation',
      'browser_capture', 'native', 'import'
    )
    OR _actor_type NOT IN ('user', 'automation', 'system', 'import') THEN
    RAISE EXCEPTION 'Template capture input is invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(_owner_id::text || E'\x1f' || _mutation_id::text, 0)
  );
  SELECT revision.* INTO _revision
  FROM public.tasks_template_revisions AS revision
  WHERE revision.owner_id = _owner_id
    AND revision.client_mutation_id = _mutation_id;
  IF FOUND THEN
    IF _revision.source_type IS DISTINCT FROM _source_type
      OR _revision.source_id IS DISTINCT FROM _source_id
      OR _revision.name IS DISTINCT FROM _normalized_name
      OR _revision.anchor_date IS DISTINCT FROM _anchor_date
      OR (_template_id IS NOT NULL AND _revision.template_id IS DISTINCT FROM _template_id) THEN
      RAISE EXCEPTION 'The mutation identifier belongs to a different template capture'
        USING ERRCODE = '23505';
    END IF;
    SELECT template.* INTO _template
    FROM public.tasks_templates AS template
    WHERE template.id = _revision.template_id AND template.owner_id = _owner_id;
    RETURN jsonb_build_object(
      'outcome', 'already_applied',
      'template', to_jsonb(_template) - 'owner_id',
      'revision', to_jsonb(_revision) - 'owner_id'
    );
  END IF;

  IF _source_type = 'todo' THEN
    SELECT task.revision INTO _source_revision
    FROM public.tasks_todos AS task
    WHERE task.id = _source_id
      AND task.owner_id = _owner_id
      AND task.disposition = 'present';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The template source to-do is unavailable'
        USING ERRCODE = '22023';
    END IF;
    _snapshot := tasks_private.template_snapshot_from_todo(
      _owner_id, _source_id, _anchor_date
    );
  ELSE
    SELECT project.revision INTO _source_revision
    FROM public.tasks_projects AS project
    WHERE project.id = _source_id
      AND project.owner_id = _owner_id
      AND project.disposition = 'present';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The template source project is unavailable'
        USING ERRCODE = '22023';
    END IF;
    _snapshot := tasks_private.template_snapshot_from_project(
      _owner_id, _source_id, _anchor_date
    );
  END IF;

  IF _template_id IS NULL THEN
    INSERT INTO public.tasks_templates (
      owner_id, kind, name, current_revision, record_revision,
      last_mutation_channel, last_actor_type, client_mutation_id,
      created_at, updated_at
    ) VALUES (
      _owner_id, _source_type, _normalized_name, 1, 1,
      _mutation_channel, _actor_type, _mutation_id, _timestamp, _timestamp
    ) RETURNING * INTO _template;
    _next_revision := 1;
  ELSE
    SELECT template.* INTO _template
    FROM public.tasks_templates AS template
    WHERE template.id = _template_id AND template.owner_id = _owner_id
    FOR UPDATE;
    IF NOT FOUND OR _template.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'The template is unavailable' USING ERRCODE = '22023';
    END IF;
    IF _template.kind IS DISTINCT FROM _source_type THEN
      RAISE EXCEPTION 'The template source type cannot change'
        USING ERRCODE = '22023';
    END IF;
    _next_revision := _template.current_revision + 1;
    UPDATE public.tasks_templates
    SET name = _normalized_name,
        current_revision = _next_revision,
        record_revision = record_revision + 1,
        last_mutation_channel = _mutation_channel,
        last_actor_type = _actor_type,
        client_mutation_id = _mutation_id
    WHERE id = _template.id AND owner_id = _owner_id
    RETURNING * INTO _template;
  END IF;

  INSERT INTO public.tasks_template_revisions (
    owner_id, template_id, revision, name, source_type, source_id,
    source_revision, anchor_date, snapshot, client_mutation_id, created_at
  ) VALUES (
    _owner_id, _template.id, _next_revision, _normalized_name,
    _source_type, _source_id, _source_revision, _anchor_date,
    _snapshot, _mutation_id, _timestamp
  ) RETURNING * INTO _revision;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'template', to_jsonb(_template) - 'owner_id',
    'revision', to_jsonb(_revision) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_capture_template(
  uuid, text, uuid, text, date, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_capture_template(
  uuid, text, uuid, text, date, uuid, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_archive_template(
  _template_id uuid,
  _expected_record_revision bigint,
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
  _template public.tasks_templates;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to archive templates'
      USING ERRCODE = '42501';
  END IF;
  SELECT template.* INTO _template
  FROM public.tasks_templates AS template
  WHERE template.id = _template_id AND template.owner_id = _owner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The template is unavailable' USING ERRCODE = '22023';
  END IF;
  IF _template.archived_at IS NOT NULL THEN
    IF _template.client_mutation_id = _mutation_id THEN
      RETURN jsonb_build_object(
        'outcome', 'already_applied',
        'template', to_jsonb(_template) - 'owner_id'
      );
    END IF;
    RAISE EXCEPTION 'The template is already archived' USING ERRCODE = '23514';
  END IF;
  IF _template.record_revision <> _expected_record_revision THEN
    RETURN jsonb_build_object(
      'outcome', 'conflict',
      'template', to_jsonb(_template) - 'owner_id'
    );
  END IF;
  UPDATE public.tasks_templates
  SET archived_at = clock_timestamp(),
      record_revision = record_revision + 1,
      last_mutation_channel = _mutation_channel,
      last_actor_type = _actor_type,
      client_mutation_id = _mutation_id
  WHERE id = _template_id AND owner_id = _owner_id
  RETURNING * INTO _template;
  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'template', to_jsonb(_template) - 'owner_id'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_archive_template(uuid, bigint, uuid, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_archive_template(uuid, bigint, uuid, text, text)
TO authenticated;

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
  _destination text := _source_destination;
  _today_section text := COALESCE(_source_today_section, 'daytime');
  _start_date date := CASE WHEN _start_offset_days IS NULL
    THEN NULL ELSE _anchor_date + _start_offset_days END;
  _deadline date := CASE WHEN _deadline_offset_days IS NULL
    THEN NULL ELSE _anchor_date + _deadline_offset_days END;
BEGIN
  IF _destination = 'inbox' THEN
    IF NOT _allow_inbox THEN
      RAISE EXCEPTION 'Project templates cannot use Inbox planning'
        USING ERRCODE = '22023';
    END IF;
    _start_date := NULL;
    _today_section := 'daytime';
  ELSIF _destination = 'someday' THEN
    _start_date := NULL;
    _today_section := 'daytime';
  ELSIF _destination = 'today' THEN
    _start_date := COALESCE(_start_date, _anchor_date);
    IF _start_date IS DISTINCT FROM _planning_date THEN
      _destination := 'anytime';
      _today_section := 'daytime';
    END IF;
  ELSIF _destination = 'anytime' THEN
    _today_section := 'daytime';
  ELSE
    RAISE EXCEPTION 'Template planning destination is invalid'
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
  _heading_map jsonb := '{}'::jsonb;
  _task_map jsonb := '{}'::jsonb;
  _checklist_map jsonb := '{}'::jsonb;
  _heading_ids jsonb := '[]'::jsonb;
  _task_ids jsonb := '[]'::jsonb;
  _checklist_ids jsonb := '[]'::jsonb;
  _generated_id uuid;
  _project_id uuid;
  _task_id uuid;
  _heading_id uuid;
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
      FROM jsonb_array_elements(_revision_record.snapshot -> 'headings')
    LOOP
      _generated_id := gen_random_uuid();
      _heading_map := _heading_map || jsonb_build_object(
        _node ->> 'node_id', _generated_id
      );
      _heading_ids := _heading_ids || jsonb_build_array(_generated_id);
    END LOOP;
    FOR _node IN SELECT value
      FROM jsonb_array_elements(_revision_record.snapshot -> 'todos')
    LOOP
      _generated_id := gen_random_uuid();
      _task_map := _task_map || jsonb_build_object(
        _node ->> 'node_id', _generated_id
      );
      _task_ids := _task_ids || jsonb_build_array(_generated_id);
      FOR _child IN SELECT value
        FROM jsonb_array_elements(_node -> 'checklist')
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
      'heading_ids', _heading_ids,
      'task_ids', _task_ids,
      'checklist_item_ids', _checklist_ids
    );
  ELSE
    _task_id := _root_id;
    _task_ids := jsonb_build_array(_task_id);
    FOR _child IN SELECT value
      FROM jsonb_array_elements(_root -> 'checklist')
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
      'heading_ids', '[]'::jsonb,
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
      FROM jsonb_array_elements(_revision_record.snapshot -> 'headings')
    LOOP
      _heading_id := (_heading_map ->> (_node ->> 'node_id'))::uuid;
      INSERT INTO public.tasks_headings (
        id, owner_id, project_id, title, order_key, disposition,
        entry_channel, last_mutation_channel, last_actor_type, revision,
        client_mutation_id, created_at, updated_at, template_definition_id,
        template_revision, template_instantiation_id, template_node_id
      ) VALUES (
        _heading_id, _owner_id, _project_id, _node ->> 'title',
        _node ->> 'order_key', 'present', _entry_channel, _entry_channel,
        _actor_type, 1, gen_random_uuid(), _timestamp, _timestamp,
        _template.id, _selected_revision, _instantiation.id,
        (_node ->> 'node_id')::uuid
      );
    END LOOP;

    FOR _node IN SELECT value
      FROM jsonb_array_elements(_revision_record.snapshot -> 'todos')
    LOOP
      _task_id := (_task_map ->> (_node ->> 'node_id'))::uuid;
      _heading_id := CASE WHEN _node ->> 'heading_node_id' IS NULL THEN NULL
        ELSE (_heading_map ->> (_node ->> 'heading_node_id'))::uuid END;
      _planning := tasks_private.resolve_template_planning(
        _node ->> 'destination', _node ->> 'today_section',
        (_node ->> 'start_offset_days')::integer,
        (_node ->> 'deadline_offset_days')::integer,
        _anchor_date, _planning_date, true
      );
      INSERT INTO public.tasks_todos (
        id, owner_id, project_id, heading_id, title, notes, lifecycle,
        disposition, destination, today_section, actionability, order_key,
        hierarchy_order_key, start_date, deadline, entry_channel,
        last_mutation_channel, last_actor_type, source_kind, source_title,
        source_external_id, revision, client_mutation_id, created_at, updated_at,
        template_definition_id, template_revision,
        template_instantiation_id, template_node_id
      ) VALUES (
        _task_id, _owner_id, _project_id, _heading_id, _node ->> 'title',
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
      FOR _child IN SELECT value FROM jsonb_array_elements(_node -> 'checklist')
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
    FOR _child IN SELECT value FROM jsonb_array_elements(_root -> 'checklist')
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

CREATE OR REPLACE FUNCTION tasks_private.export_v8_as_v7(_envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events'
  ];
  _collection text;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
BEGIN
  FOREACH _collection IN ARRAY _collections LOOP
    _data := _data || jsonb_build_object(
      _collection, _envelope #> ARRAY['data', _collection]
    );
    _counts := _counts || jsonb_build_object(
      _collection, _envelope #> ARRAY['manifest', 'counts', _collection]
    );
    _checksums := _checksums || jsonb_build_object(
      _collection, _envelope #> ARRAY['manifest', 'checksums', _collection]
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 7,
    'created_at', _envelope -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections),
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  );
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.export_v8_as_v7(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.validate_export_v8(_envelope jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations'
  ];
  _records jsonb;
BEGIN
  IF jsonb_typeof(_envelope) IS DISTINCT FROM 'object'
    OR _envelope ->> 'format' IS DISTINCT FROM 'garden.bath.tasks.export'
    OR COALESCE(_envelope ->> 'schema_version', '') !~ '^[0-9]+$'
    OR (_envelope ->> 'schema_version')::integer <> 8
    OR _envelope #> '{manifest,collections}' IS DISTINCT FROM to_jsonb(_collections)
    OR _envelope #>> '{manifest,checksums,algorithm}' IS DISTINCT FROM 'sha256' THEN
    RAISE EXCEPTION 'Invalid task export v8 envelope' USING ERRCODE = '22023';
  END IF;

  FOREACH _collection IN ARRAY _collections LOOP
    _records := _envelope #> ARRAY['data', _collection];
    IF jsonb_typeof(_records) IS DISTINCT FROM 'array'
      OR COALESCE(_envelope #>> ARRAY['manifest', 'counts', _collection], '')
        !~ '^[0-9]+$'
      OR (_envelope #>> ARRAY['manifest', 'counts', _collection])::integer
        <> jsonb_array_length(_records)
      OR _envelope #>> ARRAY['manifest', 'checksums', _collection]
        IS DISTINCT FROM tasks_private.export_checksum(_records)
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(_records) AS record(value)
        WHERE jsonb_typeof(record.value) IS DISTINCT FROM 'object'
          OR NOT (record.value ? 'id')
          OR record.value ? 'owner_id'
      ) THEN
      RAISE EXCEPTION 'Task export v8 collection % is invalid', _collection
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  PERFORM tasks_private.validate_export_v7(
    tasks_private.export_v8_as_v7(_envelope)
  );

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_envelope #> '{data,tasks_templates}') AS template(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        _envelope #> '{data,tasks_template_revisions}'
      ) AS revision(value)
      WHERE revision.value ->> 'template_id' = template.value ->> 'id'
        AND revision.value ->> 'revision' = template.value ->> 'current_revision'
        AND revision.value ->> 'source_type' = template.value ->> 'kind'
    )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      _envelope #> '{data,tasks_template_revisions}'
    ) AS revision(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(_envelope #> '{data,tasks_templates}') AS template(value)
      WHERE template.value ->> 'id' = revision.value ->> 'template_id'
        AND template.value ->> 'kind' = revision.value ->> 'source_type'
    )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      _envelope #> '{data,tasks_template_instantiations}'
    ) AS instance(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        _envelope #> '{data,tasks_template_revisions}'
      ) AS revision(value)
      WHERE revision.value ->> 'template_id' = instance.value ->> 'template_id'
        AND revision.value ->> 'revision' = instance.value ->> 'template_revision'
        AND revision.value ->> 'source_type' = instance.value ->> 'root_type'
    )
  ) THEN
    RAISE EXCEPTION 'Task export v8 contains an invalid template revision graph'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_todos}')
      UNION ALL
      SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_projects}')
      UNION ALL
      SELECT value FROM jsonb_array_elements(_envelope #> '{data,tasks_headings}')
      UNION ALL
      SELECT value FROM jsonb_array_elements(
        _envelope #> '{data,tasks_checklist_items}'
      )
    ) AS generated(value)
    WHERE (
      generated.value ->> 'template_definition_id' IS NULL
      AND (
        generated.value ->> 'template_revision' IS NOT NULL
        OR generated.value ->> 'template_instantiation_id' IS NOT NULL
        OR generated.value ->> 'template_node_id' IS NOT NULL
      )
    ) OR (
      generated.value ->> 'template_definition_id' IS NOT NULL
      AND (
        generated.value ->> 'template_revision' IS NULL
        OR generated.value ->> 'template_instantiation_id' IS NULL
        OR generated.value ->> 'template_node_id' IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            _envelope #> '{data,tasks_template_instantiations}'
          ) AS instance(value)
          WHERE instance.value ->> 'id'
              = generated.value ->> 'template_instantiation_id'
            AND instance.value ->> 'template_id'
              = generated.value ->> 'template_definition_id'
            AND instance.value ->> 'template_revision'
              = generated.value ->> 'template_revision'
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Task export v8 contains invalid generated-work provenance'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.validate_export_v8(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_create_export_v8()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _base jsonb;
  _data jsonb;
  _manifest jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _records jsonb;
  _collection text;
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_headings', 'tasks_todos',
    'tasks_checklist_items', 'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings', 'tasks_mail_sources',
    'tasks_mail_source_events', 'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations'
  ];
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to export task data'
      USING ERRCODE = '42501';
  END IF;
  _base := public.tasks_create_export_v7();
  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(template_row) - 'owner_id'
      ORDER BY template_row.kind, lower(template_row.name), template_row.id
    ),
    '[]'::jsonb
  ) INTO _records
  FROM public.tasks_templates AS template_row
  WHERE template_row.owner_id = _owner_id;
  _data := (_base -> 'data') || jsonb_build_object('tasks_templates', _records);

  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(revision_row) - 'owner_id'
      ORDER BY revision_row.template_id, revision_row.revision
    ),
    '[]'::jsonb
  ) INTO _records
  FROM public.tasks_template_revisions AS revision_row
  WHERE revision_row.owner_id = _owner_id;
  _data := _data || jsonb_build_object('tasks_template_revisions', _records);

  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(instance_row) - 'owner_id'
      ORDER BY instance_row.created_at, instance_row.id
    ),
    '[]'::jsonb
  ) INTO _records
  FROM public.tasks_template_instantiations AS instance_row
  WHERE instance_row.owner_id = _owner_id;
  _data := _data || jsonb_build_object('tasks_template_instantiations', _records);

  FOREACH _collection IN ARRAY _collections LOOP
    _records := _data -> _collection;
    _counts := _counts || jsonb_build_object(
      _collection, jsonb_array_length(_records)
    );
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;
  _manifest := jsonb_build_object(
    'collections', to_jsonb(_collections),
    'counts', _counts,
    'checksums', _checksums
  );
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 8,
    'created_at', _base -> 'created_at',
    'manifest', _manifest,
    'data', _data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_create_export_v8() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_create_export_v8() TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_restore_export_v8(
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
  _v7 jsonb;
  _report jsonb;
  _collection text;
  _table regclass;
  _collection_report jsonb;
  _template_collections constant text[] := ARRAY[
    'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations'
  ];
  _template_conflicts bigint := 0;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to restore task data'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v8(_envelope);
  _v7 := tasks_private.export_v8_as_v7(_envelope);
  _report := public.tasks_restore_export_v7(_v7, true)
    || jsonb_build_object('schema_version', 8, 'dry_run', _dry_run);

  FOREACH _collection IN ARRAY _template_collections LOOP
    _table := ('public.' || _collection)::regclass;
    _collection_report := tasks_private.classify_restore_v4_collection(
      _owner_id,
      _table,
      _envelope #> ARRAY['data', _collection],
      true
    );
    _report := _report || jsonb_build_object(_collection, _collection_report);
    _template_conflicts := _template_conflicts
      + (_collection_report ->> 'conflicts')::bigint;
  END LOOP;

  IF NOT _dry_run AND _template_conflicts = 0 THEN
    FOREACH _collection IN ARRAY _template_collections LOOP
      _table := ('public.' || _collection)::regclass;
      PERFORM tasks_private.insert_restore_v4_collection(
        _owner_id,
        _table,
        _envelope #> ARRAY['data', _collection],
        _report -> _collection
      );
    END LOOP;
    _report := public.tasks_restore_export_v7(_v7, false)
      || (_report - 'schema_version' - 'dry_run')
      || jsonb_build_object('schema_version', 8, 'dry_run', false, 'applied', true);
  ELSE
    _report := _report || jsonb_build_object(
      'applied', false,
      'code', CASE WHEN _template_conflicts > 0
        THEN 'template_conflict' ELSE NULL END
    );
  END IF;
  RETURN _report;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_restore_export_v8(jsonb, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_restore_export_v8(jsonb, boolean)
TO authenticated;
