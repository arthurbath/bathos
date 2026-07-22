BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(35);

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '41000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'export-owner@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'restore-owner@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

SELECT has_function(
  'public',
  'tasks_create_export_v11',
  ARRAY[]::text[],
  'creates a versioned task export through an authenticated function'
);
SELECT has_function(
  'public',
  'tasks_restore_export_current',
  ARRAY['jsonb', 'boolean'],
  'previews and executes merge restore through an authenticated function'
);
SELECT is(
  has_schema_privilege('authenticated', 'tasks_private', 'USAGE'),
  false,
  'keeps checksum and validation helpers private'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id,
      owner_id,
      title,
      destination,
      today_section,
      order_key,
      start_date,
      deadline,
      client_mutation_id
    )
    VALUES (
      '41000000-0000-4000-8000-000000000010',
      '41000000-0000-4000-8000-000000000001',
      'Completed export task',
      'anytime',
      'none',
      'a0',
      '2026-07-20',
      '2026-07-24',
      '41000000-0000-4000-8000-000000000020'
    )
  $$,
  'creates the synthetic task that will enter history'
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      lifecycle = 'completed',
      completed_at = '2026-07-20T05:00:00.000Z',
      revision = 2,
      client_mutation_id = '41000000-0000-4000-8000-000000000021'
    WHERE id = '41000000-0000-4000-8000-000000000010'
  $$,
  'records completion before export'
);
SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id,
      owner_id,
      title,
      destination,
      today_section,
      order_key,
      source_kind,
      source_url,
      source_title,
      client_mutation_id
    )
    VALUES (
      '41000000-0000-4000-8000-000000000011',
      '41000000-0000-4000-8000-000000000001',
      'Deleted reading task',
      'anytime',
      'none',
      'a1',
      'reading_item',
      'https://example.test/article',
      'Synthetic article',
      '41000000-0000-4000-8000-000000000030'
    )
  $$,
  'creates a sourced task for recoverable deletion'
);
SELECT lives_ok(
  $$
    INSERT INTO public.tasks_hierarchy_operations (
      id, owner_id, root_type, root_id, operation, descendant_policy,
      expected_revisions, requested_at
    ) VALUES (
      '41000000-0000-4000-8000-000000000031',
      '41000000-0000-4000-8000-000000000001',
      'todo', '41000000-0000-4000-8000-000000000011', 'delete', 'cascade',
      jsonb_build_object('41000000-0000-4000-8000-000000000011', 1),
      '2026-07-20T05:05:00.000Z'
    )
  $$,
  'records recoverable deletion before export'
);

SELECT set_config('test.tasks_export', public.tasks_create_export_v11()::text, false);

SELECT is(
  current_setting('test.tasks_export')::jsonb ->> 'format',
  'garden.bath.tasks.export',
  'uses a stable export format identifier'
);
SELECT is(
  (current_setting('test.tasks_export')::jsonb ->> 'schema_version')::integer,
  11,
  'versions the export schema'
);
SELECT is(
  (current_setting('test.tasks_export')::jsonb #>> '{manifest,counts,tasks_todos}')::integer,
  2,
  'reports the complete task count'
);
SELECT is(
  (
    current_setting('test.tasks_export')::jsonb
    #>> '{manifest,counts,tasks_history_events}'
  )::integer,
  4,
  'reports the complete accepted-history count'
);
SELECT is(
  jsonb_path_exists(
    current_setting('test.tasks_export')::jsonb,
    '$.data.tasks_todos[*].owner_id'
  ),
  false,
  'does not export the task owner identifier'
);
SELECT is(
  jsonb_path_exists(
    current_setting('test.tasks_export')::jsonb,
    '$.data.tasks_history_events[*].owner_id'
  ),
  false,
  'does not export the history owner identifier'
);
SELECT is(
  (
    SELECT item ->> 'disposition'
    FROM jsonb_array_elements(
      current_setting('test.tasks_export')::jsonb #> '{data,tasks_todos}'
    ) AS item
    WHERE item ->> 'id' = '41000000-0000-4000-8000-000000000011'
  ),
  'deleted',
  'includes recoverably deleted records'
);
SELECT is(
  (
    SELECT item ->> 'source_url'
    FROM jsonb_array_elements(
      current_setting('test.tasks_export')::jsonb #> '{data,tasks_todos}'
    ) AS item
    WHERE item ->> 'id' = '41000000-0000-4000-8000-000000000011'
  ),
  'https://example.test/article',
  'includes structured source metadata'
);
SELECT is(
  length(
    current_setting('test.tasks_export')::jsonb
    #>> '{manifest,checksums,tasks_todos}'
  ),
  64,
  'uses a full SHA-256 collection checksum'
);

SELECT throws_ok(
  format(
    'SELECT public.tasks_restore_export_current(%L::jsonb, true)',
    jsonb_set(
      current_setting('test.tasks_export')::jsonb,
      '{data,tasks_todos,0,title}',
      '"Tampered"'::jsonb
    )::text
  ),
  '22023',
  'Task export v10 collection tasks_todos is invalid',
  'rejects a tampered export before planning restore'
);
SELECT throws_ok(
  format(
    'SELECT public.tasks_restore_export_current(%L::jsonb, true)',
    jsonb_set(
      current_setting('test.tasks_export')::jsonb,
      '{schema_version}',
      '12'::jsonb
    )::text
  ),
  '22023',
  'Task export schema version is unsupported',
  'rejects an unsupported schema version'
);

RESET ROLE;
DELETE FROM auth.users
WHERE id = '41000000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '42000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_export')::jsonb,
      true
    ) #>> '{tasks_todos,inserts}'
  )::integer,
  2,
  'dry-run reports the planned task inserts'
);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_export')::jsonb,
      true
    ) #>> '{tasks_history_events,inserts}'
  )::integer,
  4,
  'dry-run reports the planned history inserts'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_todos),
  0::bigint,
  'dry-run does not write task data'
);

