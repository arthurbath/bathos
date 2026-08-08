BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(18);

SELECT has_table('public', 'bathos_modules', 'stores platform module restrictions');
SELECT has_table('public', 'bathos_module_access_grants', 'stores source-specific module grants');
SELECT has_function(
  'public', 'bathos_read_current_module_access', ARRAY[]::text[],
  'exposes the current user module entitlements'
);
SELECT has_function(
  'public', 'bathos_admin_set_module_user_access', ARRAY['text', 'uuid', 'boolean'],
  'allows administrators to manage explicit access'
);
SELECT is(
  (SELECT is_restricted FROM public.bathos_modules WHERE module_id = 'tasks'),
  true,
  'marks Tasks restricted by default'
);
SELECT function_privs_are(
  'public', 'bathos_sync_admin_module_grants', ARRAY[]::text[], 'authenticated',
  ARRAY[]::text[],
  'keeps the administrator grant trigger private from clients'
);
SELECT function_privs_are(
  'public', 'bathos_sync_restricted_module_admin_grants', ARRAY[]::text[], 'authenticated',
  ARRAY[]::text[],
  'keeps the restricted-module grant trigger private from clients'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '9b000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'restricted-admin@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '9b000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'restricted-user@example.test', '', now(),
    '{}', '{}', now(), now()
  );

INSERT INTO public.bathos_user_roles (user_id, role)
VALUES ('9b000000-0000-4000-8000-000000000001', 'admin');

SELECT ok(
  public.bathos_can_access_module('tasks', '9b000000-0000-4000-8000-000000000001'),
  'administrators inherit restricted module access'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.bathos_module_access_grants
    WHERE module_id = 'tasks'
      AND user_id = '9b000000-0000-4000-8000-000000000001'
      AND grant_source = 'admin_role'
  ),
  1::bigint,
  'materializes administrator access for PowerSync authorization'
);
SELECT is(
  public.bathos_can_access_module('tasks', '9b000000-0000-4000-8000-000000000002'),
  false,
  'denies an ordinary user without a grant'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT throws_ok(
  $$INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, client_mutation_id
    ) VALUES (
      '9b000000-0000-4000-8000-000000000020',
      '9b000000-0000-4000-8000-000000000002',
      'Denied task', 'anytime', 'a0',
      '9b000000-0000-4000-8000-000000000021'
    )$$,
  '42501',
  NULL,
  'Tasks RLS rejects a user without module access'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT lives_ok(
  $$SELECT public.bathos_admin_set_module_user_access(
      'tasks', '9b000000-0000-4000-8000-000000000002', true
    )$$,
  'an administrator can grant explicit Tasks access'
);

RESET ROLE;
SELECT ok(
  public.bathos_can_access_module('tasks', '9b000000-0000-4000-8000-000000000002'),
  'the explicit grant authorizes the ordinary user'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT lives_ok(
  $$INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, client_mutation_id
    ) VALUES (
      '9b000000-0000-4000-8000-000000000022',
      '9b000000-0000-4000-8000-000000000002',
      'Allowed task', 'anytime', 'a0',
      '9b000000-0000-4000-8000-000000000023'
    )$$,
  'Tasks RLS accepts a user with module access'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT lives_ok(
  $$SELECT public.bathos_admin_set_module_user_access(
      'tasks', '9b000000-0000-4000-8000-000000000002', false
    )$$,
  'an administrator can revoke an explicit grant'
);
SELECT lives_ok(
  $$SELECT public.bathos_admin_set_module_restricted('tasks', false)$$,
  'an administrator can make a module unrestricted'
);

RESET ROLE;
SELECT ok(
  public.bathos_can_access_module('tasks', '9b000000-0000-4000-8000-000000000002'),
  'an unrestricted module is available without an explicit grant'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT lives_ok(
  $$SELECT public.bathos_admin_set_module_restricted('tasks', true)$$,
  're-restricting the module restores administrator-derived grants'
);

SELECT * FROM finish();
ROLLBACK;
