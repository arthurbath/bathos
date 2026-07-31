BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'a7000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'automatic-sort@example.test', '', now(),
  '{}', '{}', now(), now()
);

SELECT has_column(
  'public',
  'tasks_user_settings',
  'automatic_list_sorting',
  'adds the synchronized automatic list sorting preference'
);
SELECT col_type_is(
  'public',
  'tasks_user_settings',
  'automatic_list_sorting',
  'boolean',
  'stores automatic list sorting as a boolean'
);
SELECT col_default_is(
  'public',
  'tasks_user_settings',
  'automatic_list_sorting',
  'false',
  'defaults automatic list sorting to off'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true
);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'a7000000-0000-4000-8000-000000000010',
  'a7000000-0000-4000-8000-000000000001',
  'America/Los_Angeles',
  'a7000000-0000-4000-8000-000000000011'
);

SELECT is(
  (
    SELECT automatic_list_sorting
    FROM public.tasks_user_settings
    WHERE owner_id = 'a7000000-0000-4000-8000-000000000001'
  ),
  false,
  'initializes an existing owner workflow with sorting off'
);

UPDATE public.tasks_user_settings
SET
  automatic_list_sorting = true,
  revision = revision + 1,
  client_mutation_id = 'a7000000-0000-4000-8000-000000000012'
WHERE owner_id = 'a7000000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT automatic_list_sorting
    FROM public.tasks_user_settings
    WHERE owner_id = 'a7000000-0000-4000-8000-000000000001'
  ),
  true,
  'allows the owner to enable automatic sorting'
);
SELECT is(
  public.tasks_create_export_v14()
    #>> '{data,tasks_user_settings,0,automatic_list_sorting}',
  'true',
  'includes the preference in current portable exports'
);

RESET ROLE;
SELECT is(
  tasks_private.normalize_export_v12_record(
    'tasks_user_settings',
    jsonb_build_object(
      'id', 'a7000000-0000-4000-8000-000000000010',
      'planning_timezone', 'America/Los_Angeles',
      'revision', 1,
      'client_mutation_id', 'a7000000-0000-4000-8000-000000000011',
      'created_at', clock_timestamp(),
      'updated_at', clock_timestamp()
    ),
    CURRENT_DATE
  ) ->> 'automatic_list_sorting',
  'false',
  'upgrades older portable settings records with sorting off'
);

SELECT * FROM finish();
ROLLBACK;
