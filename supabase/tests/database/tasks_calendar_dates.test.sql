BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(11);

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
VALUES (
  '51000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'calendar-owner@example.test',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

SELECT has_column('public', 'tasks_todos', 'start_date', 'stores a date-only start date');
SELECT has_column('public', 'tasks_todos', 'deadline', 'stores a date-only deadline');
SELECT col_type_is('public', 'tasks_todos', 'start_date', 'date', 'uses the Postgres date type for starts');
SELECT col_type_is('public', 'tasks_todos', 'deadline', 'date', 'uses the Postgres date type for deadlines');
SELECT has_index('public', 'tasks_todos', 'tasks_todos_owner_start_date_idx', 'indexes owner start-date planning');
SELECT has_index('public', 'tasks_todos', 'tasks_todos_owner_deadline_idx', 'indexes owner deadline planning');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id,
      owner_id,
      title,
      destination,
      order_key,
      start_date,
      deadline,
      client_mutation_id
    )
    VALUES (
      '51000000-0000-4000-8000-000000000010',
      '51000000-0000-4000-8000-000000000001',
      'Date-aware task',
      'anytime',
      'a0',
      '2026-07-20',
      '2026-07-24',
      '51000000-0000-4000-8000-000000000020'
    )
  $$,
  'allows a deadline on or after the start date'
);

SELECT is(
  (SELECT start_date::text FROM public.tasks_todos WHERE id = '51000000-0000-4000-8000-000000000010'),
  '2026-07-20',
  'retains the selected calendar date without a time-zone conversion'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id,
      owner_id,
      title,
      destination,
      order_key,
      start_date,
      deadline,
      client_mutation_id
    )
    VALUES (
      '51000000-0000-4000-8000-000000000011',
      '51000000-0000-4000-8000-000000000001',
      'Impossible range',
      'anytime',
      'a1',
      '2026-07-24',
      '2026-07-20',
      '51000000-0000-4000-8000-000000000021'
    )
  $$,
  '23514',
  NULL,
  'rejects a deadline earlier than the start date'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      start_date = NULL,
      deadline = '2026-07-23',
      revision = 2,
      client_mutation_id = '51000000-0000-4000-8000-000000000022'
    WHERE id = '51000000-0000-4000-8000-000000000010'
  $$,
  'allows either date to exist independently and records the mutation'
);

SELECT is(
  (
    SELECT after_state ->> 'deadline'
    FROM public.tasks_history_events
    WHERE task_id = '51000000-0000-4000-8000-000000000010'
    ORDER BY result_revision DESC
    LIMIT 1
  ),
  '2026-07-23',
  'includes calendar dates in authoritative history snapshots'
);

SELECT * FROM finish();
ROLLBACK;
