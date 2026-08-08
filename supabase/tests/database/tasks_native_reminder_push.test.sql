BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(16);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '9a000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'native-push@example.test', '', now(),
  '{}', '{}', now(), now()
);

INSERT INTO public.bathos_module_access_grants (
  module_id, user_id, grant_source, granted_by
)
SELECT 'tasks', id, 'manual', NULL
FROM auth.users
WHERE email LIKE '%@example.test'
ON CONFLICT DO NOTHING;

SELECT has_table(
  'tasks_private', 'native_push_registrations',
  'stores APNs application tokens outside synchronized public data'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid = 'tasks_private.native_push_registrations'::regclass),
  'enables RLS on native APNs registration material'
);
SELECT is(
  has_table_privilege(
    'authenticated', 'tasks_private.native_push_registrations', 'SELECT'
  ),
  false,
  'withholds native APNs tokens from authenticated table reads'
);
SELECT has_function(
  'public', 'tasks_register_native_push_target',
  ARRAY['uuid', 'text', 'text', 'text', 'text', 'text'],
  'registers a native application push target'
);
SELECT has_function(
  'public', 'tasks_claim_native_push_deliveries',
  ARRAY['timestamp with time zone', 'integer'],
  'leases native application reminders to the APNs dispatcher'
);
SELECT has_function(
  'public', 'tasks_claim_due_reminders_v3',
  ARRAY['timestamp with time zone', 'timestamp with time zone', 'uuid', 'text', 'text'],
  'bounds in-app fallback delivery to the current visible session'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  '9a000000-0000-4000-8000-000000000010',
  '9a000000-0000-4000-8000-000000000001',
  'UTC',
  '9a000000-0000-4000-8000-000000000011'
);
INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, start_date, order_key, client_mutation_id
) VALUES (
  '9a000000-0000-4000-8000-000000000020',
  '9a000000-0000-4000-8000-000000000001',
  'Native reminder task', 'anytime', '2099-01-01', 'a0',
  '9a000000-0000-4000-8000-000000000021'
);
SELECT set_config(
  'test.native_reminder',
  public.tasks_save_reminder(
    NULL, NULL, 'todo', '9a000000-0000-4000-8000-000000000020',
    '2099-01-01', '08:00', 'UTC', 'earlier',
    '9a000000-0000-4000-8000-000000000030'
  )::text,
  false
);
SELECT set_config(
  'test.native_target',
  public.tasks_register_native_push_target(
    '9a000000-0000-4000-8000-000000000040',
    'ios', 'development', 'garden.bath.tasks', repeat('ab', 32),
    'Synthetic iPhone'
  )::text,
  false
);
SELECT is(
  current_setting('test.native_target')::jsonb ->> 'outcome',
  'accepted',
  'accepts an owner-scoped APNs registration'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM tasks_private.native_push_registrations),
  1::bigint,
  'stores exactly one private APNs token'
);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config(
  'test.native_claim',
  public.tasks_claim_native_push_deliveries('2099-01-01 08:30:00+00', 10)::text,
  false
);
SELECT is(
  jsonb_array_length(current_setting('test.native_claim')::jsonb -> 'items'),
  1,
  'leases the due reminder to the registered application target'
);
SELECT is(
  current_setting('test.native_claim')::jsonb #>> '{items,0,topic}',
  'garden.bath.tasks',
  'returns the exact application APNs topic'
);
SELECT lives_ok(
  format(
    'SELECT public.tasks_record_native_push_delivery_result(%L, %L, %L, NULL, false)',
    current_setting('test.native_claim')::jsonb #>> '{items,0,delivery_id}',
    'provider_accepted',
    'synthetic-apns-id'
  ),
  'records APNs provider acceptance'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT is(
  jsonb_array_length(public.tasks_claim_due_reminders_v3(
    '2099-01-01 08:15:00+00',
    '2099-01-01 08:30:00+00',
    '9a000000-0000-4000-8000-000000000050',
    'browser:9a000000-0000-4000-8000-000000000051',
    'Synthetic Current Session'
  ) -> 'items'),
  0,
  'does not replay a reminder that predates the visible application session'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.tasks_reminder_claims
   WHERE id = '9a000000-0000-4000-8000-000000000050'),
  0::bigint,
  'does not retain an empty session-scoped claim receipt'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_delivery_targets
   WHERE channel = 'in_app'
     AND owner_id = '9a000000-0000-4000-8000-000000000001'),
  0::bigint,
  'does not create an in-app target for a stale-only check'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT is(
  public.tasks_revoke_native_push_target(
    '9a000000-0000-4000-8000-000000000040', 'authorization_disabled'
  ) ->> 'outcome',
  'accepted',
  'revokes the native installation through an owner-scoped service'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM tasks_private.native_push_registrations),
  0::bigint,
  'removes private APNs token material when the target is revoked'
);

SELECT * FROM finish();
ROLLBACK;
