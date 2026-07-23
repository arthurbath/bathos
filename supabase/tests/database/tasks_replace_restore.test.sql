BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(22);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'b1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'replace-current@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'replace-source@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'replace-conflict@example.test', '', now(),
    '{}', '{}', now(), now()
  );

SELECT has_function(
  'public', 'tasks_prepare_replace_restore_v12', ARRAY['jsonb'],
  'prepares a current-schema replacement and pre-restore backup'
);
SELECT has_function(
  'public', 'tasks_replace_restore_v12',
  ARRAY['jsonb', 'text', 'uuid', 'text'],
  'executes a guarded current-schema replacement'
);
SELECT is(
  has_function_privilege(
    'anon', 'public.tasks_replace_restore_v12(jsonb,text,uuid,text)', 'EXECUTE'
  ),
  false,
  'withholds replacement restore from anonymous callers'
);
SELECT is(
  has_function_privilege(
    'authenticated', 'public.tasks_replace_restore_v12(jsonb,text,uuid,text)', 'EXECUTE'
  ),
  true,
  'grants replacement restore to authenticated callers'
);
SELECT is(
  has_table_privilege(
    'authenticated', 'tasks_private.replace_restore_receipts', 'SELECT'
  ),
  false,
  'keeps replacement receipts private'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES (
  'b1000000-0000-4000-8000-000000000010',
  'b1000000-0000-4000-8000-000000000001',
  'Current task', 'anytime', 'a0',
  'b1000000-0000-4000-8000-000000000011'
);
INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'b1000000-0000-4000-8000-000000000012',
  'b1000000-0000-4000-8000-000000000001',
  'America/Los_Angeles',
  'b1000000-0000-4000-8000-000000000013'
);

SELECT set_config(
  'request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true
);
INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES (
  'b1000000-0000-4000-8000-000000000020',
  'b1000000-0000-4000-8000-000000000002',
  'Replacement task', 'anytime', 'b0',
  'b1000000-0000-4000-8000-000000000021'
);
INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'b1000000-0000-4000-8000-000000000022',
  'b1000000-0000-4000-8000-000000000002',
  'America/New_York',
  'b1000000-0000-4000-8000-000000000023'
);
SELECT set_config(
  'test.replace_target', public.tasks_create_export_v12()::text, false
);

SELECT set_config(
  'request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', true
);
INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES (
  'b1000000-0000-4000-8000-000000000030',
  'b1000000-0000-4000-8000-000000000003',
  'Conflicting target task', 'anytime', 'c0',
  'b1000000-0000-4000-8000-000000000031'
);
SELECT set_config(
  'test.replace_conflict_target', public.tasks_create_export_v12()::text, false
);

SELECT set_config(
  'request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true
);
SELECT set_config(
  'test.replace_conflict_prepare',
  public.tasks_prepare_replace_restore_v12(
    current_setting('test.replace_conflict_target')::jsonb
  )::text,
  false
);
SELECT throws_ok(
  format(
    $$SELECT public.tasks_replace_restore_v12(
      %L::jsonb, %L, 'b1000000-0000-4000-8000-000000000040', 'REPLACE TASK DATA'
    )$$,
    current_setting('test.replace_conflict_target'),
    current_setting('test.replace_conflict_prepare')::jsonb ->> 'backup_digest'
  ),
  '40001', 'Task replacement restore was rejected',
  'rolls back replacement when the validated target cannot be restored'
);
SELECT is(
  (SELECT title FROM public.tasks_todos
   WHERE id = 'b1000000-0000-4000-8000-000000000010'),
  'Current task',
  'leaves the original hierarchy visible after a restore failure'
);

RESET ROLE;
DELETE FROM public.tasks_history_events
WHERE owner_id = 'b1000000-0000-4000-8000-000000000002';
DELETE FROM public.tasks_todos
WHERE owner_id = 'b1000000-0000-4000-8000-000000000002';
DELETE FROM public.tasks_user_settings
WHERE owner_id = 'b1000000-0000-4000-8000-000000000002';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true
);
SELECT set_config(
  'test.replace_prepare',
  public.tasks_prepare_replace_restore_v12(
    current_setting('test.replace_target')::jsonb
  )::text,
  false
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_catalog.pg_locks AS held_lock
    JOIN pg_catalog.pg_class AS relation
      ON relation.oid = held_lock.relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE held_lock.pid = pg_catalog.pg_backend_pid()
      AND held_lock.granted
      AND held_lock.mode = 'ShareRowExclusiveLock'
      AND namespace.nspname IN ('public', 'tasks_private')
      AND relation.relname LIKE 'tasks_%'
  ),
  0::bigint,
  'prepares a replacement snapshot without retaining a global task write lock'
);

