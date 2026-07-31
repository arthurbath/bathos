BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(16);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'dc000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'current-export@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    'dc000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'legacy-restore@example.test', '', now(),
    '{}', '{}', now(), now()
  );

SELECT has_function(
  'public', 'tasks_create_export_v14', ARRAY[]::text[],
  'creates the current schema-fourteen export'
);
SELECT has_function(
  'public', 'tasks_restore_export_current', ARRAY['jsonb', 'boolean'],
  'restores supported exports through the current contract'
);
SELECT has_function(
  'public', 'tasks_replace_restore_v14', ARRAY['jsonb', 'text', 'uuid', 'text'],
  'keeps guarded replacement restore versioned with the current export'
);
SELECT hasnt_table('public', 'tasks_projects', 'removes Project persistence');
SELECT hasnt_column(
  'public', 'tasks_todos', 'project_id',
  'removes Project assignment from tasks'
);
SELECT is(
  has_function_privilege(
    'anon', 'public.tasks_restore_export_current(jsonb,boolean)', 'EXECUTE'
  ),
  false,
  'withholds current restore from anonymous callers'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000001', true
);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'dc000000-0000-4000-8000-000000000010',
  'dc000000-0000-4000-8000-000000000001',
  'America/Los_Angeles',
  'dc000000-0000-4000-8000-000000000011'
);
INSERT INTO public.tasks_areas (
  id, owner_id, title, order_key, client_mutation_id
) VALUES (
  'dc000000-0000-4000-8000-000000000012',
  'dc000000-0000-4000-8000-000000000001',
  'Legacy fixture area', 'a0',
  'dc000000-0000-4000-8000-000000000013'
);
INSERT INTO public.tasks_todos (
  id, owner_id, area_id, title, destination, start_date,
  order_key, hierarchy_order_key, client_mutation_id
) VALUES (
  'dc000000-0000-4000-8000-000000000020',
  'dc000000-0000-4000-8000-000000000001',
  'dc000000-0000-4000-8000-000000000012',
  'Current capture', 'anytime', DATE '2099-07-22', 'a0', 'a0',
  'dc000000-0000-4000-8000-000000000021'
);

SELECT set_config(
  'test.tasks_export_v14',
  public.tasks_create_export_v14()::text,
  false
);
SELECT is(
  (current_setting('test.tasks_export_v14')::jsonb
    ->> 'schema_version')::integer,
  14,
  'emits schema version fourteen'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.tasks_export_v14')::jsonb
      #> '{manifest,collections}'
  ),
  16,
  'declares exactly the project-free and template-free portable collections'
);
SELECT ok(
  NOT (
    current_setting('test.tasks_export_v14')::jsonb
      #> '{manifest,collections}'
    @> '["tasks_projects"]'::jsonb
  ),
  'keeps Projects out of the current export manifest'
);

RESET ROLE;
DO $fixture$
DECLARE
  _legacy jsonb;
  _projects jsonb := jsonb_build_array(jsonb_build_object(
    'id', 'dc000000-0000-4000-8000-000000000030',
    'area_id', 'dc000000-0000-4000-8000-000000000012',
    'title', 'Disposable legacy wrapper',
    'notes', '',
    'destination', 'anytime',
    'today_section', NULL,
    'start_date', NULL,
    'deadline_date', NULL,
    'lifecycle', 'open',
    'completed_at', NULL,
    'disposition', 'present',
    'deleted_at', NULL,
    'deletion_root_id', NULL,
    'order_key', 'a0',
    'planning_order_key', 'a0',
    'revision', 1,
    'client_mutation_id', 'dc000000-0000-4000-8000-000000000031',
    'last_mutation_channel', 'import',
    'last_actor_type', 'import',
    'undo_source_event_id', NULL,
    'template_instantiation_id', NULL,
    'template_node_id', NULL,
    'recurrence_occurrence_id', NULL,
    'recurrence_logical_key', NULL,
    'created_at', '2099-07-20T00:00:00+00:00',
    'updated_at', '2099-07-20T00:00:00+00:00'
  ));
  _todos jsonb;
BEGIN
  _legacy := tasks_private.export_v13_as_v12_for_validation(
    current_setting('test.tasks_export_v14')::jsonb
  );
  _legacy := jsonb_set(_legacy, '{data,tasks_projects}', _projects);
  _legacy := jsonb_set(_legacy, '{manifest,counts,tasks_projects}', '1'::jsonb);
  _legacy := jsonb_set(
    _legacy, '{manifest,checksums,tasks_projects}',
    to_jsonb(tasks_private.export_checksum(_projects))
  );
  _todos := jsonb_set(
    jsonb_set(
      _legacy #> '{data,tasks_todos}',
      '{0,project_id}',
      '"dc000000-0000-4000-8000-000000000030"'::jsonb
    ),
    '{0,area_id}',
    'null'::jsonb
  );
  _legacy := jsonb_set(_legacy, '{data,tasks_todos}', _todos);
  _legacy := jsonb_set(
    _legacy, '{manifest,checksums,tasks_todos}',
    to_jsonb(tasks_private.export_checksum(_todos))
  );
  PERFORM tasks_private.validate_export_v12(_legacy);
  PERFORM set_config('test.tasks_export_v12_fixture', _legacy::text, false);
END;
$fixture$;

SELECT is(
  (current_setting('test.tasks_export_v12_fixture')::jsonb
    #>> '{manifest,counts,tasks_projects}')::integer,
  1,
  'builds a checksum-valid schema-twelve Project fixture'
);

SELECT set_config('request.jwt.claim.sub', '', true);
DELETE FROM auth.users
WHERE id = 'dc000000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub', 'dc000000-0000-4000-8000-000000000002', true
);

SELECT throws_ok(
  format(
    'SELECT public.tasks_restore_export_current(%L::jsonb, true)',
    jsonb_set(
      current_setting('test.tasks_export_v12_fixture')::jsonb,
      '{data,tasks_todos,0,title}', '"Tampered"'::jsonb
    )::text
  ),
  '22023',
  'Task export v12 collection tasks_todos is invalid',
  'rejects a tampered legacy fixture before normalization'
);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_export_v12_fixture')::jsonb, true
    ) #>> '{tasks_todos,inserts}'
  )::integer,
  1,
  'previews the legacy Project child as one direct task insert'
);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_export_v12_fixture')::jsonb, false
    ) ->> 'applied'
  )::boolean,
  true,
  'applies the normalized schema-twelve fixture'
);
SELECT is(
  (SELECT area_id FROM public.tasks_todos
    WHERE id = 'dc000000-0000-4000-8000-000000000020'),
  'dc000000-0000-4000-8000-000000000012'::uuid,
  'maps the legacy Project Area directly onto the restored task'
);
SELECT is(
  (SELECT start_date FROM public.tasks_todos
    WHERE id = 'dc000000-0000-4000-8000-000000000020'),
  DATE '2099-07-22',
  'preserves non-Project task planning data'
);
SELECT is(
  public.tasks_restore_export_current(
    current_setting('test.tasks_export_v12_fixture')::jsonb, false
  ) ->> 'code',
  'already_applied',
  'keeps normalized legacy replay idempotent'
);

SELECT * FROM finish();
ROLLBACK;
