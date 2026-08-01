BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(18);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'd5000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'deadline-activation@example.test', '', now(),
  '{}', '{}', now(), now()
);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'd5000000-0000-4000-8000-000000000010',
  'd5000000-0000-4000-8000-000000000001',
  'Asia/Tokyo',
  'd5000000-0000-4000-8000-000000000011'
);

UPDATE tasks_private.today_rollover_state
SET planning_date = DATE '2099-01-01',
    updated_at = '2099-01-01 00:00:00+00'
WHERE owner_id = 'd5000000-0000-4000-8000-000000000001';

INSERT INTO public.tasks_todos (
  id, owner_id, title, lifecycle, completed_at, disposition, deleted_at,
  deletion_root_id, destination, today_section, start_date, deadline,
  order_key, revision, client_mutation_id, updated_at
) VALUES
  (
    'd5000000-0000-4000-8000-000000000020',
    'd5000000-0000-4000-8000-000000000001',
    'Deadline reaches new local date', 'open', NULL, 'present', NULL, NULL,
    'anytime', NULL, NULL, DATE '2099-01-02', 'a0', 1,
    'd5000000-0000-4000-8000-000000000021',
    '2099-01-01 14:59:00+00'
  ),
  (
    'd5000000-0000-4000-8000-000000000022',
    'd5000000-0000-4000-8000-000000000001',
    'Future deadline only', 'open', NULL, 'present', NULL, NULL,
    'anytime', NULL, NULL, DATE '2099-01-03', 'a1', 1,
    'd5000000-0000-4000-8000-000000000023',
    '2099-01-01 14:59:10+00'
  ),
  (
    'd5000000-0000-4000-8000-000000000024',
    'd5000000-0000-4000-8000-000000000001',
    'Explicit Start overrides deadline', 'open', NULL, 'present', NULL, NULL,
    'anytime', NULL, DATE '2099-01-05', DATE '2099-01-02', 'a2', 1,
    'd5000000-0000-4000-8000-000000000025',
    '2099-01-01 14:59:20+00'
  ),
  (
    'd5000000-0000-4000-8000-000000000026',
    'd5000000-0000-4000-8000-000000000001',
    'Already in Today', 'open', NULL, 'present', NULL, NULL,
    'anytime', 'inbox', NULL, DATE '2099-01-02', 'a3', 1,
    'd5000000-0000-4000-8000-000000000027',
    '2099-01-01 14:59:30+00'
  ),
  (
    'd5000000-0000-4000-8000-000000000028',
    'd5000000-0000-4000-8000-000000000001',
    'Someday deadline', 'open', NULL, 'present', NULL, NULL,
    'someday', NULL, NULL, DATE '2099-01-02', 'a4', 1,
    'd5000000-0000-4000-8000-000000000029',
    '2099-01-01 14:59:40+00'
  );

SELECT set_config(
  'test.tasks_deadline_activation',
  tasks_private.activate_due_roots(
    '2099-01-01 15:01:00+00',
    'd5000000-0000-4000-8000-000000000001'
  )::text,
  false
);

SELECT is(
  (current_setting('test.tasks_deadline_activation')::jsonb
    ->> 'activated_todos')::integer,
  1,
  'activates only the reached deadline-only task'
);
SELECT is(
  (current_setting('test.tasks_deadline_activation')::jsonb
    ->> 'rolled_over_owners')::integer,
  1,
  'evaluates deadline activation on the new owner-local date'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd5000000-0000-4000-8000-000000000020'),
  'inbox',
  'places reached deadline-only work in Today Inbox'
);
SELECT is(
  (SELECT start_date FROM public.tasks_todos
    WHERE id = 'd5000000-0000-4000-8000-000000000020'),
  NULL::date,
  'does not materialize the implicit deadline as a stored Start'
);
SELECT is(
  (SELECT deadline FROM public.tasks_todos
    WHERE id = 'd5000000-0000-4000-8000-000000000020'),
  DATE '2099-01-02',
  'preserves the reached deadline after activation'
);
SELECT is(
  (SELECT revision FROM public.tasks_todos
    WHERE id = 'd5000000-0000-4000-8000-000000000020'),
  2::bigint,
  'records deadline activation as one task revision'
);
SELECT ok(
  (SELECT activated.order_key > existing.order_key
    FROM public.tasks_todos AS activated
    CROSS JOIN public.tasks_todos AS existing
    WHERE activated.id = 'd5000000-0000-4000-8000-000000000020'
      AND existing.id = 'd5000000-0000-4000-8000-000000000026'),
  'places activated deadline work after existing Today Inbox work'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd5000000-0000-4000-8000-000000000022'),
  NULL::text,
  'leaves a future deadline outside Today'
);
SELECT is(
  (SELECT start_date FROM public.tasks_todos
    WHERE id = 'd5000000-0000-4000-8000-000000000024'),
  DATE '2099-01-05',
  'preserves an explicit future Start after an earlier deadline'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd5000000-0000-4000-8000-000000000024'),
  NULL::text,
  'does not activate deadline work that has an explicit future Start'
);
SELECT is(
  (SELECT revision FROM public.tasks_todos
    WHERE id = 'd5000000-0000-4000-8000-000000000026'),
  1::bigint,
  'does not revise work already in Today Inbox'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd5000000-0000-4000-8000-000000000028'),
  NULL::text,
  'does not activate Someday work from its deadline'
);
SELECT is(
  (SELECT transition || ':' || actor_type || ':' || mutation_channel
    FROM public.tasks_history_events
    WHERE task_id = 'd5000000-0000-4000-8000-000000000020'
      AND result_revision = 2),
  'move:system:native',
  'records deadline activation as a system-authored native move'
);

SELECT set_config(
  'test.tasks_deadline_repeat',
  tasks_private.activate_due_roots(
    '2099-01-01 15:02:00+00',
    'd5000000-0000-4000-8000-000000000001'
  )::text,
  false
);
SELECT is(
  (current_setting('test.tasks_deadline_repeat')::jsonb
    ->> 'activated_todos')::integer,
  0,
  'does not reactivate deadline-only work on a repeated check'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_history_events
    WHERE task_id = 'd5000000-0000-4000-8000-000000000020'),
  2::bigint,
  'does not append a no-op deadline activation history event'
);

SELECT set_config(
  'test.tasks_deadline_catch_up',
  tasks_private.activate_due_roots(
    '2099-01-03 15:01:00+00',
    'd5000000-0000-4000-8000-000000000001'
  )::text,
  false
);
SELECT is(
  (current_setting('test.tasks_deadline_catch_up')::jsonb
    ->> 'activated_todos')::integer,
  1,
  'catches up deadline-only work after missed owner-local days'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd5000000-0000-4000-8000-000000000022'),
  'inbox',
  'places overdue deadline-only work in Today Inbox during catch-up'
);
SELECT is(
  (SELECT start_date FROM public.tasks_todos
    WHERE id = 'd5000000-0000-4000-8000-000000000024'),
  DATE '2099-01-05',
  'keeps the still-future explicit Start after catch-up'
);

SELECT * FROM finish();
ROLLBACK;
