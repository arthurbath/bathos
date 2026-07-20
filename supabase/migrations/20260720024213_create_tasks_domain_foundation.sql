-- Personal Tasks domain foundation for the Capture and Run Today slice

CREATE TABLE public.tasks_todos (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  lifecycle text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  canceled_at timestamptz,
  disposition text NOT NULL DEFAULT 'present',
  deleted_at timestamptz,
  destination text NOT NULL DEFAULT 'inbox',
  order_key text NOT NULL,
  entry_channel text NOT NULL DEFAULT 'web',
  source_kind text,
  source_url text,
  source_title text,
  source_external_id text,
  revision bigint NOT NULL DEFAULT 1,
  client_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_todos_id_owner_key UNIQUE (id, owner_id),
  CONSTRAINT tasks_todos_title_valid CHECK (
    btrim(title) <> ''
    AND char_length(title) <= 500
  ),
  CONSTRAINT tasks_todos_lifecycle_valid CHECK (
    lifecycle IN ('open', 'completed', 'canceled')
  ),
  CONSTRAINT tasks_todos_lifecycle_timestamps_valid CHECK (
    (lifecycle = 'open' AND completed_at IS NULL AND canceled_at IS NULL)
    OR (lifecycle = 'completed' AND completed_at IS NOT NULL AND canceled_at IS NULL)
    OR (lifecycle = 'canceled' AND canceled_at IS NOT NULL AND completed_at IS NULL)
  ),
  CONSTRAINT tasks_todos_disposition_valid CHECK (
    disposition IN ('present', 'deleted')
  ),
  CONSTRAINT tasks_todos_disposition_timestamp_valid CHECK (
    (disposition = 'present' AND deleted_at IS NULL)
    OR (disposition = 'deleted' AND deleted_at IS NOT NULL)
  ),
  CONSTRAINT tasks_todos_destination_valid CHECK (
    destination IN ('inbox', 'today')
  ),
  CONSTRAINT tasks_todos_order_key_valid CHECK (
    btrim(order_key) <> ''
    AND char_length(order_key) <= 255
  ),
  CONSTRAINT tasks_todos_entry_channel_valid CHECK (
    entry_channel IN (
      'web',
      'raycast',
      'mcp',
      'mail_automation',
      'browser_capture',
      'native',
      'import'
    )
  ),
  CONSTRAINT tasks_todos_source_kind_valid CHECK (
    source_kind IS NULL
    OR source_kind IN (
      'webpage',
      'mail_message',
      'file',
      'selected_text',
      'reading_item',
      'template',
      'other'
    )
  ),
  CONSTRAINT tasks_todos_source_fields_valid CHECK (
    source_kind IS NOT NULL
    OR (
      source_url IS NULL
      AND source_title IS NULL
      AND source_external_id IS NULL
    )
  ),
  CONSTRAINT tasks_todos_web_source_url_valid CHECK (
    source_kind NOT IN ('webpage', 'reading_item')
    OR NULLIF(btrim(source_url), '') IS NOT NULL
  ),
  CONSTRAINT tasks_todos_source_title_valid CHECK (
    source_title IS NULL
    OR char_length(source_title) <= 1000
  ),
  CONSTRAINT tasks_todos_revision_valid CHECK (revision > 0)
);

ALTER TABLE public.tasks_todos REPLICA IDENTITY FULL;
ALTER TABLE public.tasks_todos ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX tasks_todos_client_mutation_key
ON public.tasks_todos (client_mutation_id);

CREATE INDEX tasks_todos_owner_updated_idx
ON public.tasks_todos (owner_id, updated_at DESC, id);

CREATE INDEX tasks_todos_owner_active_destination_order_idx
ON public.tasks_todos (owner_id, destination, order_key, id)
WHERE disposition = 'present' AND lifecycle = 'open';

CREATE INDEX tasks_todos_owner_logbook_idx
ON public.tasks_todos (
  owner_id,
  COALESCE(completed_at, canceled_at) DESC,
  id
)
WHERE disposition = 'present' AND lifecycle IN ('completed', 'canceled');

CREATE INDEX tasks_todos_owner_trash_idx
ON public.tasks_todos (owner_id, deleted_at DESC, id)
WHERE disposition = 'deleted';

CREATE INDEX tasks_todos_owner_source_external_idx
ON public.tasks_todos (owner_id, source_kind, source_external_id)
WHERE source_external_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tasks_prepare_todo_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Task identifier is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Task owner is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Task creation time is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.entry_channel IS DISTINCT FROM OLD.entry_channel THEN
    RAISE EXCEPTION 'Task entry channel is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Task revision must increment by exactly one'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.client_mutation_id = OLD.client_mutation_id THEN
    RAISE EXCEPTION 'Task updates require a new client mutation identifier'
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_prepare_todo_update() FROM PUBLIC;

CREATE TRIGGER tasks_todos_prepare_update
BEFORE UPDATE ON public.tasks_todos
FOR EACH ROW
EXECUTE FUNCTION public.tasks_prepare_todo_update();

CREATE POLICY "Task owners can view their to-dos"
ON public.tasks_todos
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Task owners can create their to-dos"
ON public.tasks_todos
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Task owners can update their to-dos"
ON public.tasks_todos
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.tasks_todos FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tasks_todos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks_todos TO service_role;
