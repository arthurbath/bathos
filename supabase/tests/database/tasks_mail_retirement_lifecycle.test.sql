BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(27);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '73000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'mail-retirement-owner-a@example.test', '', now(), '{}', '{}', now(), now()
  ),
  (
    '74000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'mail-retirement-owner-b@example.test', '', now(), '{}', '{}', now(), now()
  );

SELECT has_table(
  'public', 'tasks_mail_source_events',
  'stores append-only Mail source retirement events'
);

SELECT is(
  has_table_privilege('authenticated', 'public.tasks_mail_source_events', 'SELECT'),
  true,
  'allows authenticated owners to read lifecycle history through RLS'
);

SELECT is(
  has_table_privilege('authenticated', 'public.tasks_mail_source_events', 'INSERT'),
  false,
  'withholds direct lifecycle event insertion from authenticated callers'
);

SELECT is(
  has_table_privilege('authenticated', 'public.tasks_mail_sources', 'UPDATE'),
  false,
  'withholds direct Mail source updates from authenticated callers'
);

SELECT has_function(
  'public', 'tasks_begin_mail_retirement', ARRAY['uuid', 'bigint', 'uuid'],
  'exposes the guarded begin-retirement operation'
);

SELECT has_function(
  'public', 'tasks_resolve_mail_retirement',
  ARRAY['uuid', 'bigint', 'uuid', 'text', 'text'],
  'exposes the guarded resolve-retirement operation'
);

SELECT is(
  has_function_privilege(
    'anon', 'public.tasks_begin_mail_retirement(uuid,bigint,uuid)', 'EXECUTE'
  ),
  false,
  'withholds begin-retirement from anonymous callers'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_resolve_mail_retirement(uuid,bigint,uuid,text,text)',
    'EXECUTE'
  ),
  true,
  'grants resolve-retirement to authenticated callers'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT public.tasks_create_mail_capture(
  '73000000-0000-4000-8000-000000000010',
  '73000000-0000-4000-8000-000000000011',
  'Retire source message', '', NULL, 'a0', NULL,
  'Work', 'INBOX', 'mail-retire@example.test',
  'message://%3Cmail-retire%40example.test%3E',
  'Archive', 'Retirement test', NULL
);

CREATE TEMP TABLE first_begin AS
SELECT public.tasks_begin_mail_retirement(
  '73000000-0000-4000-8000-000000000011', 1,
  '73000000-0000-4000-8000-000000000020'
) AS result;

SELECT is(
  (SELECT result ->> 'idempotency_outcome' FROM first_begin),
  'applied',
  'begins retirement as a new mutation'
);

SELECT is(
  (SELECT result #>> '{mail_source,lifecycle}' FROM first_begin),
  'retirement_pending',
  'moves a retained source to pending before the external Mail move'
);

SELECT is(
  (SELECT result #>> '{receipt,transition}' FROM first_begin),
  'retirement_started',
  'returns an auditable begin-retirement receipt'
);

SELECT is(
  public.tasks_begin_mail_retirement(
    '73000000-0000-4000-8000-000000000011', 1,
    '73000000-0000-4000-8000-000000000020'
  ) ->> 'idempotency_outcome',
  'already_applied',
  'replays the exact begin request without another transition'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_begin_mail_retirement(
      '73000000-0000-4000-8000-000000000011', 2,
      '73000000-0000-4000-8000-000000000020'
    )
  $$,
  '23505', NULL,
  'rejects changed content under an existing begin idempotency key'
);

CREATE TEMP TABLE failed_resolution AS
SELECT public.tasks_resolve_mail_retirement(
  '73000000-0000-4000-8000-000000000011', 2,
  '73000000-0000-4000-8000-000000000021',
  'failed', 'mail_move_timeout'
) AS result;

SELECT is(
  (SELECT result #>> '{mail_source,lifecycle}' FROM failed_resolution),
  'retirement_failed',
  'records an external Mail move failure without claiming retirement'
);

SELECT is(
  (SELECT result #>> '{receipt,code}' FROM failed_resolution),
  'mail_move_timeout',
  'preserves the bounded failure code in the receipt'
);

SELECT is(
  public.tasks_begin_mail_retirement(
    '73000000-0000-4000-8000-000000000011', 3,
    '73000000-0000-4000-8000-000000000022'
  ) #>> '{mail_source,lifecycle}',
  'retirement_pending',
  'allows an explicitly failed retirement to be retried'
);

CREATE TEMP TABLE successful_resolution AS
SELECT public.tasks_resolve_mail_retirement(
  '73000000-0000-4000-8000-000000000011', 4,
  '73000000-0000-4000-8000-000000000023',
  'retired', NULL
) AS result;

SELECT is(
  (SELECT result #>> '{mail_source,lifecycle}' FROM successful_resolution),
  'retired',
  'marks the source retired only after explicit external success'
);

SELECT is(
  (SELECT result #>> '{mail_source,revision}' FROM successful_resolution),
  '5',
  'increments the source revision for every accepted lifecycle mutation'
);

SELECT is(
  public.tasks_resolve_mail_retirement(
    '73000000-0000-4000-8000-000000000011', 4,
    '73000000-0000-4000-8000-000000000023',
    'retired', NULL
  ) ->> 'idempotency_outcome',
  'already_applied',
  'replays the exact successful resolution without another transition'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_mail_source_events),
  4::bigint,
  'keeps one append-only event for each accepted lifecycle transition'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_mail_source_events
   WHERE transition = 'retirement_failed' AND error_code = 'mail_move_timeout'),
  1::bigint,
  'retains failure history after a later successful retry'
);

SELECT isnt(
  (SELECT retired_at::text FROM public.tasks_mail_sources
   WHERE task_id = '73000000-0000-4000-8000-000000000011'),
  NULL,
  'records the retirement completion time'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_begin_mail_retirement(
      '73000000-0000-4000-8000-000000000011', 5,
      '73000000-0000-4000-8000-000000000024'
    )
  $$,
  '23514', NULL,
  'keeps retired Mail sources terminal'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_resolve_mail_retirement(
      '73000000-0000-4000-8000-000000000011', 5,
      '73000000-0000-4000-8000-000000000025',
      'failed', NULL
    )
  $$,
  '22023', NULL,
  'requires a bounded failure code for failed retirement'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_mail_sources
    SET lifecycle = 'retained', revision = revision + 1,
        client_mutation_id = '73000000-0000-4000-8000-000000000026'
    WHERE task_id = '73000000-0000-4000-8000-000000000011'
  $$,
  '42501', NULL,
  'rejects direct authenticated lifecycle updates'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  (SELECT count(*) FROM public.tasks_mail_source_events),
  0::bigint,
  'hides another owner lifecycle history through RLS'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_begin_mail_retirement(
      '73000000-0000-4000-8000-000000000011', 5,
      '74000000-0000-4000-8000-000000000020'
    )
  $$,
  'P0002', NULL,
  'does not expose another owner Mail source through the guarded function'
);

SELECT * FROM finish();
ROLLBACK;
