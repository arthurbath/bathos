BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(7);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '91000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'tasks-mcp-owner@example.test',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, entry_channel,
      last_mutation_channel, last_actor_type, source_kind, source_url,
      client_mutation_id
    ) VALUES (
      '91000000-0000-4000-8000-000000000010',
      '91000000-0000-4000-8000-000000000001',
      'Synthetic MCP capture',
      'anytime',
      'a0',
      'mcp',
      'mcp',
      'automation',
      'webpage',
      'https://example.test/capture',
      '91000000-0000-4000-8000-000000000020'
    )
  $$,
  'accepts one owner-scoped MCP task creation'
);

SELECT is(
  (
    SELECT transition
    FROM public.tasks_history_events
    WHERE client_mutation_id = '91000000-0000-4000-8000-000000000020'
  ),
  'create',
  'records the authoritative creation transition'
);

SELECT is(
  (
    SELECT mutation_channel || ':' || actor_type
    FROM public.tasks_history_events
    WHERE client_mutation_id = '91000000-0000-4000-8000-000000000020'
  ),
  'mcp:automation',
  'records MCP automation attribution'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      title = 'Edited after MCP capture',
      revision = 2,
      client_mutation_id = '91000000-0000-4000-8000-000000000021'
    WHERE id = '91000000-0000-4000-8000-000000000010'
  $$,
  'allows later mutations to replace the current task mutation identifier'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, entry_channel,
      last_mutation_channel, last_actor_type, client_mutation_id
    ) VALUES (
      '91000000-0000-4000-8000-000000000011',
      '91000000-0000-4000-8000-000000000001',
      'Duplicate retry',
      'anytime',
      'a1',
      'mcp',
      'mcp',
      'automation',
      '91000000-0000-4000-8000-000000000020'
    )
  $$,
  '23505',
  NULL,
  'keeps the original creation key unique through append-only history'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_todos),
  1::bigint,
  'does not retain a duplicate task after idempotency conflict'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_history_events
    WHERE client_mutation_id = '91000000-0000-4000-8000-000000000020'
  ),
  1::bigint,
  'retains exactly one creation receipt for the idempotency key'
);

SELECT * FROM finish();
ROLLBACK;
