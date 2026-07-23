BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(18);

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
  'public', 'tasks_create_export_v12', ARRAY[]::text[],
  'creates the current schema-twelve export'
);
SELECT has_function(
  'public', 'tasks_restore_export_current', ARRAY['jsonb', 'boolean'],
  'restores supported exports through the current planning contract'
);
SELECT has_function(
  'public', 'tasks_replace_restore_v12', ARRAY['jsonb', 'text', 'uuid', 'text'],
  'keeps guarded replacement restore versioned with the current export'
);
SELECT hasnt_table('public', 'tasks_headings', 'keeps headings out of current persistence');
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
INSERT INTO public.tasks_projects (
  id, owner_id, title, destination, start_date, today_section,
  order_key, planning_order_key, client_mutation_id
) VALUES (
  'dc000000-0000-4000-8000-000000000012',
  'dc000000-0000-4000-8000-000000000001',
  'Legacy fixture project', 'anytime', DATE '2099-07-22', 'next',
  'a0', 'a0', 'dc000000-0000-4000-8000-000000000013'
);
INSERT INTO public.tasks_todos (
  id, owner_id, project_id, title, destination, today_section, start_date,
  order_key, hierarchy_order_key, client_mutation_id
) VALUES (
  'dc000000-0000-4000-8000-000000000020',
  'dc000000-0000-4000-8000-000000000001',
  'dc000000-0000-4000-8000-000000000012',
  'Current capture', 'anytime', 'later', DATE '2099-07-22', 'a0', 'a0',
  'dc000000-0000-4000-8000-000000000021'
);
SELECT public.tasks_capture_template(
  NULL, 'project', 'dc000000-0000-4000-8000-000000000012',
  'Legacy fixture template', DATE '2099-07-22',
  'dc000000-0000-4000-8000-000000000022'
);

SELECT set_config('test.tasks_export_v12', public.tasks_create_export_v12()::text, false);
SELECT is(
  (current_setting('test.tasks_export_v12')::jsonb ->> 'schema_version')::integer,
  12,
  'emits schema version twelve'
);
SELECT is(
  current_setting('test.tasks_export_v12')::jsonb
    #>> '{data,tasks_todos,0,today_section}',
  'later',
  'emits the current day horizon'
);
SELECT ok(
  NOT (current_setting('test.tasks_export_v12')::jsonb
    #> '{manifest,collections}' @> '["tasks_headings"]'::jsonb),
  'keeps headings out of the current export manifest'
);

RESET ROLE;
DO $fixture$
DECLARE
  _legacy jsonb;
  _headings jsonb := jsonb_build_array(jsonb_build_object(
    'id', 'dc000000-0000-4000-8000-000000000030',
    'project_id', 'dc000000-0000-4000-8000-000000000012'
  ));
  _todos jsonb;
  _template_revisions jsonb;
BEGIN
  _legacy := tasks_private.export_v12_as_v10_for_validation(
    current_setting('test.tasks_export_v12')::jsonb
  );
  _legacy := jsonb_set(_legacy, '{schema_version}', '11'::jsonb);
  _legacy := jsonb_set(_legacy, '{data,tasks_headings}', _headings);
  _legacy := jsonb_set(_legacy, '{manifest,counts,tasks_headings}', '1'::jsonb);
  _legacy := jsonb_set(
    _legacy, '{manifest,checksums,tasks_headings}',
    to_jsonb(tasks_private.export_checksum(_headings))
  );
  _todos := jsonb_set(
    _legacy #> '{data,tasks_todos}', '{0,heading_id}',
    '"dc000000-0000-4000-8000-000000000030"'::jsonb
  );
  _legacy := jsonb_set(_legacy, '{data,tasks_todos}', _todos);
  _legacy := jsonb_set(
    _legacy, '{manifest,checksums,tasks_todos}',
    to_jsonb(tasks_private.export_checksum(_todos))
  );
  _template_revisions := jsonb_set(
    _legacy #> '{data,tasks_template_revisions}',
    '{0,snapshot,headings}',
    '[{"node_id":"legacy-heading-node","title":"Legacy heading","order_key":"a0"}]'::jsonb,
    true
  );
  _template_revisions := jsonb_set(
    _template_revisions,
    '{0,snapshot,todos,0,heading_node_id}',
    '"legacy-heading-node"'::jsonb,
    true
  );
  _legacy := jsonb_set(
    _legacy, '{data,tasks_template_revisions}', _template_revisions
  );
  _legacy := jsonb_set(
    _legacy, '{manifest,checksums,tasks_template_revisions}',
    to_jsonb(tasks_private.export_checksum(_template_revisions))
  );
  PERFORM tasks_private.validate_export_v11(_legacy);
  PERFORM set_config('test.tasks_export_v11_fixture', _legacy::text, false);
END;
$fixture$;

SELECT is(
  (current_setting('test.tasks_export_v11_fixture')::jsonb
    #>> '{manifest,counts,tasks_headings}')::integer,
  1,
  'builds a checksum-valid schema-eleven heading fixture'
);
SELECT is(
  current_setting('test.tasks_export_v11_fixture')::jsonb
    #>> '{data,tasks_todos,0,heading_id}',
  'dc000000-0000-4000-8000-000000000030',
  'binds the legacy child task to the synthetic heading'
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
      current_setting('test.tasks_export_v11_fixture')::jsonb,
      '{data,tasks_todos,0,title}', '"Tampered"'::jsonb
    )::text
  ),
  '22023',
  'Task export v10 collection tasks_todos is invalid',
  'rejects a tampered schema-eleven fixture before normalization'
);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_export_v11_fixture')::jsonb, true
    ) #>> '{tasks_todos,inserts}'
  )::integer,
  1,
  'previews the legacy heading child as one flat task insert'
);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_export_v11_fixture')::jsonb, false
    ) ->> 'applied'
  )::boolean,
  true,
  'applies the normalized schema-eleven fixture'
);
SELECT is(
  (SELECT project_id FROM public.tasks_todos
    WHERE id = 'dc000000-0000-4000-8000-000000000020'),
  'dc000000-0000-4000-8000-000000000012'::uuid,
  'preserves the child task in its project while discarding its heading'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'dc000000-0000-4000-8000-000000000020'),
  'later',
  'preserves the legacy child day horizon'
);
SELECT ok(
  NOT ((SELECT snapshot FROM public.tasks_template_revisions LIMIT 1) ? 'headings'),
  'removes legacy heading nodes from the restored project template'
);
SELECT ok(
  NOT ((SELECT snapshot #> '{todos,0}' FROM public.tasks_template_revisions LIMIT 1)
    ? 'heading_node_id'),
  'preserves the legacy template task without its heading-node reference'
);
SELECT is(
  public.tasks_restore_export_current(
    current_setting('test.tasks_export_v11_fixture')::jsonb, false
  ) ->> 'code',
  'already_applied',
  'keeps normalized legacy replay idempotent'
);

SELECT * FROM finish();
ROLLBACK;
