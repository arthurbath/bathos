BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(24);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'c1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'mcp-hierarchy-owner@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'mcp-hierarchy-other@example.test', '', now(),
    '{}', '{}', now(), now()
  );

INSERT INTO public.tasks_areas (
  id, owner_id, title, order_key, client_mutation_id
) VALUES (
  'c1000000-0000-4000-8000-000000000010',
  'c1000000-0000-4000-8000-000000000001',
  'MCP area', 'a0', 'c1000000-0000-4000-8000-000000000011'
);

INSERT INTO public.tasks_projects (
  id, owner_id, area_id, title, order_key, planning_order_key, client_mutation_id
) VALUES (
  'c1000000-0000-4000-8000-000000000020',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000010',
  'MCP project', 'a0', 'a0', 'c1000000-0000-4000-8000-000000000021'
);

INSERT INTO public.tasks_headings (
  id, owner_id, project_id, title, order_key, client_mutation_id
) VALUES (
  'c1000000-0000-4000-8000-000000000030',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000020',
  'MCP heading', 'a0', 'c1000000-0000-4000-8000-000000000031'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, project_id, heading_id,
  hierarchy_order_key, client_mutation_id
) VALUES (
  'c1000000-0000-4000-8000-000000000040',
  'c1000000-0000-4000-8000-000000000001',
  'MCP descendant', 'anytime', 'a0',
  'c1000000-0000-4000-8000-000000000020',
  'c1000000-0000-4000-8000-000000000030',
  'a0', 'c1000000-0000-4000-8000-000000000041'
);

INSERT INTO public.tasks_checklist_items (
  id, owner_id, task_id, title, order_key, client_mutation_id
) VALUES (
  'c1000000-0000-4000-8000-000000000050',
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000040',
  'MCP checklist item', 'a0', 'c1000000-0000-4000-8000-000000000051'
);

SELECT has_function(
  'public', 'tasks_request_mcp_hierarchy_operation',
  ARRAY['uuid', 'text', 'uuid', 'bigint', 'text', 'text'],
  'requests one server-derived MCP hierarchy operation'
);
SELECT is(
  has_function_privilege(
    'anon',
    'public.tasks_request_mcp_hierarchy_operation(uuid,text,uuid,bigint,text,text)',
    'EXECUTE'
  ),
  false,
  'withholds MCP hierarchy lifecycle operations from anonymous callers'
);
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_request_mcp_hierarchy_operation(uuid,text,uuid,bigint,text,text)',
    'EXECUTE'
  ),
  true,
  'grants the guarded operation to authenticated callers'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true
);

SELECT set_config(
  'test.mcp_hierarchy_reject',
  public.tasks_request_mcp_hierarchy_operation(
    'c1000000-0000-4000-8000-000000000060',
    'project', 'c1000000-0000-4000-8000-000000000020', 1,
    'complete_project', 'reject'
  )::text,
  true
);
SELECT is(
  current_setting('test.mcp_hierarchy_reject')::jsonb ->> 'outcome',
  'rejected',
  'records the safe default rejection when open descendants remain'
);
SELECT is(
  current_setting('test.mcp_hierarchy_reject')::jsonb ->> 'code',
  'open_descendants',
  'returns a content-free open-descendant code'
);
SELECT is(
  (SELECT lifecycle FROM public.tasks_projects
   WHERE id = 'c1000000-0000-4000-8000-000000000020'),
  'open',
  'leaves the project unchanged after rejection'
);
SELECT throws_ok(
  $$
    SELECT public.tasks_request_mcp_hierarchy_operation(
      'c1000000-0000-4000-8000-000000000060',
      'project', 'c1000000-0000-4000-8000-000000000020', 1,
      'complete_project', 'cascade'
    )
  $$,
  'P0001',
  'The mutation identifier was already used for a different hierarchy operation.',
  'rejects changed reuse of an existing operation identifier'
);

SELECT set_config(
  'test.mcp_hierarchy_cascade',
  public.tasks_request_mcp_hierarchy_operation(
    'c1000000-0000-4000-8000-000000000061',
    'project', 'c1000000-0000-4000-8000-000000000020', 1,
    'complete_project', 'cascade'
  )::text,
  true
);
SELECT is(
  current_setting('test.mcp_hierarchy_cascade')::jsonb ->> 'outcome',
  'accepted',
  'accepts an explicit project cascade'
);
SELECT is(
  (SELECT count(*) FROM jsonb_object_keys(
    current_setting('test.mcp_hierarchy_cascade')::jsonb -> 'expected_revisions'
  )),
  2::bigint,
  'derives the complete affected revision set on the server'
);
SELECT is(
  (SELECT lifecycle FROM public.tasks_projects
   WHERE id = 'c1000000-0000-4000-8000-000000000020'),
  'completed',
  'completes the project atomically'
);
SELECT is(
  (SELECT lifecycle FROM public.tasks_todos
   WHERE id = 'c1000000-0000-4000-8000-000000000040'),
  'completed',
  'completes the open descendant atomically'
);
SELECT is(
  (SELECT actor_type || ':' || mutation_channel
   FROM public.tasks_hierarchy_operations
   WHERE id = 'c1000000-0000-4000-8000-000000000061'),
  'automation:mcp',
  'fixes accepted operation provenance to MCP automation'
);
SELECT is(
  public.tasks_request_mcp_hierarchy_operation(
    'c1000000-0000-4000-8000-000000000061',
    'project', 'c1000000-0000-4000-8000-000000000020', 1,
    'complete_project', 'cascade'
  ) ->> 'outcome',
  'accepted',
  'returns the original receipt for an exact retry'
);
SELECT throws_ok(
  $$
    SELECT public.tasks_request_mcp_hierarchy_operation(
      'c1000000-0000-4000-8000-000000000067',
      'project', 'c1000000-0000-4000-8000-000000000020', 2,
      'cancel_project', 'reject'
    )
  $$,
  'P0001',
  'Reopen the project before canceling it.',
  'rejects a direct terminal-to-terminal project transition'
);

