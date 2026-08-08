BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(30);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'b1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'mcp-rpc-owner-a@example.test', '',
    now(), '{}', '{}', now(), now()
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'mcp-rpc-owner-b@example.test', '',
    now(), '{}', '{}', now(), now()
  );

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES
  (
    'b1000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000001',
    'UTC',
    'b1000000-0000-4000-8000-000000000004'
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    'b2000000-0000-4000-8000-000000000002',
    'UTC',
    'b2000000-0000-4000-8000-000000000004'
  );

INSERT INTO public.tasks_areas (
  id, owner_id, title, order_key, client_mutation_id
) VALUES
  (
    'b1000000-0000-4000-8000-000000000010',
    'b1000000-0000-4000-8000-000000000001',
    'Owner A area',
    'a0',
    'b1000000-0000-4000-8000-000000000011'
  ),
  (
    'b2000000-0000-4000-8000-000000000020',
    'b2000000-0000-4000-8000-000000000002',
    'Owner B area',
    'a0',
    'b2000000-0000-4000-8000-000000000021'
  );

SELECT has_function(
  'public',
  'tasks_create_mcp_task',
  ARRAY[
    'uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'date',
    'boolean', 'date', 'uuid', 'text', 'text', 'text', 'text', 'text'
  ],
  'creates a generic MCP task through one transactional function'
);

INSERT INTO public.bathos_module_access_grants (
  module_id, user_id, grant_source, granted_by
)
SELECT 'tasks', id, 'manual', NULL
FROM auth.users
WHERE email LIKE '%@example.test'
ON CONFLICT DO NOTHING;

SELECT is(
  has_function_privilege(
    'anon',
    'public.tasks_create_mcp_task(uuid,text,text,text,text,text,text,date,boolean,date,uuid,text,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'withholds generic MCP task creation from anonymous callers'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_create_mcp_task(uuid,text,text,text,text,text,text,date,boolean,date,uuid,text,text,text,text,text)',
    'EXECUTE'
  ),
  true,
  'grants generic MCP task creation to authenticated callers'
);

SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.tasks_create_mcp_task(uuid,text,text,text,text,text,text,date,boolean,date,uuid,text,text,text,text,text)'::regprocedure
  ),
  false,
  'keeps generic MCP task creation under SECURITY INVOKER'
);

SELECT matches(
  (
    SELECT prosrc
    FROM pg_proc
    WHERE oid = 'public.tasks_create_mcp_task(uuid,text,text,text,text,text,text,date,boolean,date,uuid,text,text,text,text,text)'::regprocedure
  ),
  'pg_advisory_xact_lock',
  'serializes idempotency and tail-order allocation inside the transaction'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

CREATE TEMP TABLE first_creation AS
SELECT public.tasks_create_mcp_task(
  'b1000000-0000-4000-8000-000000000100',
  '  Save the source  ',
  '',
  'anytime',
  'inbox',
  'waiting',
  'browser_capture',
  NULL,
  false,
  NULL,
  'b1000000-0000-4000-8000-000000000010',
  'webpage',
  'https://example.test/article',
  'Example article',
  'article-1',
  '  https://example.test/article  '
) AS result;

SELECT is(
  (SELECT result ->> 'idempotency_outcome' FROM first_creation),
  'created',
  'reports a newly created generic MCP task'
);

SELECT is(
  (
    SELECT title || ':' || destination || ':' || today_section || ':'
      || actionability || ':' || entry_channel || ':' || last_mutation_channel
    FROM public.tasks_todos
    WHERE client_mutation_id = 'b1000000-0000-4000-8000-000000000100'
  ),
  'Save the source:anytime:inbox:waiting:browser_capture:browser_capture',
  'stores normalized planning and browser-capture provenance'
);

SELECT is(
  (SELECT result #>> '{task,owner_id}' FROM first_creation),
  NULL,
  'omits owner identity from the returned task'
);

SELECT is(
  (SELECT result #>> '{receipt,transition}' FROM first_creation),
  'create',
  'returns the trigger-authored creation receipt'
);

SELECT is(
  (
    SELECT order_key || ':' || hierarchy_order_key
    FROM public.tasks_todos
    WHERE client_mutation_id = 'b1000000-0000-4000-8000-000000000100'
  ),
  'a0:a0',
  'allocates the initial planning and hierarchy tail keys'
);

SELECT is(
  public.tasks_create_mcp_task(
    'b1000000-0000-4000-8000-000000000101',
    'Second task', '', 'anytime', 'later', 'actionable', 'mcp',
    NULL, false, NULL,
    'b1000000-0000-4000-8000-000000000010',
    NULL, NULL, NULL, NULL, NULL
  ) ->> 'idempotency_outcome',
  'created',
  'creates a second task in the same planning and hierarchy lanes'
);

SELECT is(
  (
    SELECT order_key || ':' || hierarchy_order_key
    FROM public.tasks_todos
    WHERE client_mutation_id = 'b1000000-0000-4000-8000-000000000101'
  ),
  'a1:a1',
  'allocates compact next planning and hierarchy keys'
);

SELECT is(
  public.tasks_create_mcp_task(
    'b1000000-0000-4000-8000-000000000100',
    'Save the source', '', 'anytime', 'inbox', 'waiting', 'browser_capture',
    NULL, false, NULL,
    'b1000000-0000-4000-8000-000000000010',
    'webpage', 'https://example.test/article', 'Example article',
    'article-1', 'https://example.test/article'
  ) ->> 'idempotency_outcome',
  'already_applied',
  'returns the accepted task for an exact retry'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_todos),
  2::bigint,
  'retains exactly two tasks after an exact retry'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_history_events
    WHERE transition = 'create'
  ),
  2::bigint,
  'retains one creation event per accepted task'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      title = 'Edited after creation',
      revision = 2,
      client_mutation_id = 'b1000000-0000-4000-8000-000000000102'
    WHERE client_mutation_id = 'b1000000-0000-4000-8000-000000000100'
  $$,
  'allows later task edits to advance independently'
);

SELECT is(
  public.tasks_create_mcp_task(
    'b1000000-0000-4000-8000-000000000100',
    'Save the source', '', 'anytime', 'inbox', 'waiting', 'browser_capture',
    NULL, false, NULL,
    'b1000000-0000-4000-8000-000000000010',
    'webpage', 'https://example.test/article', 'Example article',
    'article-1', 'https://example.test/article'
  ) #>> '{task,title}',
  'Edited after creation',
  'returns current task state after validating immutable creation state'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_create_mcp_task(
      'b1000000-0000-4000-8000-000000000100',
      'Different task', '', 'anytime', 'inbox', 'waiting', 'browser_capture',
      NULL, false, NULL,
      'b1000000-0000-4000-8000-000000000010',
      'webpage', 'https://example.test/article', 'Example article',
      'article-1', 'https://example.test/article'
    )
  $$,
  '23505',
  NULL,
  'rejects changed caller content for an accepted creation key'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_create_mcp_task(
      'b1000000-0000-4000-8000-000000000103',
      'Foreign area', '', 'anytime', NULL, 'actionable', 'mcp',
      NULL, false, NULL,
      'b2000000-0000-4000-8000-000000000020',
      NULL, NULL, NULL, NULL, NULL
    )
  $$,
  '42501',
  NULL,
  'rejects another owner area'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_todos
    WHERE client_mutation_id = 'b1000000-0000-4000-8000-000000000103'
  ),
  0::bigint,
  'leaves no partial task after container rejection'
);

