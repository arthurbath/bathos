BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(3);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '3b000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'checklist-history@example.test',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

INSERT INTO public.bathos_module_access_grants (
  module_id, user_id, grant_source, granted_by
)
SELECT 'tasks', id, 'manual', NULL
FROM auth.users
WHERE email LIKE '%@example.test'
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '3b000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES (
  '3b000000-0000-4000-8000-000000000010',
  '3b000000-0000-4000-8000-000000000001',
  'Checklist parent',
  'anytime',
  'a0',
  '3b000000-0000-4000-8000-000000000020'
);

INSERT INTO public.tasks_checklist_items (
  id, owner_id, task_id, title, order_key, client_mutation_id,
  last_operation_id
) VALUES
(
  '3b000000-0000-4000-8000-000000000011',
  '3b000000-0000-4000-8000-000000000001',
  '3b000000-0000-4000-8000-000000000010',
  'First pasted item',
  'a0',
  '3b000000-0000-4000-8000-000000000021',
  '3b000000-0000-4000-8000-000000000030'
),
(
  '3b000000-0000-4000-8000-000000000012',
  '3b000000-0000-4000-8000-000000000001',
  '3b000000-0000-4000-8000-000000000010',
  'Second pasted item',
  'a1',
  '3b000000-0000-4000-8000-000000000022',
  '3b000000-0000-4000-8000-000000000030'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_hierarchy_history_events
    WHERE entity_id IN (
      '3b000000-0000-4000-8000-000000000011',
      '3b000000-0000-4000-8000-000000000012'
    )
  ),
  2::bigint,
  'each checklist item retains its own append-only history event'
);

SELECT is(
  (
    SELECT count(DISTINCT action_id)
    FROM public.tasks_hierarchy_history_events
    WHERE entity_id IN (
      '3b000000-0000-4000-8000-000000000011',
      '3b000000-0000-4000-8000-000000000012'
    )
  ),
  1::bigint,
  'one multi-item checklist gesture shares one durable action identifier'
);

SELECT is(
  (
    SELECT action_id
    FROM public.tasks_hierarchy_history_events
    WHERE entity_id IN (
      '3b000000-0000-4000-8000-000000000011',
      '3b000000-0000-4000-8000-000000000012'
    )
    ORDER BY id
    LIMIT 1
  ),
  '3b000000-0000-4000-8000-000000000030'::uuid,
  'the checklist history action matches the client operation identifier'
);

SELECT * FROM finish();
ROLLBACK;
