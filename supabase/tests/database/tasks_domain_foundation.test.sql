BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(23);

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
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'tasks-owner-a@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'tasks-owner-b@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

INSERT INTO public.tasks_todos (
  id,
  owner_id,
  title,
  destination,
  order_key,
  client_mutation_id
)
VALUES (
  '20000000-0000-4000-8000-000000000010',
  '20000000-0000-4000-8000-000000000002',
  'Owner B task',
  'today',
  'a0',
  '20000000-0000-4000-8000-000000000020'
);

SELECT has_table('public', 'tasks_todos', 'creates the task to-do table');
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tasks_todos'::regclass),
  true,
  'enables RLS for task to-dos'
);
SELECT has_index('public', 'tasks_todos', 'tasks_todos_owner_active_destination_order_idx', 'indexes active planning order');
SELECT has_trigger('public', 'tasks_todos', 'tasks_todos_prepare_update', 'enforces update invariants');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id,
      owner_id,
      title,
      destination,
      order_key,
      entry_channel,
      source_kind,
      source_url,
      client_mutation_id
    )
    VALUES (
      '10000000-0000-4000-8000-000000000010',
      '10000000-0000-4000-8000-000000000001',
      'Owner A task',
      'today',
      'a0',
      'browser_capture',
      'webpage',
      'https://example.test/read',
      '10000000-0000-4000-8000-000000000020'
    )
  $$,
  'allows an owner to create a valid to-do'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_todos),
  1::bigint,
  'shows an owner only their own to-dos'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id,
      owner_id,
      title,
      destination,
      order_key,
      client_mutation_id
    )
    VALUES (
      '10000000-0000-4000-8000-000000000011',
      '20000000-0000-4000-8000-000000000002',
      'Spoofed owner',
      'inbox',
      'a1',
      '10000000-0000-4000-8000-000000000021'
    )
  $$,
  '42501',
  NULL,
  'rejects an insert for another owner'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      title = 'Updated owner A task',
      revision = 2,
      client_mutation_id = '10000000-0000-4000-8000-000000000022'
    WHERE id = '10000000-0000-4000-8000-000000000010'
      AND revision = 1
  $$,
  'allows a current revision update with a new mutation identifier'
);

SELECT is(
  (SELECT revision FROM public.tasks_todos WHERE id = '10000000-0000-4000-8000-000000000010'),
  2::bigint,
  'increments the accepted task revision'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      title = 'Stale update',
      revision = 2,
      client_mutation_id = '10000000-0000-4000-8000-000000000023'
    WHERE id = '10000000-0000-4000-8000-000000000010'
      AND revision = 1
  $$,
  'treats a stale revision predicate as an empty update'
);

SELECT is(
  (SELECT title FROM public.tasks_todos WHERE id = '10000000-0000-4000-8000-000000000010'),
  'Updated owner A task',
  'does not apply stale task values'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET
      revision = 4,
      client_mutation_id = '10000000-0000-4000-8000-000000000024'
    WHERE id = '10000000-0000-4000-8000-000000000010'
  $$,
  '23514',
  'Task revision must increment by exactly one',
  'rejects a skipped task revision'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET
      owner_id = '20000000-0000-4000-8000-000000000002',
      revision = 3,
      client_mutation_id = '10000000-0000-4000-8000-000000000025'
    WHERE id = '10000000-0000-4000-8000-000000000010'
  $$,
  '23514',
  'Task owner is immutable',
  'rejects task ownership changes'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id,
      owner_id,
      title,
      destination,
      order_key,
      source_kind,
      client_mutation_id
    )
    VALUES (
      '10000000-0000-4000-8000-000000000012',
      '10000000-0000-4000-8000-000000000001',
      'Missing webpage URL',
      'inbox',
      'a2',
      'webpage',
      '10000000-0000-4000-8000-000000000026'
    )
  $$,
  '23514',
  NULL,
  'requires a URL for webpage sources'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET
      lifecycle = 'completed',
      revision = 3,
      client_mutation_id = '10000000-0000-4000-8000-000000000027'
    WHERE id = '10000000-0000-4000-8000-000000000010'
  $$,
  '23514',
  NULL,
  'requires terminal timestamps to agree with lifecycle'
);

SELECT throws_ok(
  $$
    DELETE FROM public.tasks_todos
    WHERE id = '10000000-0000-4000-8000-000000000010'
  $$,
  '42501',
  NULL,
  'rejects authenticated hard deletion'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_todos WHERE id = '10000000-0000-4000-8000-000000000010'),
  1::bigint,
  'retains the to-do after a hard-delete attempt'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET
      disposition = 'deleted',
      revision = 3,
      client_mutation_id = '10000000-0000-4000-8000-000000000028'
    WHERE id = '10000000-0000-4000-8000-000000000010'
  $$,
  '23514',
  NULL,
  'requires deletion timestamps to agree with disposition'
);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_hierarchy_operations (
      id, owner_id, root_type, root_id, operation, descendant_policy,
      expected_revisions, requested_at
    ) VALUES (
      '10000000-0000-4000-8000-000000000029',
      '10000000-0000-4000-8000-000000000001',
      'todo', '10000000-0000-4000-8000-000000000010', 'delete', 'cascade',
      jsonb_build_object('10000000-0000-4000-8000-000000000010', 2),
      '2026-07-20T03:00:00.000Z'
    )
  $$,
  'allows recoverable deletion through an explicit hierarchy operation'
);

SELECT is(
  (SELECT disposition FROM public.tasks_todos WHERE id = '10000000-0000-4000-8000-000000000010'),
  'deleted',
  'stores recoverable deletion as a disposition overlay'
);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_hierarchy_operations (
      id, owner_id, root_type, root_id, operation, descendant_policy,
      expected_revisions, requested_at
    ) VALUES (
      '10000000-0000-4000-8000-000000000030',
      '10000000-0000-4000-8000-000000000001',
      'todo', '10000000-0000-4000-8000-000000000010', 'restore', 'cascade',
      jsonb_build_object('10000000-0000-4000-8000-000000000010', 3),
      '2026-07-20T03:01:00.000Z'
    )
  $$,
  'allows restoration through an explicit hierarchy operation'
);

SELECT is(
  (SELECT disposition FROM public.tasks_todos WHERE id = '10000000-0000-4000-8000-000000000010'),
  'present',
  'restores the to-do without hard deletion'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET
      entry_channel = 'mcp',
      revision = 5,
      client_mutation_id = '10000000-0000-4000-8000-000000000031'
    WHERE id = '10000000-0000-4000-8000-000000000010'
  $$,
  '23514',
  'Task entry channel is immutable',
  'keeps creation provenance immutable'
);

SELECT * FROM finish();
ROLLBACK;