SELECT set_config(
  'test.tasks_restore',
  public.tasks_restore_export_current(
    current_setting('test.tasks_export')::jsonb,
    false
  )::text,
  false
);

SELECT is(
  (current_setting('test.tasks_restore')::jsonb #>> '{tasks_todos,inserts}')::integer,
  2,
  'merge restore inserts every nonconflicting task'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_todos
    WHERE owner_id = '42000000-0000-4000-8000-000000000002'
  ),
  2::bigint,
  'rebinds every restored task to the authenticated owner'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_history_events
    WHERE owner_id = '42000000-0000-4000-8000-000000000002'
  ),
  4::bigint,
  'rebinds every restored history event to the authenticated owner'
);
SELECT is(
  (
    SELECT disposition
    FROM public.tasks_todos
    WHERE id = '41000000-0000-4000-8000-000000000011'
  ),
  'deleted',
  'preserves recoverable deletion through restore'
);
SELECT is(
  (
    SELECT deadline::text
    FROM public.tasks_todos
    WHERE id = '41000000-0000-4000-8000-000000000010'
  ),
  '2026-07-24',
  'preserves date-only planning values through export and restore'
);
SELECT is(
  (
    SELECT before_state ->> 'lifecycle'
    FROM public.tasks_history_events
    WHERE client_mutation_id = '41000000-0000-4000-8000-000000000021'
  ),
  'open',
  'preserves the structured history required for undo'
);

SELECT set_config(
  'test.tasks_restore_retry',
  public.tasks_restore_export_current(
    current_setting('test.tasks_export')::jsonb,
    false
  )::text,
  false
);
SELECT is(
  (
    current_setting('test.tasks_restore_retry')::jsonb
    #>> '{tasks_todos,matches}'
  )::integer,
  2,
  'matches every task on an idempotent retry'
);
SELECT is(
  (
    current_setting('test.tasks_restore_retry')::jsonb
    #>> '{tasks_history_events,matches}'
  )::integer,
  4,
  'matches every history event on an idempotent retry'
);

UPDATE public.tasks_todos
SET
  title = 'Locally newer task',
  revision = 3,
  client_mutation_id = '42000000-0000-4000-8000-000000000021'
WHERE id = '41000000-0000-4000-8000-000000000010';

SELECT set_config(
  'test.tasks_restore_conflict',
  public.tasks_restore_export_current(
    current_setting('test.tasks_export')::jsonb,
    false
  )::text,
  false
);
SELECT is(
  (
    current_setting('test.tasks_restore_conflict')::jsonb
    #>> '{tasks_todos,conflicts}'
  )::integer,
  1,
  'reports a stable-identifier conflict for changed local data'
);
SELECT is(
  (
    current_setting('test.tasks_restore_conflict')::jsonb
    #>> '{tasks_todos,matches}'
  )::integer,
  1,
  'continues matching independent nonconflicting data'
);
SELECT is(
  (
    SELECT title
    FROM public.tasks_todos
    WHERE id = '41000000-0000-4000-8000-000000000010'
  ),
  'Locally newer task',
  'does not overwrite a newer conflicting task'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_history_events
    WHERE owner_id = '42000000-0000-4000-8000-000000000002'
  ),
  5::bigint,
  'does not replace or duplicate accepted history during a conflicting retry'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM tasks_private.restore_contexts),
  0::bigint,
  'removes the private restore context before the transaction continues'
);
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', 'anon', true);
SELECT throws_ok(
  'SELECT public.tasks_create_export_v1()',
  '42501',
  NULL,
  'withholds task export from unauthenticated callers'
);

SELECT * FROM finish();
ROLLBACK;