SELECT throws_ok(
  format(
    $$
      SELECT public.tasks_create_mcp_task(
        'b1000000-0000-4000-8000-000000000104',
        'Invalid source', '', 'anytime', NULL, 'actionable', 'mcp',
        NULL, false, NULL, NULL,
        'webpage', 'https://example.test/article', %L, NULL, NULL
      )
    $$,
    repeat('x', 1001)
  ),
  '22023',
  NULL,
  'rejects an oversized source field inside the transaction'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_todos
    WHERE client_mutation_id = 'b1000000-0000-4000-8000-000000000104'
  ),
  0::bigint,
  'leaves no partial task after source validation failure'
);

SELECT is(
  public.tasks_create_mcp_task(
    'b1000000-0000-4000-8000-000000000105',
    'Future task', '', 'anytime', 'later', 'actionable', 'mcp',
    (current_date + 5)::date, false, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL
  ) ->> 'idempotency_outcome',
  'created',
  'creates work with a future Start'
);

SELECT is(
  (
    SELECT start_date::text || ':' || COALESCE(today_section, 'none')
    FROM public.tasks_todos
    WHERE client_mutation_id = 'b1000000-0000-4000-8000-000000000105'
  ),
  (current_date + 5)::text || ':none',
  'clears the Today horizon for a future Start'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_create_mcp_task(
      'b1000000-0000-4000-8000-000000000106',
      'Past task', '', 'anytime', NULL, 'actionable', 'mcp',
      current_date, false, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL
    )
  $$,
  '22023',
  NULL,
  'rejects a Start that is not later than the owner planning date'
);

SELECT is(
  public.tasks_create_mcp_task(
    'b1000000-0000-4000-8000-000000000107',
    'Implicit task', '', 'anytime', NULL, 'actionable', 'mcp',
    NULL, true, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL
  ) #>> '{task,today_section}',
  'next',
  'preserves implicit task placement in Today Next'
);

SELECT is(
  (
    SELECT primary_link
    FROM public.tasks_todos
    WHERE id = (
      SELECT task_id
      FROM public.tasks_history_events
      WHERE client_mutation_id = 'b1000000-0000-4000-8000-000000000100'
    )
  ),
  'https://example.test/article',
  'stores the normalized Primary Link independently from Notes'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'b2000000-0000-4000-8000-000000000002',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  public.tasks_create_mcp_task(
    'b1000000-0000-4000-8000-000000000100',
    'Save the source', '', 'anytime', 'inbox', 'waiting',
    'browser_capture', NULL, false, NULL, NULL,
    'webpage', 'https://example.test/article', 'Example article',
    'article-1', 'https://example.test/article'
  ) ->> 'idempotency_outcome',
  'created',
  'scopes creation identity to the authenticated owner'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_todos),
  1::bigint,
  'exposes only the second owner task after reusing the first owner key'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_history_events
    WHERE client_mutation_id = 'b1000000-0000-4000-8000-000000000100'
  ),
  1::bigint,
  'exposes only the second owner creation receipt after key reuse'
);

SELECT * FROM finish();
ROLLBACK;
