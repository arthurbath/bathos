BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(39);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '98000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'push-a@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '98000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'push-b@example.test', '', now(),
    '{}', '{}', now(), now()
  );

SELECT has_table(
  'public', 'tasks_web_push_subscriptions',
  'stores provider subscription material separately from synchronized targets'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'public.tasks_web_push_subscriptions'::regclass),
  'enables RLS on Web Push subscription material'
);
SELECT is(
  has_table_privilege('authenticated', 'public.tasks_web_push_subscriptions', 'SELECT'),
  false,
  'withholds Web Push subscription material from authenticated table reads'
);
SELECT has_function(
  'public', 'tasks_register_web_push_target',
  ARRAY['text', 'text', 'text', 'text', 'boolean'],
  'registers a browser target through an owner-scoped service'
);
SELECT has_function(
  'public', 'tasks_revoke_web_push_target', ARRAY['uuid', 'text'],
  'revokes a browser target through an owner-scoped service'
);
SELECT has_function(
  'public', 'tasks_revoke_web_push_endpoint', ARRAY['text', 'text'],
  'revokes the current owner browser target by provider endpoint'
);
SELECT has_function(
  'public', 'tasks_claim_web_push_deliveries',
  ARRAY['timestamp with time zone', 'integer'],
  'leases due Web Push deliveries to the provider dispatcher'
);
SELECT has_function(
  'public', 'tasks_record_web_push_delivery_result',
  ARRAY['uuid', 'text', 'text', 'text', 'boolean'],
  'records provider outcomes separately from acknowledgement'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  '98000000-0000-4000-8000-000000000010',
  '98000000-0000-4000-8000-000000000001',
  'UTC',
  '98000000-0000-4000-8000-000000000011'
);
INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES
  (
    '98000000-0000-4000-8000-000000000020',
    '98000000-0000-4000-8000-000000000001',
    'First synthetic push task', 'anytime', 'a0',
    '98000000-0000-4000-8000-000000000021'
  ),
  (
    '98000000-0000-4000-8000-000000000022',
    '98000000-0000-4000-8000-000000000001',
    'Second synthetic push task', 'anytime', 'a1',
    '98000000-0000-4000-8000-000000000023'
  );

