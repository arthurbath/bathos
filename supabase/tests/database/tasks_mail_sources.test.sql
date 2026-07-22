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
    '61000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'mail-source-owner-a@example.test', '', now(), '{}', '{}', now(), now()
  ),
  (
    '62000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'mail-source-owner-b@example.test', '', now(), '{}', '{}', now(), now()
  );

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, entry_channel,
  source_kind, source_url, source_external_id, client_mutation_id
)
VALUES (
  '62000000-0000-4000-8000-000000000010',
  '62000000-0000-4000-8000-000000000002',
  'Owner B Mail task', 'anytime', 'a0', 'mail_automation',
  'mail_message', 'message://%3Cowner-b%40example.test%3E', 'owner-b@example.test',
  '62000000-0000-4000-8000-000000000020'
);

INSERT INTO public.tasks_mail_sources (
  task_id, owner_id, account_identifier, mailbox_identifier,
  message_identifier, deep_link, retirement_destination_identifier,
  client_mutation_id
)
VALUES (
  '62000000-0000-4000-8000-000000000010',
  '62000000-0000-4000-8000-000000000002',
  'Personal', 'INBOX', 'owner-b@example.test',
  'message://%3Cowner-b%40example.test%3E', 'Archive',
  '62000000-0000-4000-8000-000000000021'
);

SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

SELECT has_table('public', 'tasks_mail_sources', 'creates the task Mail source table');
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tasks_mail_sources'::regclass),
  true,
  'enables RLS for task Mail sources'
);
SELECT has_index(
  'public', 'tasks_mail_sources', 'tasks_mail_sources_owner_message_key',
  'deduplicates Mail message identity within an owner account'
);
SELECT has_trigger(
  'public', 'tasks_mail_sources', 'tasks_mail_sources_prepare_update',
  'enforces Mail source revision invariants'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, entry_channel,
      source_kind, source_url, source_external_id, client_mutation_id
    ) VALUES (
      '61000000-0000-4000-8000-000000000010',
      '61000000-0000-4000-8000-000000000001',
      'Owner A Mail task', 'anytime', 'a0', 'mail_automation',
      'mail_message', 'message://%3Cowner-a%40example.test%3E', 'owner-a@example.test',
      '61000000-0000-4000-8000-000000000020'
    );
    INSERT INTO public.tasks_mail_sources (
      task_id, owner_id, account_identifier, mailbox_identifier,
      message_identifier, deep_link, retirement_destination_identifier,
      client_mutation_id
    ) VALUES (
      '61000000-0000-4000-8000-000000000010',
      '61000000-0000-4000-8000-000000000001',
      'Work', 'INBOX', 'owner-a@example.test',
      'message://%3Cowner-a%40example.test%3E', 'Archive',
      '61000000-0000-4000-8000-000000000021'
    );
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED
  $$,
  'allows one atomic owner-scoped Mail task and source pair'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_mail_sources),
  1::bigint,
  'shows an owner only their own Mail source records'
);

SELECT is(
  (SELECT lifecycle FROM public.tasks_mail_sources
   WHERE task_id = '61000000-0000-4000-8000-000000000010'),
  'retained',
  'starts captured Mail in retained source lifecycle'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_mail_sources (
      task_id, owner_id, account_identifier, mailbox_identifier,
      message_identifier, deep_link, retirement_destination_identifier,
      client_mutation_id
    ) VALUES (
      '62000000-0000-4000-8000-000000000010',
      '62000000-0000-4000-8000-000000000002',
      'Spoofed', 'INBOX', 'spoofed@example.test',
      'message://%3Cspoofed%40example.test%3E', 'Archive',
      '61000000-0000-4000-8000-000000000022'
    )
  $$,
  '42501', NULL,
  'rejects Mail source insertion for another owner'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, entry_channel,
      source_kind, source_url, source_external_id, client_mutation_id
    ) VALUES (
      '61000000-0000-4000-8000-000000000011',
      '61000000-0000-4000-8000-000000000001',
      'Unpaired Mail task', 'anytime', 'a1', 'mail_automation',
      'mail_message', 'message://%3Cunpaired%40example.test%3E', 'unpaired@example.test',
      '61000000-0000-4000-8000-000000000023'
    );
    SET CONSTRAINTS ALL IMMEDIATE
  $$,
  '23514', NULL,
  'rejects a Mail task without its structured source record'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, client_mutation_id
    ) VALUES (
      '61000000-0000-4000-8000-000000000012',
      '61000000-0000-4000-8000-000000000001',
      'Ordinary task', 'anytime', 'a2',
      '61000000-0000-4000-8000-000000000024'
    );
    INSERT INTO public.tasks_mail_sources (
      task_id, owner_id, account_identifier, mailbox_identifier,
      message_identifier, deep_link, retirement_destination_identifier,
      client_mutation_id
    ) VALUES (
      '61000000-0000-4000-8000-000000000012',
      '61000000-0000-4000-8000-000000000001',
      'Work', 'INBOX', 'ordinary@example.test',
      'message://%3Cordinary%40example.test%3E', 'Archive',
      '61000000-0000-4000-8000-000000000025'
    );
    SET CONSTRAINTS ALL IMMEDIATE
  $$,
  '23514', NULL,
  'rejects a Mail source record for a non-Mail task'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET source_external_id = 'changed@example.test',
        revision = revision + 1,
        client_mutation_id = '61000000-0000-4000-8000-000000000026'
    WHERE id = '61000000-0000-4000-8000-000000000010';
    SET CONSTRAINTS ALL IMMEDIATE
  $$,
  '23514', NULL,
  'rejects divergence between task and Mail source identity'
);

