BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(20);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '72000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'planning-owner@example.test', '', now(),
  '{}', '{}', now(), now()
);

SELECT ok(
  pg_get_constraintdef(
    (
      SELECT oid
      FROM pg_constraint
      WHERE conrelid = 'public.tasks_todos'::regclass
        AND conname = 'tasks_todos_destination_valid'
    )
  ) LIKE '%anytime%'
    AND pg_get_constraintdef(
      (
        SELECT oid
        FROM pg_constraint
        WHERE conrelid = 'public.tasks_todos'::regclass
          AND conname = 'tasks_todos_destination_valid'
      )
    ) LIKE '%someday%',
  'allows Anytime and Someday destinations'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tasks_todos'::regclass
      AND conname = 'tasks_todos_planning_placement_valid'
  ),
  'constrains inactive and unscheduled placement'
);
SELECT has_function(
  'tasks_private',
  'todo_export_planning_is_valid_v3',
  ARRAY['jsonb'],
  'validates planning placement in portable exports'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, order_key, deadline,
      client_mutation_id
    )
    VALUES (
      '72000000-0000-4000-8000-000000000010',
      '72000000-0000-4000-8000-000000000001',
      'Synthetic active task', 'anytime', 'none', 'a0', '2026-07-30',
      '72000000-0000-4000-8000-000000000020'
    )
  $$,
  'stores active Anytime work without a start date'
);
SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, start_date, client_mutation_id
    )
    VALUES (
      '72000000-0000-4000-8000-000000000011',
      '72000000-0000-4000-8000-000000000001',
      'Synthetic future task', 'anytime', 'a1', '2026-07-25',
      '72000000-0000-4000-8000-000000000021'
    )
  $$,
  'stores future-start Anytime work for Upcoming'
);
SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, order_key, deadline,
      client_mutation_id
    )
    VALUES (
      '72000000-0000-4000-8000-000000000012',
      '72000000-0000-4000-8000-000000000001',
      'Synthetic inactive task', 'someday', 'none', 'a0', '2026-07-31',
      '72000000-0000-4000-8000-000000000022'
    )
  $$,
  'stores inactive Someday work while retaining its deadline'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.tasks_todos
    WHERE owner_id = '72000000-0000-4000-8000-000000000001'
      AND destination = 'anytime'
      AND (start_date IS NULL OR start_date <= DATE '2026-07-20')
      AND lifecycle = 'open'
      AND disposition = 'present'
  ),
  1,
  'derives only currently available work into Anytime'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.tasks_todos
    WHERE owner_id = '72000000-0000-4000-8000-000000000001'
      AND start_date > DATE '2026-07-20'
      AND lifecycle = 'open'
      AND disposition = 'present'
  ),
  1,
  'derives future Anytime work into Upcoming'
);
SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, order_key, start_date,
      client_mutation_id
    )
    VALUES (
      '72000000-0000-4000-8000-000000000013',
      '72000000-0000-4000-8000-000000000001',
      'Invalid inactive task', 'someday', 'none', 'a2', '2026-07-25',
      '72000000-0000-4000-8000-000000000023'
    )
  $$,
  '23514',
  NULL,
  'rejects a start date on Someday work'
);
SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, order_key, client_mutation_id
    )
    VALUES (
      '72000000-0000-4000-8000-000000000014',
      '72000000-0000-4000-8000-000000000001',
      'Invalid Someday membership', 'someday', 'later', 'a2',
      '72000000-0000-4000-8000-000000000024'
    )
  $$,
  '23514',
  NULL,
  'rejects Today membership on Someday work'
);
SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, order_key, client_mutation_id
    )
    VALUES (
      '72000000-0000-4000-8000-000000000015',
      '72000000-0000-4000-8000-000000000001',
      'Invalid retired section', 'anytime', 'evening', 'a2',
      '72000000-0000-4000-8000-000000000025'
    )
  $$,
  '23514',
  NULL,
  'rejects a retired Today section'
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      destination = 'someday',
      today_section = 'none',
      revision = 2,
      client_mutation_id = '72000000-0000-4000-8000-000000000026'
    WHERE id = '72000000-0000-4000-8000-000000000010'
  $$,
  'deactivates available work into Someday'
);
SELECT is(
  (
    SELECT transition
    FROM public.tasks_history_events
    WHERE task_id = '72000000-0000-4000-8000-000000000010'
      AND result_revision = 2
  ),
  'move',
  'records active-to-inactive placement as a move'
);
SELECT is(
  (
    SELECT after_state ->> 'destination'
    FROM public.tasks_history_events
    WHERE task_id = '72000000-0000-4000-8000-000000000010'
      AND result_revision = 2
  ),
  'someday',
  'preserves inactive placement in append-only history'
);
SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET
      destination = 'someday',
      today_section = 'none',
      revision = 2,
      client_mutation_id = '72000000-0000-4000-8000-000000000027'
    WHERE id = '72000000-0000-4000-8000-000000000011'
  $$,
  '23514',
  NULL,
  'requires a future start date to be cleared when moving to Someday'
);

RESET ROLE;
SELECT ok(
  tasks_private.todo_export_planning_is_valid_v3(
    '{"destination":"anytime","today_section":"none","start_date":"2026-07-25"}'::jsonb
  ),
  'accepts future Anytime placement in export validation'
);
SELECT is(
  tasks_private.todo_export_planning_is_valid_v3(
    '{"destination":"someday","today_section":"none","start_date":"2026-07-25"}'::jsonb
  ),
  false,
  'rejects scheduled Someday placement in export validation'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('test.tasks_planning_export', public.tasks_create_export_v11()::text, false);
SELECT is(
  jsonb_array_length(
    jsonb_path_query_array(
      current_setting('test.tasks_planning_export')::jsonb,
      '$.data.tasks_todos[*] ? (@.destination == "someday")'
    )
  ),
  2,
  'exports every Someday task in the current portable format'
);

RESET ROLE;
DELETE FROM public.tasks_todos
WHERE owner_id = '72000000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_planning_export')::jsonb,
      true
    ) #>> '{tasks_todos,inserts}'
  )::integer,
  3,
  'previews restoring active and inactive planning work'
);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_planning_export')::jsonb,
      false
    ) #>> '{tasks_todos,inserts}'
  )::integer,
  3,
  'restores active and inactive planning work'
);

SELECT * FROM finish();
ROLLBACK;