SELECT is(
  current_setting('test.replace_prepare')::jsonb #>> '{backup,data,tasks_todos,0,title}',
  'Current task',
  'returns the complete current server export as the pre-restore backup'
);
SELECT is(
  char_length(
    current_setting('test.replace_prepare')::jsonb ->> 'backup_digest'
  ),
  64,
  'binds replacement to the verified pre-restore backup digest'
);
SELECT is(
  current_setting('test.replace_prepare')::jsonb #>> '{incoming_counts,tasks_todos}',
  '1',
  'reports the incoming current-schema task count'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES (
  'b1000000-0000-4000-8000-000000000050',
  'b1000000-0000-4000-8000-000000000001',
  'Unsynchronized after preview', 'anytime', 'd0',
  'b1000000-0000-4000-8000-000000000051'
);

SELECT throws_ok(
  format(
    $$SELECT public.tasks_replace_restore_v12(
      %L::jsonb, %L, 'b1000000-0000-4000-8000-000000000060', 'REPLACE TASK DATA'
    )$$,
    current_setting('test.replace_target'),
    current_setting('test.replace_prepare')::jsonb ->> 'backup_digest'
  ),
  '40001', 'The pre-restore backup is stale',
  'rejects replacement after server task data changes'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_todos
   WHERE owner_id = 'b1000000-0000-4000-8000-000000000001'),
  2::bigint,
  'does not delete any current task after stale-backup rejection'
);

SELECT set_config(
  'test.replace_fresh_prepare',
  public.tasks_prepare_replace_restore_v12(
    current_setting('test.replace_target')::jsonb
  )::text,
  false
);
SELECT throws_ok(
  format(
    $$SELECT public.tasks_replace_restore_v12(
      %L::jsonb, %L, 'b1000000-0000-4000-8000-000000000060', 'REPLACE'
    )$$,
    current_setting('test.replace_target'),
    current_setting('test.replace_fresh_prepare')::jsonb ->> 'backup_digest'
  ),
  '22023', 'Task replacement requires explicit confirmation',
  'requires a separate exact confirmation phrase'
);

RESET ROLE;
INSERT INTO public.tasks_delivery_targets (
  id, owner_id, channel, endpoint_key, label
) VALUES (
  'b1000000-0000-4000-8000-000000000070',
  'b1000000-0000-4000-8000-000000000001',
  'web_push', 'sha256:replace-test', 'Replacement Browser'
);
INSERT INTO public.tasks_web_push_subscriptions (
  target_id, owner_id, endpoint, p256dh, auth_secret
) VALUES (
  'b1000000-0000-4000-8000-000000000070',
  'b1000000-0000-4000-8000-000000000001',
  'https://push.example.test/replace',
  repeat('A', 44), repeat('B', 16)
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true
);
SELECT set_config(
  'test.replace_result',
  public.tasks_replace_restore_v12(
    current_setting('test.replace_target')::jsonb,
    current_setting('test.replace_fresh_prepare')::jsonb ->> 'backup_digest',
    'b1000000-0000-4000-8000-000000000060',
    'REPLACE TASK DATA'
  )::text,
  false
);

SELECT is(
  current_setting('test.replace_result')::jsonb ->> 'outcome',
  'accepted',
  'returns an accepted replacement receipt'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_todos
   WHERE owner_id = 'b1000000-0000-4000-8000-000000000001'
     AND title IN ('Current task', 'Unsynchronized after preview')),
  0::bigint,
  'removes all prior owner task rows'
);
SELECT is(
  (SELECT owner_id::text FROM public.tasks_todos
   WHERE id = 'b1000000-0000-4000-8000-000000000020'),
  'b1000000-0000-4000-8000-000000000001',
  'restores the replacement task under the authenticated owner'
);
SELECT is(
  (SELECT planning_timezone FROM public.tasks_user_settings
   WHERE owner_id = 'b1000000-0000-4000-8000-000000000001'),
  'America/New_York',
  'replaces current settings with the backup setting'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.tasks_todos
   WHERE owner_id = 'b1000000-0000-4000-8000-000000000003'),
  1::bigint,
  'does not alter another owner task graph'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_web_push_subscriptions
   WHERE owner_id = 'b1000000-0000-4000-8000-000000000001'),
  1::bigint,
  'preserves excluded delivery credentials across task replacement'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true
);
SELECT is(
  public.tasks_replace_restore_v12(
    current_setting('test.replace_target')::jsonb,
    current_setting('test.replace_fresh_prepare')::jsonb ->> 'backup_digest',
    'b1000000-0000-4000-8000-000000000060',
    'REPLACE TASK DATA'
  ),
  current_setting('test.replace_result')::jsonb,
  'returns the original result for an exact ambiguous-response retry'
);
SELECT throws_ok(
  format(
    $$SELECT public.tasks_replace_restore_v12(
      %L::jsonb, %L, 'b1000000-0000-4000-8000-000000000060', 'REPLACE TASK DATA'
    )$$,
    current_setting('test.replace_conflict_target'),
    current_setting('test.replace_fresh_prepare')::jsonb ->> 'backup_digest'
  ),
  '22023',
  'Task replacement request identifier was reused with different input',
  'rejects request UUID reuse with a different target'
);

SELECT * FROM finish();
ROLLBACK;
