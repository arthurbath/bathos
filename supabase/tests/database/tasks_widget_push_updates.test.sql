BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(33);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '9d000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'widget-push-a@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '9d000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'widget-push-b@example.test', '', now(),
    '{}', '{}', now(), now()
  );

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  '9d000000-0000-4000-8000-000000000010',
  '9d000000-0000-4000-8000-000000000001',
  'UTC',
  '9d000000-0000-4000-8000-000000000011'
);

SELECT has_table(
  'tasks_private', 'widget_push_registrations',
  'stores WidgetKit push registrations outside the public schema'
);
SELECT has_table(
  'tasks_private', 'widget_push_outbox',
  'stores coalesced widget invalidations outside the public schema'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid = 'tasks_private.widget_push_registrations'::regclass),
  'enables RLS on widget push registrations'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid = 'tasks_private.widget_push_outbox'::regclass),
  'enables RLS on the widget push outbox'
);
SELECT is(
  has_table_privilege('authenticated', 'tasks_private.widget_push_registrations', 'SELECT'),
  false,
  'withholds push registrations from authenticated table reads'
);
SELECT is(
  has_table_privilege('authenticated', 'tasks_private.widget_push_outbox', 'SELECT'),
  false,
  'withholds the push outbox from authenticated table reads'
);
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_register_widget_push_token(text,text,text,text,text,boolean)',
    'EXECUTE'
  ),
  false,
  'withholds token registration from ordinary authenticated SQL'
);
SELECT is(
  has_function_privilege(
    'service_role',
    'public.tasks_register_widget_push_token(text,text,text,text,text,boolean)',
    'EXECUTE'
  ),
  true,
  'grants token registration to the service boundary'
);
SELECT is(
  has_function_privilege(
    'service_role', 'public.tasks_claim_widget_push_updates(integer)', 'EXECUTE'
  ),
  true,
  'grants outbox claiming to the service boundary'
);
SELECT is(
  has_function_privilege(
    'service_role',
    'public.tasks_finish_widget_push_update(uuid,uuid,bigint,boolean)',
    'EXECUTE'
  ),
  true,
  'grants generation completion to the service boundary'
);

SELECT lives_ok(
  $$
    SELECT tasks_private.enqueue_widget_push_for_owner(
      '9d000000-0000-4000-8000-000000000099'
    )
  $$,
  'does not let a missing Auth owner break an authoritative Tasks write'
);

SELECT is(
  public.tasks_issue_widget_completion_credential(
    '9d000000-0000-4000-8000-000000000001',
    '9d000000-0000-4000-8000-000000000020',
    'twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    clock_timestamp() + interval '90 days'
  ) ->> 'owner_id',
  '9d000000-0000-4000-8000-000000000001',
  'issues the owner-and-installation-bound widget authority'
);
SELECT is(
  public.tasks_register_widget_push_token(
    'twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'ios', 'development', 'garden.bath.other.push-type.widgets',
    repeat('a', 64), true
  ) #>> '{code}',
  'invalid_request',
  'rejects a push topic outside the Tasks allowlist'
);
SELECT is(
  public.tasks_register_widget_push_token(
    'twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'ios', 'development', 'garden.bath.tasks.push-type.widgets',
    repeat('a', 64), true
  ) #>> '{outcome}',
  'registered',
  'registers a valid WidgetKit token'
);
SELECT is(
  (SELECT count(*) FROM tasks_private.widget_push_registrations),
  1::bigint,
  'stores one active registration'
);
SELECT is(
  (SELECT owner_id::text FROM tasks_private.widget_push_registrations),
  '9d000000-0000-4000-8000-000000000001',
  'binds the token to the credential owner'
);

DELETE FROM tasks_private.widget_push_outbox;
UPDATE public.tasks_user_settings
SET planning_timezone = 'America/Los_Angeles',
    revision = revision + 1,
    client_mutation_id = '9d000000-0000-4000-8000-000000000012'
WHERE owner_id = '9d000000-0000-4000-8000-000000000001';
UPDATE public.tasks_user_settings
SET planning_timezone = 'UTC',
    revision = revision + 1,
    client_mutation_id = '9d000000-0000-4000-8000-000000000013'
WHERE owner_id = '9d000000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT generation FROM tasks_private.widget_push_outbox
   WHERE owner_id = '9d000000-0000-4000-8000-000000000001'),
  2::bigint,
  'coalesces repeated owner changes by advancing one generation'
);

CREATE TEMP TABLE widget_push_claim AS
SELECT public.tasks_claim_widget_push_updates(1) -> 0 AS value;