SELECT set_config(
  'test.mcp_hierarchy_conflict',
  public.tasks_request_mcp_hierarchy_operation(
    'c1000000-0000-4000-8000-000000000062',
    'project', 'c1000000-0000-4000-8000-000000000020', 1,
    'reopen_project', 'reject'
  )::text,
  true
);
SELECT is(
  current_setting('test.mcp_hierarchy_conflict')::jsonb ->> 'outcome',
  'conflict',
  'rejects a stale root revision through the complete server revision map'
);
SELECT is(
  (SELECT lifecycle FROM public.tasks_projects
   WHERE id = 'c1000000-0000-4000-8000-000000000020'),
  'completed',
  'leaves the project unchanged after a stale operation'
);

SELECT is(
  public.tasks_request_mcp_hierarchy_operation(
    'c1000000-0000-4000-8000-000000000063',
    'project', 'c1000000-0000-4000-8000-000000000020', 2,
    'reopen_project', 'reject'
  ) ->> 'outcome',
  'accepted',
  'reopens the project from its current revision'
);
SELECT is(
  (SELECT lifecycle FROM public.tasks_todos
   WHERE id = 'c1000000-0000-4000-8000-000000000040'),
  'completed',
  'does not guess that completed descendants should reopen'
);

SELECT is(
  public.tasks_request_mcp_hierarchy_operation(
    'c1000000-0000-4000-8000-000000000064',
    'area', 'c1000000-0000-4000-8000-000000000010', 1,
    'delete', 'cascade'
  ) ->> 'outcome',
  'accepted',
  'recoverably deletes an area hierarchy through one operation'
);
SELECT is(
  (SELECT count(*) FROM (
    SELECT disposition FROM public.tasks_areas
    WHERE id = 'c1000000-0000-4000-8000-000000000010'
    UNION ALL SELECT disposition FROM public.tasks_projects
    WHERE id = 'c1000000-0000-4000-8000-000000000020'
    UNION ALL SELECT disposition FROM public.tasks_headings
    WHERE id = 'c1000000-0000-4000-8000-000000000030'
    UNION ALL SELECT disposition FROM public.tasks_todos
    WHERE id = 'c1000000-0000-4000-8000-000000000040'
    UNION ALL SELECT disposition FROM public.tasks_checklist_items
    WHERE id = 'c1000000-0000-4000-8000-000000000050'
  ) AS rows WHERE disposition = 'deleted'),
  5::bigint,
  'marks the complete hierarchy as deleted'
);
SELECT is(
  public.tasks_request_mcp_hierarchy_operation(
    'c1000000-0000-4000-8000-000000000065',
    'area', 'c1000000-0000-4000-8000-000000000010', 2,
    'restore', 'cascade'
  ) ->> 'outcome',
  'accepted',
  'restores the exact deletion-root hierarchy'
);
SELECT is(
  (SELECT count(*) FROM (
    SELECT disposition FROM public.tasks_areas
    WHERE id = 'c1000000-0000-4000-8000-000000000010'
    UNION ALL SELECT disposition FROM public.tasks_projects
    WHERE id = 'c1000000-0000-4000-8000-000000000020'
    UNION ALL SELECT disposition FROM public.tasks_headings
    WHERE id = 'c1000000-0000-4000-8000-000000000030'
    UNION ALL SELECT disposition FROM public.tasks_todos
    WHERE id = 'c1000000-0000-4000-8000-000000000040'
    UNION ALL SELECT disposition FROM public.tasks_checklist_items
    WHERE id = 'c1000000-0000-4000-8000-000000000050'
  ) AS rows WHERE disposition = 'present'),
  5::bigint,
  'restores every supported descendant'
);

SELECT set_config(
  'request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000002', true
);
SELECT throws_ok(
  $$
    SELECT public.tasks_request_mcp_hierarchy_operation(
      'c1000000-0000-4000-8000-000000000066',
      'area', 'c1000000-0000-4000-8000-000000000010', 3,
      'delete', 'cascade'
    )
  $$,
  'P0001',
  'The task hierarchy root is unavailable.',
  'does not disclose or mutate another owner hierarchy'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_hierarchy_operations
   WHERE id = 'c1000000-0000-4000-8000-000000000066'),
  0::bigint,
  'does not persist a receipt for an unauthorized root'
);

SELECT * FROM finish();
ROLLBACK;