SELECT lives_ok(
  $$
    SELECT public.tasks_begin_mail_retirement(
      '61000000-0000-4000-8000-000000000010', 1,
      '61000000-0000-4000-8000-000000000027'
    )
  $$,
  'accepts an explicit source-retirement attempt'
);

SELECT is(
  (SELECT revision FROM public.tasks_mail_sources
   WHERE task_id = '61000000-0000-4000-8000-000000000010'),
  2::bigint,
  'increments the Mail source revision'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_resolve_mail_retirement(
      '61000000-0000-4000-8000-000000000010', 1,
      '61000000-0000-4000-8000-000000000028',
      'retired', NULL
    )
  $$,
  '40001', NULL,
  'rejects a stale Mail source revision'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_resolve_mail_retirement(
      '61000000-0000-4000-8000-000000000010', 2,
      '61000000-0000-4000-8000-000000000029',
      'failed', NULL
    )
  $$,
  '22023', NULL,
  'requires a bounded error code for failed retirement'
);

SELECT lives_ok(
  $$
    SELECT public.tasks_resolve_mail_retirement(
      '61000000-0000-4000-8000-000000000010', 2,
      '61000000-0000-4000-8000-000000000030',
      'retired', NULL
    )
  $$,
  'accepts a completed Mail source retirement'
);

SELECT is(
  (SELECT lifecycle FROM public.tasks_mail_sources
   WHERE task_id = '61000000-0000-4000-8000-000000000010'),
  'retired',
  'preserves the terminal Mail source lifecycle'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET source_kind = NULL,
        source_url = NULL,
        source_external_id = NULL,
        revision = revision + 1,
        client_mutation_id = '61000000-0000-4000-8000-000000000031'
    WHERE id = '61000000-0000-4000-8000-000000000010';
    SET CONSTRAINTS ALL IMMEDIATE
  $$,
  '23514', NULL,
  'prevents generic source clearing from orphaning Mail lifecycle state'
);

SELECT has_function(
  'public', 'tasks_create_export_v5', ARRAY[]::text[],
  'creates portable task exports with Mail source records'
);

SELECT has_function(
  'public', 'tasks_restore_export_v5', ARRAY['jsonb', 'boolean'],
  'restores portable task exports with Mail source records'
);

CREATE TEMP TABLE captured_mail_export AS
SELECT public.tasks_create_export_v5() AS envelope;

SELECT is(
  (SELECT envelope ->> 'schema_version' FROM captured_mail_export),
  '5',
  'advances the portable task schema for Mail sources'
);

SELECT is(
  (SELECT jsonb_array_length(envelope #> '{data,tasks_mail_sources}')
   FROM captured_mail_export),
  1,
  'exports the owner Mail source collection'
);

SELECT is(
  (SELECT (envelope #> '{data,tasks_mail_sources,0}') ? 'owner_id'
   FROM captured_mail_export),
  false,
  'removes owner identifiers from exported Mail sources'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_restore_export_v5(
      jsonb_set(
        envelope,
        '{data,tasks_mail_sources,0,deep_link}',
        '"message://%3Cchanged%40example.test%3E"'::jsonb
      ),
      true
    )
    FROM captured_mail_export
  $$,
  '22023', NULL,
  'rejects an export whose task and Mail source identity diverge'
);

SET LOCAL ROLE postgres;
DELETE FROM public.tasks_history_events
WHERE owner_id = '61000000-0000-4000-8000-000000000001';
DELETE FROM public.tasks_mail_sources
WHERE owner_id = '61000000-0000-4000-8000-000000000001';
DELETE FROM public.tasks_todos
WHERE owner_id = '61000000-0000-4000-8000-000000000001';
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    SELECT public.tasks_restore_export_v5(envelope, false)
    FROM captured_mail_export;
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED
  $$,
  'restores a complete task and Mail source pair atomically'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_todos
   WHERE owner_id = '61000000-0000-4000-8000-000000000001'),
  1::bigint,
  'restores the Mail task exactly once'
);

SELECT is(
  (SELECT lifecycle FROM public.tasks_mail_sources
   WHERE task_id = '61000000-0000-4000-8000-000000000010'),
  'retired',
  'restores the preserved Mail source lifecycle'
);

SELECT * FROM finish();
ROLLBACK;
