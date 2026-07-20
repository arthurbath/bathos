BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(19);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '61000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'timezone-owner-a@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '62000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'timezone-owner-b@example.test', '', now(),
    '{}', '{}', now(), now()
  );

SELECT has_table('public', 'tasks_user_settings', 'creates owner task settings');
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tasks_user_settings'::regclass),
  true,
  'enables RLS for owner task settings'
);
SELECT has_index(
  'public',
  'tasks_user_settings',
  'tasks_user_settings_owner_idx',
  'indexes task settings by owner'
);
SELECT has_trigger(
  'public',
  'tasks_user_settings',
  'tasks_user_settings_prepare_write',
  'validates planning setting writes'
);
SELECT has_function('public', 'tasks_create_export_v2', ARRAY[]::text[], 'exports schema version two');
SELECT has_function(
  'public',
  'tasks_restore_export_v2',
  ARRAY['jsonb', 'boolean'],
  'restores schema version two'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.tasks_user_settings', 'SELECT'),
  'grants authenticated owners settings reads'
);
SELECT is(
  has_table_privilege('authenticated', 'public.tasks_user_settings', 'DELETE'),
  false,
  'withholds hard deletion of task settings from authenticated clients'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_user_settings (
      id, owner_id, planning_timezone, client_mutation_id
    )
    VALUES (
      '61000000-0000-4000-8000-000000000010',
      '61000000-0000-4000-8000-000000000001',
      'America/Los_Angeles',
      '61000000-0000-4000-8000-000000000020'
    )
  $$,
  'stores a recognized IANA planning time zone'
);
SELECT throws_ok(
  $$
    INSERT INTO public.tasks_user_settings (
      id, owner_id, planning_timezone, client_mutation_id
    )
    VALUES (
      '61000000-0000-4000-8000-000000000011',
      '61000000-0000-4000-8000-000000000001',
      'Not/A_Time_Zone',
      '61000000-0000-4000-8000-000000000021'
    )
  $$,
  '23514',
  'Task planning time zone is not recognized',
  'rejects an unrecognized planning time zone'
);
SELECT throws_ok(
  $$
    UPDATE public.tasks_user_settings
    SET
      planning_timezone = 'America/New_York',
      client_mutation_id = '61000000-0000-4000-8000-000000000022'
    WHERE id = '61000000-0000-4000-8000-000000000010'
  $$,
  '23514',
  'Task planning setting revision must advance by exactly one',
  'requires an optimistic revision advance for setting changes'
);

SELECT set_config('test.tasks_export_v2', public.tasks_create_export_v2()::text, false);
SELECT is(
  (current_setting('test.tasks_export_v2')::jsonb ->> 'schema_version')::integer,
  2,
  'bumps the portable export schema for owner settings'
);
SELECT is(
  (
    current_setting('test.tasks_export_v2')::jsonb
    #>> '{manifest,counts,tasks_user_settings}'
  )::integer,
  1,
  'includes the owner planning setting in the manifest'
);
SELECT is(
  jsonb_path_exists(
    current_setting('test.tasks_export_v2')::jsonb,
    '$.data.tasks_user_settings[*].owner_id'
  ),
  false,
  'does not export the settings owner identifier'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  (SELECT count(*) FROM public.tasks_user_settings),
  0::bigint,
  'does not expose another owner planning setting'
);

RESET ROLE;
DELETE FROM public.tasks_user_settings
WHERE owner_id = '61000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  (
    public.tasks_restore_export_v2(
      current_setting('test.tasks_export_v2')::jsonb,
      true
    ) #>> '{tasks_user_settings,inserts}'
  )::integer,
  1,
  'previews owner-rebound planning setting restore'
);
SELECT is(
  (
    public.tasks_restore_export_v2(
      current_setting('test.tasks_export_v2')::jsonb,
      false
    ) #>> '{tasks_user_settings,inserts}'
  )::integer,
  1,
  'restores the planning setting with the task envelope'
);
SELECT is(
  (
    SELECT planning_timezone
    FROM public.tasks_user_settings
    WHERE owner_id = '62000000-0000-4000-8000-000000000002'
  ),
  'America/Los_Angeles',
  'rebinds the restored planning time zone to the authenticated owner'
);
SELECT is(
  (
    public.tasks_restore_export_v2(
      current_setting('test.tasks_export_v2')::jsonb,
      true
    ) #>> '{tasks_user_settings,matches}'
  )::integer,
  1,
  'treats an exact planning setting restore retry as a match'
);

SELECT * FROM finish();
ROLLBACK;