SELECT is(
  (SELECT value ->> 'ownerId' FROM widget_push_claim),
  '9d000000-0000-4000-8000-000000000001',
  'claims the due owner invalidation'
);
SELECT is(
  (SELECT jsonb_array_length(value -> 'targets') FROM widget_push_claim),
  1,
  'returns only the owner active push targets'
);

UPDATE public.tasks_user_settings
SET planning_timezone = 'America/Los_Angeles',
    revision = revision + 1,
    client_mutation_id = '9d000000-0000-4000-8000-000000000014'
WHERE owner_id = '9d000000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT generation FROM tasks_private.widget_push_outbox
   WHERE owner_id = '9d000000-0000-4000-8000-000000000001'),
  3::bigint,
  'preserves a newer generation that arrives during dispatch'
);
SELECT ok(
  public.tasks_finish_widget_push_update(
    (SELECT (value ->> 'ownerId')::uuid FROM widget_push_claim),
    (SELECT (value ->> 'claimId')::uuid FROM widget_push_claim),
    (SELECT (value ->> 'generation')::bigint FROM widget_push_claim),
    true
  ),
  'acknowledges the claimed generation'
);
SELECT is(
  (SELECT generation::text || ':' || (claim_id IS NULL)::text
   FROM tasks_private.widget_push_outbox
   WHERE owner_id = '9d000000-0000-4000-8000-000000000001'),
  '3:true',
  'leaves the newer generation immediately available'
);

TRUNCATE widget_push_claim;
INSERT INTO widget_push_claim
SELECT public.tasks_claim_widget_push_updates(1) -> 0;
SELECT ok(
  public.tasks_finish_widget_push_update(
    (SELECT (value ->> 'ownerId')::uuid FROM widget_push_claim),
    (SELECT (value ->> 'claimId')::uuid FROM widget_push_claim),
    (SELECT (value ->> 'generation')::bigint FROM widget_push_claim),
    false
  ),
  'releases a transiently failed generation for retry'
);
SELECT ok(
  (SELECT attempt_count = 1 AND claim_id IS NULL AND not_before > changed_at
   FROM tasks_private.widget_push_outbox
   WHERE owner_id = '9d000000-0000-4000-8000-000000000001'),
  'applies bounded retry state without losing the generation'
);

SELECT lives_ok(
  $$
    SELECT public.tasks_issue_widget_completion_credential(
      '9d000000-0000-4000-8000-000000000002',
      '9d000000-0000-4000-8000-000000000020',
      'twc_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      clock_timestamp() + interval '90 days'
    )
  $$,
  'issues authority for a new owner on the same native installation'
);
SELECT is(
  public.tasks_register_widget_push_token(
    'twc_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    'ios', 'production', 'garden.bath.tasks.push-type.widgets',
    repeat('b', 64), true
  ) #>> '{outcome}',
  'registered',
  'rotates the installation registration to its current owner'
);
SELECT is(
  (SELECT owner_id::text || ':' || apns_environment
   FROM tasks_private.widget_push_registrations),
  '9d000000-0000-4000-8000-000000000002:production',
  'rebinds the installation and environment atomically'
);
SELECT is(
  public.tasks_register_widget_push_token(
    'twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'ios', 'development', 'garden.bath.tasks.push-type.widgets',
    repeat('a', 64), false
  ) #>> '{outcome}',
  'disabled',
  'accepts an old owner disablement without exposing another owner token'
);
SELECT is(
  (SELECT count(*) FROM tasks_private.widget_push_registrations),
  1::bigint,
  'does not let an old owner disable the current owner registration'
);
SELECT ok(
  public.tasks_retire_widget_push_registration(
    (SELECT id FROM tasks_private.widget_push_registrations)
  ),
  'retires a permanently invalid APNs token'
);
SELECT is(
  (SELECT count(*) FROM tasks_private.widget_push_registrations),
  0::bigint,
  'removes the retired registration'
);
SELECT is(
  (SELECT count(*) FROM pg_catalog.pg_publication_tables
   WHERE pubname = 'powersync'
     AND schemaname = 'tasks_private'
     AND tablename = 'widget_push_registrations'),
  0::bigint,
  'does not publish push registrations to PowerSync'
);
SELECT is(
  (SELECT count(*) FROM pg_catalog.pg_publication_tables
   WHERE pubname = 'powersync'
     AND schemaname = 'tasks_private'
     AND tablename = 'widget_push_outbox'),
  0::bigint,
  'does not publish the push outbox to PowerSync'
);

SELECT * FROM finish();
ROLLBACK;
