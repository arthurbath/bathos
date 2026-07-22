BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(23);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'b2000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'done-owner@example.test', '', now(),
  '{}', '{}', now(), now()
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b2000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'b2000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'America/Los_Angeles',
  'b2000000-0000-4000-8000-000000000002'
);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, order_key, client_mutation_id
    ) VALUES (
      'b2000000-0000-4000-8000-000000000010',
      'b2000000-0000-4000-8000-000000000001',
      'Default capture', 'a0',
      'b2000000-0000-4000-8000-000000000011'
    )
  $$,
  'accepts an unqualified capture'
);
SELECT is(
  (SELECT destination FROM public.tasks_todos WHERE id = 'b2000000-0000-4000-8000-000000000010'),
  'anytime',
  'defaults an unqualified capture to Anytime'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos WHERE id = 'b2000000-0000-4000-8000-000000000010'),
  'later',
  'defaults an unqualified capture to Today Later'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET today_section = 'now', revision = revision + 1,
      client_mutation_id = 'b2000000-0000-4000-8000-000000000012'
    WHERE id = 'b2000000-0000-4000-8000-000000000010'
  $$,
  'stores Today membership inside Anytime'
);
SELECT is(
  (SELECT destination || ':' || today_section FROM public.tasks_todos
   WHERE id = 'b2000000-0000-4000-8000-000000000010'),
  'anytime:now',
  'keeps a Today member in Anytime'
);
SELECT throws_ok(
  $$
    UPDATE public.tasks_todos SET destination = 'inbox'
    WHERE id = 'b2000000-0000-4000-8000-000000000010'
  $$,
  '23514',
  NULL,
  'rejects the retired Inbox destination'
);
SELECT throws_ok(
  $$
    UPDATE public.tasks_todos SET destination = 'today'
    WHERE id = 'b2000000-0000-4000-8000-000000000010'
  $$,
  '23514',
  NULL,
  'rejects the retired Today destination'
);
SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, order_key, client_mutation_id
    ) VALUES (
      'b2000000-0000-4000-8000-000000000020',
      'b2000000-0000-4000-8000-000000000001',
      'Invalid Someday', 'someday', 'later', 'a1',
      'b2000000-0000-4000-8000-000000000021'
    )
  $$,
  '23514',
  NULL,
  'prevents Someday work from appearing in Today'
);
SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, order_key, client_mutation_id
    ) VALUES (
      'b2000000-0000-4000-8000-000000000022',
      'b2000000-0000-4000-8000-000000000001',
      'Valid Someday', 'someday', 'none', 'a1',
      'b2000000-0000-4000-8000-000000000023'
    )
  $$,
  'accepts inactive Someday work'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, today_section, order_key,
  source_kind, source_url, source_external_id, client_mutation_id
) VALUES (
  'b2000000-0000-4000-8000-000000000030',
  'b2000000-0000-4000-8000-000000000001',
  'Boundary Done task', 'anytime', 'none', 'a2',
  'mail_message', 'message://done-boundary', '<done-boundary@example.test>',
  'b2000000-0000-4000-8000-000000000031'
);

INSERT INTO public.tasks_mail_sources (
  task_id, owner_id, account_identifier, mailbox_identifier,
  message_identifier, deep_link, retirement_destination_identifier,
  client_mutation_id
) VALUES (
  'b2000000-0000-4000-8000-000000000030',
  'b2000000-0000-4000-8000-000000000001',
  'done-account', 'done-inbox', '<done-boundary@example.test>',
  'message://done-boundary', 'done-archive',
  'b2000000-0000-4000-8000-000000000033'
);

SELECT set_config(
  'test.done_reminder',
  public.tasks_save_reminder(
    NULL, NULL, 'todo', 'b2000000-0000-4000-8000-000000000030',
    '2020-01-01', '09:00', 'UTC', 'earlier',
    'b2000000-0000-4000-8000-000000000034'
  )::text,
  false
);
SELECT set_config(
  'test.done_claim',
  public.tasks_claim_due_reminders(
    '2025-01-01 00:00:00+00', 'b2000000-0000-4000-8000-000000000035'
  )::text,
  false
);
SELECT is(
  (SELECT count(*)::integer FROM public.tasks_reminders
   WHERE task_id = 'b2000000-0000-4000-8000-000000000030'),
  1,
  'creates a real reminder dependency for the retention fixture'
);