SELECT lives_ok(
  $$
    SELECT set_config(
      'test.push_reminder_a',
      public.tasks_save_reminder(
        NULL, NULL, 'todo', '98000000-0000-4000-8000-000000000020',
        '2020-01-01', '08:00', 'UTC', 'earlier',
        '98000000-0000-4000-8000-000000000030'
      )::text,
      false
    )
  $$,
  'creates the first due reminder'
);
SELECT lives_ok(
  $$
    SELECT set_config(
      'test.push_reminder_b',
      public.tasks_save_reminder(
        NULL, NULL, 'todo', '98000000-0000-4000-8000-000000000022',
        '2020-01-01', '09:00', 'UTC', 'earlier',
        '98000000-0000-4000-8000-000000000031'
      )::text,
      false
    )
  $$,
  'creates the second due reminder'
);
SELECT lives_ok(
  $$
    SELECT set_config(
      'test.push_target',
      public.tasks_register_web_push_target(
        'https://push.example.test/subscription-a',
        'BD3ON8F5xP2N8xSjtbQ0vY4wRz9aV0H4k7g4wP9jQ5yX2zA1bC6dE8fG0hI2jK4lM6nO8pQ0rS2tU4vW6xY8z',
        'aBcDeFgHiJkLmNoPqRsTuV',
        'Synthetic Browser',
        false
      )::text,
      false
    )
  $$,
  'registers a Web Push target and private subscription atomically'
);
SELECT is(
  current_setting('test.push_target')::jsonb ->> 'outcome',
  'accepted',
  'reports the first target registration as accepted'
);
SELECT is(
  (
    SELECT capability_status
    FROM public.tasks_delivery_targets
    WHERE id = (current_setting('test.push_target')::jsonb #>> '{target,id}')::uuid
  ),
  'active',
  'marks a registered browser target active'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.tasks_web_push_subscriptions),
  1::bigint,
  'retains exactly one private provider subscription'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT is(
  public.tasks_register_web_push_target(
    'https://push.example.test/subscription-a',
    'BD3ON8F5xP2N8xSjtbQ0vY4wRz9aV0H4k7g4wP9jQ5yX2zA1bC6dE8fG0hI2jK4lM6nO8pQ0rS2tU4vW6xY8z',
    'aBcDeFgHiJkLmNoPqRsTuV',
    'Synthetic Browser',
    false
  ) ->> 'outcome',
  'already_registered',
  'makes exact target registration idempotent'
);

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config(
  'test.push_claim_a',
  public.tasks_claim_web_push_deliveries(
    '2020-01-01 08:30:00+00', 1
  )::text,
  false
);
SELECT is(
  jsonb_array_length(current_setting('test.push_claim_a')::jsonb -> 'items'),
  1,
  'leases the first due occurrence to the registered browser target'
);
SELECT is(
  (
    SELECT status
    FROM public.tasks_reminder_deliveries
    WHERE id = (current_setting('test.push_claim_a')::jsonb #>> '{items,0,delivery_id}')::uuid
  ),
  'attempted',
  'records the provider attempt before sending'
);
SELECT is(
  jsonb_array_length(
    public.tasks_claim_web_push_deliveries('2020-01-01 08:30:00+00', 1) -> 'items'
  ),
  0,
  'does not lease the same delivery again while its attempt lease is fresh'
);
SELECT is(
  public.tasks_record_web_push_delivery_result(
    (current_setting('test.push_claim_a')::jsonb #>> '{items,0,delivery_id}')::uuid,
    'provider_accepted', 'provider-receipt-a', NULL, false
  ) ->> 'outcome',
  'accepted',
  'records provider acceptance independently'
);
SELECT is(
  (
    SELECT status
    FROM public.tasks_reminder_deliveries
    WHERE id = (current_setting('test.push_claim_a')::jsonb #>> '{items,0,delivery_id}')::uuid
  ),
  'provider_accepted',
  'retains provider acceptance without claiming that the user saw it'
);
SELECT is(
  public.tasks_record_web_push_delivery_result(
    (current_setting('test.push_claim_a')::jsonb #>> '{items,0,delivery_id}')::uuid,
    'provider_accepted', 'provider-receipt-a', NULL, false
  ) ->> 'outcome',
  'already_applied',
  'makes provider result retries idempotent'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT is(
  public.tasks_acknowledge_reminder_delivery(
    (current_setting('test.push_claim_a')::jsonb #>> '{items,0,delivery_id}')::uuid
  ) ->> 'outcome',
  'accepted',
  'allows the owner to acknowledge an opened Web Push notification'
);
SELECT is(
  (
    SELECT status
    FROM public.tasks_reminder_deliveries
    WHERE id = (current_setting('test.push_claim_a')::jsonb #>> '{items,0,delivery_id}')::uuid
  ),
  'acknowledged',
  'records user acknowledgement separately from provider acceptance'
);
SELECT is(
  jsonb_array_length(
    public.tasks_claim_due_reminders(
      '2020-01-01 08:30:00+00', '98000000-0000-4000-8000-000000000040'
    ) -> 'items'
  ),
  0,
  'does not create an in-app delivery after the occurrence is acknowledged'
);

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config(
  'test.push_claim_b',
  public.tasks_claim_web_push_deliveries(
    '2020-01-01 10:00:00+00', 1
  )::text,
  false
);
SELECT is(
  jsonb_array_length(current_setting('test.push_claim_b')::jsonb -> 'items'),
  1,
  'leases the second logical occurrence under a distinct delivery identifier'
);
SELECT is(
  public.tasks_record_web_push_delivery_result(
    (current_setting('test.push_claim_b')::jsonb #>> '{items,0,delivery_id}')::uuid,
    'failed', NULL, 'push_http_410', true
  ) ->> 'outcome',
  'accepted',
  'records an expired provider endpoint as a failed delivery'
);
SELECT is(
  (
    SELECT capability_status
    FROM public.tasks_delivery_targets
    WHERE id = (current_setting('test.push_target')::jsonb #>> '{target,id}')::uuid
  ),
  'revoked',
  'revokes a provider-expired delivery target'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_web_push_subscriptions),
  0::bigint,
  'removes expired provider credentials while retaining delivery history'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT is(
  public.tasks_register_web_push_target(
    'https://push.example.test/subscription-a',
    'BD3ON8F5xP2N8xSjtbQ0vY4wRz9aV0H4k7g4wP9jQ5yX2zA1bC6dE8fG0hI2jK4lM6nO8pQ0rS2tU4vW6xY8z',
    'aBcDeFgHiJkLmNoPqRsTuV',
    'Synthetic Browser',
    false
  ) ->> 'outcome',
  'revoked',
  'does not silently reactivate an expired local subscription'
);
SELECT is(
  public.tasks_register_web_push_target(
    'https://push.example.test/subscription-a',
    'BD3ON8F5xP2N8xSjtbQ0vY4wRz9aV0H4k7g4wP9jQ5yX2zA1bC6dE8fG0hI2jK4lM6nO8pQ0rS2tU4vW6xY8z',
    'aBcDeFgHiJkLmNoPqRsTuV',
    'Synthetic Browser',
    true
  ) ->> 'outcome',
  'already_registered',
  'reactivates a provider target only through an explicit enable action'
);

RESET ROLE;
SELECT is(
  (
    SELECT capability_status || ':' || count(*)::text
    FROM public.tasks_delivery_targets AS target
    JOIN public.tasks_web_push_subscriptions AS subscription
      ON subscription.target_id = target.id AND subscription.owner_id = target.owner_id
    WHERE target.id = (current_setting('test.push_target')::jsonb #>> '{target,id}')::uuid
    GROUP BY capability_status
  ),
  'active:1',
  'restores one active subscription after explicit reactivation'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '98000000-0000-4000-8000-000000000002', true
);
SELECT throws_ok(
  format(
    'SELECT public.tasks_revoke_web_push_target(%L::uuid)',
    current_setting('test.push_target')::jsonb #>> '{target,id}'
  ),
  '22023',
  'The Web Push target is unavailable',
  'prevents another owner from revoking the target'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_delivery_targets),
  0::bigint,
  'RLS hides another owner delivery targets'
);

SELECT set_config(
  'test.transferred_push_target',
  public.tasks_register_web_push_target(
    'https://push.example.test/subscription-a',
    'BD3ON8F5xP2N8xSjtbQ0vY4wRz9aV0H4k7g4wP9jQ5yX2zA1bC6dE8fG0hI2jK4lM6nO8pQ0rS2tU4vW6xY8z',
    'aBcDeFgHiJkLmNoPqRsTuV',
    'Shared Browser',
    false
  )::text,
  false
);
SELECT is(
  current_setting('test.transferred_push_target')::jsonb ->> 'outcome',
  'accepted',
  'transfers a browser endpoint to the newly signed-in owner'
);

RESET ROLE;
SELECT is(
  (
    SELECT owner_id::text || ':' || count(*)::text
    FROM public.tasks_web_push_subscriptions
    GROUP BY owner_id
  ),
  '98000000-0000-4000-8000-000000000002:1',
  'stores one provider credential for only the current browser owner'
);
SELECT is(
  (
    SELECT capability_status || ':' || last_error_code
    FROM public.tasks_delivery_targets
    WHERE id = (current_setting('test.push_target')::jsonb #>> '{target,id}')::uuid
  ),
  'revoked:account_changed',
  'revokes the prior owner target when browser ownership changes'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '98000000-0000-4000-8000-000000000002', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT is(
  public.tasks_revoke_web_push_endpoint(
    'https://push.example.test/subscription-a', 'account_signed_out'
  ) ->> 'outcome',
  'accepted',
  'revokes the current account browser endpoint before sign-out'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.tasks_web_push_subscriptions),
  0::bigint,
  'removes provider credentials when the browser account signs out'
);
SELECT is(
  (
    SELECT capability_status || ':' || last_error_code
    FROM public.tasks_delivery_targets
    WHERE id = (
      current_setting('test.transferred_push_target')::jsonb #>> '{target,id}'
    )::uuid
  ),
  'revoked:account_signed_out',
  'records the sign-out reason on the current owner target'
);

SELECT * FROM finish();
ROLLBACK;
