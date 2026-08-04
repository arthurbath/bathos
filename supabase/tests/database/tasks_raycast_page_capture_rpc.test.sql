BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(16);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'c1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'raycast-rpc-owner-a@example.test', '',
    now(), '{}', '{}', now(), now()
  ),
  (
    'c2000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'raycast-rpc-owner-b@example.test', '',
    now(), '{}', '{}', now(), now()
  );

SELECT has_function(
  'public',
  'tasks_create_raycast_page_capture',
  ARRAY['uuid', 'text', 'text'],
  'exposes a narrow Raycast webpage-capture function'
);

SELECT is(
  has_function_privilege(
    'anon',
    'public.tasks_create_raycast_page_capture(uuid,text,text)',
    'EXECUTE'
  ),
  false,
  'withholds Raycast webpage capture from anonymous callers'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_create_raycast_page_capture(uuid,text,text)',
    'EXECUTE'
  ),
  true,
  'grants Raycast webpage capture to authenticated callers'
);

SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.tasks_create_raycast_page_capture(uuid,text,text)'::regprocedure
  ),
  false,
  'keeps Raycast webpage capture under SECURITY INVOKER'
);

SELECT matches(
  (
    SELECT prosrc
    FROM pg_proc
    WHERE oid = 'public.tasks_create_raycast_page_capture(uuid,text,text)'::regprocedure
  ),
  'tasks_create_mcp_task',
  'delegates to the transactional task-creation function'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

CREATE TEMP TABLE first_capture AS
SELECT public.tasks_create_raycast_page_capture(
  'c1000000-0000-4000-8000-000000000100',
  '  Specific article title  ',
  '  https://example.test/article  '
) AS result;

SELECT is(
  (SELECT result ->> 'idempotency_outcome' FROM first_capture),
  'created',
  'creates a new Raycast webpage task'
);

SELECT is(
  (
    SELECT title || ':' || notes || ':' || destination || ':'
      || today_section || ':' || actionability || ':' || entry_channel
    FROM public.tasks_todos
    WHERE client_mutation_id = 'c1000000-0000-4000-8000-000000000100'
  ),
  'Specific article title::anytime:inbox:actionable:browser_capture',
  'fixes title, empty Notes, placement, actionability, and provenance'
);

SELECT is(
  (
    SELECT source_kind || ':' || source_url || ':' || primary_link
    FROM public.tasks_todos
    WHERE client_mutation_id = 'c1000000-0000-4000-8000-000000000100'
  ),
  'webpage:https://example.test/article:https://example.test/article',
  'stores the URL as webpage provenance and Primary Link'
);

SELECT ok(
  (
    SELECT start_date IS NULL
    FROM public.tasks_todos
    WHERE client_mutation_id = 'c1000000-0000-4000-8000-000000000100'
  ),
  'represents Today placement through the Inbox horizon without a future Start'
);

SELECT is(
  (SELECT result #>> '{task,owner_id}' FROM first_capture),
  NULL,
  'omits owner identity from the returned task'
);

SELECT is(
  public.tasks_create_raycast_page_capture(
    'c1000000-0000-4000-8000-000000000100',
    'Specific article title',
    'https://example.test/article'
  ) ->> 'idempotency_outcome',
  'already_applied',
  'replays an exact page capture idempotently'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_todos),
  1::bigint,
  'retains one task after an exact replay'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_create_raycast_page_capture(
      'c1000000-0000-4000-8000-000000000100',
      'Different title',
      'https://example.test/article'
    )
  $$,
  '23505',
  NULL,
  'rejects changed content for an accepted idempotency key'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_create_raycast_page_capture(
      'c1000000-0000-4000-8000-000000000101',
      'Invalid URL',
      'file:///tmp/article.html'
    )
  $$,
  '22023',
  NULL,
  'rejects non-HTTP webpage URLs through transactional validation'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'c2000000-0000-4000-8000-000000000002',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  public.tasks_create_raycast_page_capture(
    'c2000000-0000-4000-8000-000000000200',
    'Specific article title',
    'https://example.test/article'
  ) ->> 'idempotency_outcome',
  'created',
  'creates a separate capture for the current authenticated owner'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_todos),
  1::bigint,
  'exposes only the current owner task through RLS'
);

SELECT * FROM finish();
ROLLBACK;
