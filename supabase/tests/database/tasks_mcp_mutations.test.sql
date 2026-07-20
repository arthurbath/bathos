BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(14);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '92000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'tasks-mcp-mutation-a@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '92000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'tasks-mcp-mutation-b@example.test', '', now(),
    '{}', '{}', now(), now()
  );

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES
  (
    '92000000-0000-4000-8000-000000000010',
    '92000000-0000-4000-8000-000000000001',
    'Synthetic owned task', 'anytime', 'a0',
    '92000000-0000-4000-8000-000000000011'
  ),
  (
    '92000000-0000-4000-8000-000000000020',
    '92000000-0000-4000-8000-000000000002',
    'Synthetic other-owner task', 'anytime', 'a0',
    '92000000-0000-4000-8000-000000000021'
  );

INSERT INTO public.tasks_checklist_items (
  id, owner_id, task_id, title, order_key, client_mutation_id
) VALUES (
  '92000000-0000-4000-8000-000000000030',
  '92000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000010',
  'Synthetic checklist item', 'a0',
  '92000000-0000-4000-8000-000000000031'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET title = 'Synthetic MCP edit', revision = 2,
      client_mutation_id = '92000000-0000-4000-8000-000000000040',
      last_mutation_channel = 'mcp', last_actor_type = 'automation'
    WHERE owner_id = '92000000-0000-4000-8000-000000000001'
      AND id = '92000000-0000-4000-8000-000000000010'
      AND revision = 1
  $$,
  'accepts an owner-filtered current-revision MCP edit'
);

SELECT is(
  (SELECT title FROM public.tasks_todos
   WHERE id = '92000000-0000-4000-8000-000000000010'),
  'Synthetic MCP edit',
  'stores the accepted MCP edit'
);

SELECT is(
  (SELECT transition || ':' || mutation_channel || ':' || actor_type
   FROM public.tasks_history_events
   WHERE client_mutation_id = '92000000-0000-4000-8000-000000000040'),
  'update:mcp:automation',
  'appends the attributed task-domain audit event'
);

SELECT is(
  (SELECT base_revision::text || ':' || result_revision::text
   FROM public.tasks_history_events
   WHERE client_mutation_id = '92000000-0000-4000-8000-000000000040'),
  '1:2',
  'records the optimistic base and resulting revisions'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET title = 'Stale overwrite', revision = 2,
      client_mutation_id = '92000000-0000-4000-8000-000000000041',
      last_mutation_channel = 'mcp', last_actor_type = 'automation'
    WHERE owner_id = '92000000-0000-4000-8000-000000000001'
      AND id = '92000000-0000-4000-8000-000000000010'
      AND revision = 1
  $$,
  'turns a stale optimistic predicate into a zero-row mutation'
);

SELECT is(
  (SELECT title FROM public.tasks_todos
   WHERE id = '92000000-0000-4000-8000-000000000010'),
  'Synthetic MCP edit',
  'leaves the accepted state unchanged after a stale request'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_todos
   WHERE id = '92000000-0000-4000-8000-000000000020'),
  0::bigint,
  'does not expose another owner task through the authenticated boundary'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET disposition = 'deleted', deleted_at = now(),
      deletion_root_id = id, revision = 3,
      client_mutation_id = '92000000-0000-4000-8000-000000000042'
    WHERE id = '92000000-0000-4000-8000-000000000010'
  $$,
  '23514', 'Task disposition changes require a hierarchy operation',
  'prevents MCP from bypassing atomic recovery operations'
);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_hierarchy_operations (
      id, owner_id, root_type, root_id, operation, descendant_policy,
      expected_revisions, actor_type, mutation_channel, requested_at
    ) VALUES (
      '92000000-0000-4000-8000-000000000050',
      '92000000-0000-4000-8000-000000000001',
      'todo', '92000000-0000-4000-8000-000000000010',
      'delete', 'cascade',
      jsonb_build_object(
        '92000000-0000-4000-8000-000000000010', 2,
        '92000000-0000-4000-8000-000000000030', 1
      ),
      'automation', 'mcp', '2026-07-20T10:00:00Z'
    )
  $$,
  'accepts one revision-checked recoverable MCP hierarchy deletion'
);

SELECT is(
  (SELECT outcome || ':' || mutation_channel || ':' || actor_type
   FROM public.tasks_hierarchy_operations
   WHERE id = '92000000-0000-4000-8000-000000000050'),
  'accepted:mcp:automation',
  'stores an accepted attributed recovery receipt'
);

SELECT is(
  (SELECT cardinality(affected_ids)
   FROM public.tasks_hierarchy_operations
   WHERE id = '92000000-0000-4000-8000-000000000050'),
  2,
  'reports the to-do and checklist stable identifiers'
);

SELECT is(
  (SELECT count(*) FROM (
    SELECT disposition, deletion_root_id FROM public.tasks_todos
    WHERE id = '92000000-0000-4000-8000-000000000010'
    UNION ALL
    SELECT disposition, deletion_root_id FROM public.tasks_checklist_items
    WHERE id = '92000000-0000-4000-8000-000000000030'
  ) AS deleted
  WHERE disposition = 'deleted'
    AND deletion_root_id = '92000000-0000-4000-8000-000000000010'),
  2::bigint,
  'deletes the to-do and checklist atomically under one recovery root'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_hierarchy_operations (
      id, owner_id, root_type, root_id, operation, descendant_policy,
      expected_revisions, actor_type, mutation_channel, requested_at
    ) VALUES (
      '92000000-0000-4000-8000-000000000050',
      '92000000-0000-4000-8000-000000000001',
      'todo', '92000000-0000-4000-8000-000000000010',
      'delete', 'cascade', '{}'::jsonb,
      'automation', 'mcp', '2026-07-20T10:00:01Z'
    )
  $$,
  '23505', NULL,
  'keeps the hierarchy mutation UUID unique for retry resolution'
);

SELECT throws_ok(
  $$
    DELETE FROM public.tasks_todos
    WHERE id = '92000000-0000-4000-8000-000000000010'
  $$,
  '42501', NULL,
  'withholds permanent task deletion from authenticated MCP callers'
);

SELECT * FROM finish();
ROLLBACK;
