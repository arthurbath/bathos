BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(25);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '7a000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'horizon-owner@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '7a000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'horizon-other@example.test', '', now(),
    '{}', '{}', now(), now()
  );

SELECT is(
  (
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks_todos'
      AND column_name = 'today_section'
  ),
  '''inbox''::text',
  'defaults new to-dos to the Today Inbox horizon'
);
SELECT ok(
  pg_get_constraintdef((
    SELECT oid
    FROM pg_constraint
    WHERE conrelid = 'public.tasks_todos'::regclass
      AND conname = 'tasks_todos_today_section_valid'
  )) LIKE '%inbox%',
  'allows Inbox as a to-do day horizon'
);
SELECT ok(
  pg_get_constraintdef((
    SELECT oid
    FROM pg_constraint
    WHERE conrelid = 'public.tasks_projects'::regclass
      AND conname = 'tasks_projects_today_section_valid'
  )) LIKE '%inbox%',
  'allows Inbox as a project day horizon'
);
SELECT is(
  tasks_private.todo_export_planning_is_valid_v3(
    '{"destination":"anytime","today_section":"inbox","start_date":null}'::jsonb
  ),
  true,
  'accepts Inbox in portable planning data'
);
SELECT is(
  tasks_private.todo_export_planning_is_valid_v3(
    '{"destination":"anytime","today_section":"now","start_date":"2026-07-25"}'::jsonb
  ),
  true,
  'accepts a future-start to-do with a retained horizon'
);
SELECT is(
  tasks_private.resolve_template_planning(
    'anytime', 'next', 5, NULL, DATE '2026-07-20', DATE '2026-07-20', false
  ) ->> 'today_section',
  'next',
  'retains a template horizon when its resolved start date is in the future'
);
SELECT is(
  tasks_private.normalize_todo_snapshot_v3(
    '{"destination":"inbox","today_section":"daytime"}'::jsonb
  ) ->> 'today_section',
  'inbox',
  'normalizes a legacy Inbox task into the current Inbox horizon'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '7a000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, client_mutation_id
    ) VALUES (
      '7a000000-0000-4000-8000-000000000010',
      '7a000000-0000-4000-8000-000000000001',
      'Undated Inbox task', 'anytime', 'a0',
      '7a000000-0000-4000-8000-000000000020'
    )
  $$,
  'stores an undated task in Today Inbox by default'
);
SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, start_date, order_key,
      client_mutation_id
    ) VALUES (
      '7a000000-0000-4000-8000-000000000011',
      '7a000000-0000-4000-8000-000000000001',
      'Future Now task', 'anytime', 'now', '2026-07-25', 'a1',
      '7a000000-0000-4000-8000-000000000021'
    )
  $$,
  'stores a future-start task with its chosen horizon'
);
SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, start_date, order_key,
      client_mutation_id
    ) VALUES (
      '7a000000-0000-4000-8000-000000000012',
      '7a000000-0000-4000-8000-000000000001',
      'Due unbucketed task', 'anytime', 'none', '2026-07-20', 'a2',
      '7a000000-0000-4000-8000-000000000022'
    )
  $$,
  'stores a dated task without an explicit horizon'
);
SELECT is(
  (
    SELECT today_section
    FROM public.tasks_todos
    WHERE id = '7a000000-0000-4000-8000-000000000010'
  ),
  'inbox',
  'applies the Inbox horizon default'
);
SELECT is(
  (
    SELECT today_section
    FROM public.tasks_todos
    WHERE id = '7a000000-0000-4000-8000-000000000011'
  ),
  'now',
  'retains the future task horizon verbatim'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.tasks_todos
    WHERE owner_id = '7a000000-0000-4000-8000-000000000001'
      AND destination = 'anytime'
      AND lifecycle = 'open'
      AND disposition = 'present'
      AND (
        (start_date IS NULL AND today_section <> 'none')
        OR start_date <= DATE '2026-07-20'
      )
  ),
  2,
  'derives undated horizon work and due dated work into Today'
);
SELECT is(
  (
    SELECT CASE WHEN today_section = 'none' THEN 'inbox' ELSE today_section END
    FROM public.tasks_todos
    WHERE id = '7a000000-0000-4000-8000-000000000012'
  ),
  'inbox',
  'resolves a due unbucketed task into Today Inbox'
);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.tasks_todos
    WHERE owner_id = '7a000000-0000-4000-8000-000000000001'
      AND start_date > DATE '2026-07-20'
      AND lifecycle = 'open'
      AND disposition = 'present'
  ),
  1,
  'withholds future horizon work in Upcoming until its start date'
);
SELECT is(
  (
    SELECT after_state ->> 'today_section'
    FROM public.tasks_history_events
    WHERE task_id = '7a000000-0000-4000-8000-000000000011'
      AND transition = 'create'
  ),
  'now',
  'records a future horizon in append-only history'
);
SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, order_key,
      client_mutation_id
    ) VALUES (
      '7a000000-0000-4000-8000-000000000013',
      '7a000000-0000-4000-8000-000000000001',
      'Invalid Someday Inbox task', 'someday', 'inbox', 'a3',
      '7a000000-0000-4000-8000-000000000023'
    )
  $$,
  '23514',
  NULL,
  'rejects a day horizon on Someday work'
);
SELECT is(
  public.tasks_create_mail_capture(
    '7a000000-0000-4000-8000-000000000024',
    '7a000000-0000-4000-8000-000000000014',
    'Mail Inbox capture', '', DATE '2026-07-20', 'a4', NULL,
    'Work', 'INBOX', 'day-horizon-message', 'message://day-horizon-message',
    'Archive', 'Day horizon message', NULL
  ) #>> '{task,today_section}',
  'inbox',
  'creates Mail work in Today Inbox'
);

SELECT set_config('test.tasks_day_horizon_export', public.tasks_create_export_v11()::text, false);
SELECT ok(
  jsonb_path_exists(
    current_setting('test.tasks_day_horizon_export')::jsonb,
    '$.data.tasks_todos[*] ? (@.id == "7a000000-0000-4000-8000-000000000011" && @.today_section == "now" && @.start_date == "2026-07-25")'
  ),
  'exports a future start date and its horizon together'
);

INSERT INTO public.tasks_areas (
  id, owner_id, title, order_key, client_mutation_id
) VALUES (
  '7a000000-0000-4000-8000-000000000030',
  '7a000000-0000-4000-8000-000000000001',
  'Temporary parent', 'a0', '7a000000-0000-4000-8000-000000000031'
);
INSERT INTO public.tasks_todos (
  id, owner_id, area_id, title, destination, today_section, start_date,
  order_key, client_mutation_id
) VALUES (
  '7a000000-0000-4000-8000-000000000032',
  '7a000000-0000-4000-8000-000000000001',
  '7a000000-0000-4000-8000-000000000030',
  'Future child', 'anytime', 'later', '2026-07-25', 'a5',
  '7a000000-0000-4000-8000-000000000033'
);
INSERT INTO public.tasks_hierarchy_operations (
  id, owner_id, root_type, root_id, operation, descendant_policy,
  expected_revisions, requested_at
) VALUES (
  '7a000000-0000-4000-8000-000000000034',
  '7a000000-0000-4000-8000-000000000001',
  'todo', '7a000000-0000-4000-8000-000000000032', 'delete', 'cascade',
  jsonb_build_object('7a000000-0000-4000-8000-000000000032', 1),
  '2026-07-20T10:00:00Z'
), (
  '7a000000-0000-4000-8000-000000000035',
  '7a000000-0000-4000-8000-000000000001',
  'area', '7a000000-0000-4000-8000-000000000030', 'delete', 'cascade',
  jsonb_build_object('7a000000-0000-4000-8000-000000000030', 1),
  '2026-07-20T10:01:00Z'
);
SELECT lives_ok(
  $$
    INSERT INTO public.tasks_hierarchy_operations (
      id, owner_id, root_type, root_id, operation, descendant_policy,
      expected_revisions, requested_at
    ) VALUES (
      '7a000000-0000-4000-8000-000000000036',
      '7a000000-0000-4000-8000-000000000001',
      'todo', '7a000000-0000-4000-8000-000000000032', 'restore', 'cascade',
      jsonb_build_object('7a000000-0000-4000-8000-000000000032', 2),
      '2026-07-20T10:02:00Z'
    )
  $$,
  'restores a child after its former parent was independently deleted'
);
SELECT is(
  (
    SELECT outcome
    FROM public.tasks_hierarchy_operations
    WHERE id = '7a000000-0000-4000-8000-000000000036'
  ),
  'accepted',
  'accepts the orphaned child restore'
);
SELECT is(
  (
    SELECT jsonb_build_object(
      'area_id', area_id,
      'destination', destination,
      'today_section', today_section,
      'start_date', start_date
    )
    FROM public.tasks_todos
    WHERE id = '7a000000-0000-4000-8000-000000000032'
  ),
  '{"area_id":null,"destination":"anytime","start_date":null,"today_section":"inbox"}'::jsonb,
  'moves an orphaned restored child to undated Today Inbox'
);
SELECT is(
  (
    SELECT disposition
    FROM public.tasks_areas
    WHERE id = '7a000000-0000-4000-8000-000000000030'
  ),
  'deleted',
  'does not resurrect the independently deleted parent'
);

SELECT set_config('request.jwt.claim.sub', '7a000000-0000-4000-8000-000000000002', true);
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.tasks_todos
    WHERE owner_id = '7a000000-0000-4000-8000-000000000001'
  ),
  0,
  'keeps another owner from reading day-horizon work'
);

SELECT set_config('request.jwt.claim.sub', '7a000000-0000-4000-8000-000000000001', true);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_day_horizon_export')::jsonb,
      true
    ) #>> '{tasks_todos,matches}'
  )::integer,
  4,
  'previews a current export without rewriting retained horizons'
);

SELECT * FROM finish();
ROLLBACK;
