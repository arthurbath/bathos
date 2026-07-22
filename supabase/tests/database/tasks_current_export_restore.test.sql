BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(14);

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
  'public', 'tasks_create_export_v11', ARRAY[]::text[],
  'creates the current schema-eleven export'
);
SELECT has_function(
  'public', 'tasks_restore_export_current', ARRAY['jsonb', 'boolean'],
  'restores every supported export through the current planning contract'
);
SELECT has_function(
  'public', 'tasks_replace_restore_v11',
  ARRAY['jsonb', 'text', 'uuid', 'text'],
  'keeps guarded replacement restore versioned with the current export'
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
INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, today_section, order_key,
  client_mutation_id
) VALUES (
  'dc000000-0000-4000-8000-000000000020',
  'dc000000-0000-4000-8000-000000000001',
  'Current capture', 'anytime', 'later', 'a0',
  'dc000000-0000-4000-8000-000000000021'
);

SELECT set_config('test.tasks_export_v11', public.tasks_create_export_v11()::text, false);

SELECT is(
  (current_setting('test.tasks_export_v11')::jsonb ->> 'schema_version')::integer,
  11,
  'emits schema version eleven'
);
SELECT is(
  current_setting('test.tasks_export_v11')::jsonb
    #>> '{data,tasks_todos,0,destination}',
  'anytime',
  'emits the current active planning destination'
);
SELECT is(
  current_setting('test.tasks_export_v11')::jsonb
    #>> '{data,tasks_todos,0,today_section}',
  'later',
  'emits the current Today membership value'
);
SELECT is(
  current_setting('test.tasks_export_v11')::jsonb::text
    ~ '"(destination|today_section)": "(inbox|today|daytime|evening)"',
  false,
  'does not emit retired planning vocabulary anywhere in the envelope'
);

RESET ROLE;

DO $legacy$
DECLARE
  _legacy jsonb;
  _records jsonb;
BEGIN
  _legacy := jsonb_set(
    current_setting('test.tasks_export_v11')::jsonb,
    '{schema_version}',
    '10'::jsonb
  );
  _legacy := jsonb_set(_legacy, '{data,tasks_todos,0,destination}', '"inbox"'::jsonb);
  _legacy := jsonb_set(_legacy, '{data,tasks_todos,0,today_section}', '"daytime"'::jsonb);
  _records := _legacy #> '{data,tasks_todos}';
  _legacy := jsonb_set(
    _legacy,
    '{manifest,checksums,tasks_todos}',
    to_jsonb(tasks_private.export_checksum(_records))
  );
  PERFORM set_config('test.tasks_export_v10_legacy', _legacy::text, false);
END;
$legacy$;

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
      current_setting('test.tasks_export_v10_legacy')::jsonb,
      '{data,tasks_todos,0,title}',
      '"Tampered"'::jsonb
    )::text
  ),
  '22023',
  'Task export v10 collection tasks_todos is invalid',
  'rejects a tampered legacy export before normalization'
);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_export_v10_legacy')::jsonb,
      true
    ) #>> '{tasks_todos,inserts}'
  )::integer,
  1,
  'previews the checksum-verified legacy task as one insert'
);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_export_v10_legacy')::jsonb,
      false
    ) ->> 'applied'
  )::boolean,
  true,
  'applies the normalized legacy export'
);
SELECT is(
  (
    SELECT destination FROM public.tasks_todos
    WHERE id = 'dc000000-0000-4000-8000-000000000020'
  ),
  'anytime',
  'normalizes legacy Inbox to Anytime'
);
SELECT is(
  (
    SELECT today_section FROM public.tasks_todos
    WHERE id = 'dc000000-0000-4000-8000-000000000020'
  ),
  'inbox',
  'normalizes legacy Inbox to Today Inbox'
);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_export_v10_legacy')::jsonb,
      false
    ) ->> 'code'
  ),
  'already_applied',
  'keeps normalized legacy replay idempotent'
);

SELECT * FROM finish();
ROLLBACK;