UPDATE public.tasks_todos
SET lifecycle = 'completed', completed_at = '2026-06-21 07:00:00+00',
  revision = revision + 1,
  client_mutation_id = 'b2000000-0000-4000-8000-000000000032'
WHERE id = 'b2000000-0000-4000-8000-000000000030';

RESET ROLE;
SELECT is(
  (tasks_private.purge_expired_done('2026-07-22 06:59:00+00', 500) ->> 'purged_roots')::integer,
  0,
  'does not purge before owner-local midnight starts the 31st day'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b2000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT is(
  (SELECT count(*)::integer FROM public.tasks_todos
   WHERE id = 'b2000000-0000-4000-8000-000000000030'),
  1,
  'retains Done content through the end of its 30th owner-local day'
);

RESET ROLE;
SELECT is(
  (tasks_private.purge_expired_done('2026-07-22 07:00:00+00', 500) ->> 'purged_roots')::integer,
  1,
  'purges at owner-local midnight starting the 31st day'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b2000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT is(
  (SELECT count(*)::integer FROM public.tasks_todos
   WHERE id = 'b2000000-0000-4000-8000-000000000030'),
  0,
  'removes expired Done content'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_history_events
   WHERE task_id = 'b2000000-0000-4000-8000-000000000030')
  + (SELECT count(*) FROM public.tasks_mail_sources
     WHERE task_id = 'b2000000-0000-4000-8000-000000000030')
  + (SELECT count(*) FROM public.tasks_reminders
     WHERE task_id = 'b2000000-0000-4000-8000-000000000030')
  + (SELECT count(*) FROM public.tasks_reminder_occurrences
     WHERE reminder_id = (current_setting('test.done_reminder')::jsonb ->> 'id')::uuid)
  + (SELECT count(*) FROM public.tasks_reminder_deliveries
     WHERE occurrence_id IN (
       SELECT id FROM public.tasks_reminder_occurrences
       WHERE reminder_id = (current_setting('test.done_reminder')::jsonb ->> 'id')::uuid
     )),
  0::bigint,
  'removes terminal history, Mail source, and reminder dependencies'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::integer
   FROM tasks_private.purged_creation_receipts
   WHERE owner_id = 'b2000000-0000-4000-8000-000000000001'
     AND entity_type = 'todo'
     AND entity_id = 'b2000000-0000-4000-8000-000000000030'
     AND client_mutation_id = 'b2000000-0000-4000-8000-000000000031'),
  1,
  'preserves the content-free creation receipt needed for duplicate suppression'
);
SELECT hasnt_column(
  'tasks_private', 'purged_creation_receipts', 'title',
  'stores no task title in the retained duplicate-suppression receipt'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b2000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, order_key,
      client_mutation_id
    ) VALUES (
      'b2000000-0000-4000-8000-000000000099',
      'b2000000-0000-4000-8000-000000000001',
      'Delayed retry', 'anytime', 'later', 'a9',
      'b2000000-0000-4000-8000-000000000031'
    )
  $$,
  '23505',
  'The creation request refers to content that has expired from Done',
  'rejects a delayed retry of the purged creation request'
);

RESET ROLE;
SELECT is(
  (tasks_private.purge_expired_done('2026-07-22 07:01:00+00', 500) ->> 'purged_roots')::integer,
  0,
  'is idempotent after the expired root is gone'
);
SELECT is(
  has_function_privilege(
    'authenticated', 'tasks_private.purge_expired_done(timestamptz,integer)', 'EXECUTE'
  ),
  false,
  'withholds the purge function from ordinary clients'
);
SELECT is(
  has_function_privilege(
    'service_role', 'tasks_private.purge_expired_done(timestamptz,integer)', 'EXECUTE'
  ),
  true,
  'permits only the server role to invoke retention explicitly'
);
SELECT ok(
  to_regclass('cron.job') IS NULL,
  'keeps local validation runnable when the disposable runtime omits pg_cron'
);
SELECT ok(
  pg_get_functiondef('tasks_private.purge_expired_done(timestamptz,integer)'::regprocedure)
    LIKE '%planning_timezone%',
  'evaluates retention from each owner local date'
);

SELECT * FROM finish();
ROLLBACK;
