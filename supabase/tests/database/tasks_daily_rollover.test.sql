BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(29);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'd4000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'rollover-tokyo@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    'd4000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'rollover-la@example.test', '', now(),
    '{}', '{}', now(), now()
  );

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES
  (
    'd4000000-0000-4000-8000-000000000010',
    'd4000000-0000-4000-8000-000000000001',
    'Asia/Tokyo',
    'd4000000-0000-4000-8000-000000000011'
  ),
  (
    'd4000000-0000-4000-8000-000000000012',
    'd4000000-0000-4000-8000-000000000002',
    'America/Los_Angeles',
    'd4000000-0000-4000-8000-000000000013'
  );

UPDATE tasks_private.today_rollover_state
SET planning_date = DATE '2099-01-01',
    updated_at = '2099-01-01 00:00:00+00'
WHERE owner_id IN (
  'd4000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000002'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, lifecycle, completed_at, disposition, deleted_at,
  deletion_root_id,
  destination, today_section, start_date, order_key, revision,
  client_mutation_id, updated_at
) VALUES
  (
    'd4000000-0000-4000-8000-000000000020',
    'd4000000-0000-4000-8000-000000000001',
    'Prior-day Now', 'open', NULL, 'present', NULL, NULL,
    'anytime', 'now', NULL, 'a0', 1,
    'd4000000-0000-4000-8000-000000000021',
    '2099-01-01 14:59:00+00'
  ),
  (
    'd4000000-0000-4000-8000-000000000022',
    'd4000000-0000-4000-8000-000000000001',
    'Prior-day Later with reminder', 'open', NULL, 'present', NULL, NULL,
    'anytime', 'later', NULL, 'a1', 1,
    'd4000000-0000-4000-8000-000000000023',
    '2099-01-01 14:59:10+00'
  ),
  (
    'd4000000-0000-4000-8000-000000000024',
    'd4000000-0000-4000-8000-000000000001',
    'Already Inbox', 'open', NULL, 'present', NULL, NULL,
    'anytime', 'inbox', NULL, 'a2', 1,
    'd4000000-0000-4000-8000-000000000025',
    '2099-01-01 14:59:20+00'
  ),
  (
    'd4000000-0000-4000-8000-000000000026',
    'd4000000-0000-4000-8000-000000000001',
    'Planned after midnight', 'open', NULL, 'present', NULL, NULL,
    'anytime', 'now', NULL, 'a3', 1,
    'd4000000-0000-4000-8000-000000000027',
    '2099-01-01 15:00:30+00'
  ),
  (
    'd4000000-0000-4000-8000-000000000028',
    'd4000000-0000-4000-8000-000000000001',
    'Completed prior-day task', 'completed', '2099-01-01 14:59:30+00',
    'present', NULL, NULL, 'anytime', 'next', NULL, 'a4', 1,
    'd4000000-0000-4000-8000-000000000029',
    '2099-01-01 14:59:30+00'
  ),
  (
    'd4000000-0000-4000-8000-000000000030',
    'd4000000-0000-4000-8000-000000000001',
    'Deleted prior-day task', 'open', NULL, 'deleted',
    '2099-01-01 14:59:40+00',
    'd4000000-0000-4000-8000-000000000030',
    'anytime', 'later', NULL, 'a5', 1,
    'd4000000-0000-4000-8000-000000000031',
    '2099-01-01 14:59:40+00'
  ),
  (
    'd4000000-0000-4000-8000-000000000032',
    'd4000000-0000-4000-8000-000000000001',
    'Start reaches new Tokyo date', 'open', NULL, 'present', NULL, NULL,
    'anytime', NULL, DATE '2099-01-02', 'a6', 1,
    'd4000000-0000-4000-8000-000000000033',
    '2099-01-01 14:59:50+00'
  ),
  (
    'd4000000-0000-4000-8000-000000000034',
    'd4000000-0000-4000-8000-000000000002',
    'Los Angeles remains on prior date', 'open', NULL, 'present', NULL, NULL,
    'anytime', 'later', NULL, 'b0', 1,
    'd4000000-0000-4000-8000-000000000035',
    '2099-01-01 14:59:00+00'
  );

SELECT has_table(
  'tasks_private',
  'today_rollover_state',
  'stores private per-owner daily rollover state'
);
SELECT has_function(
  'tasks_private',
  'activate_due_roots',
  ARRAY['timestamp with time zone', 'uuid'],
  'retains one private activation and rollover operation'
);
SELECT function_privs_are(
  'tasks_private',
  'activate_due_roots',
  ARRAY['timestamp with time zone', 'uuid'],
  'anon',
  ARRAY[]::text[],
  'keeps daily rollover unavailable to anonymous callers'
);
SELECT is(
  (
    SELECT count(*)
    FROM tasks_private.today_rollover_state
    WHERE owner_id IN (
      'd4000000-0000-4000-8000-000000000001',
      'd4000000-0000-4000-8000-000000000002'
    )
  ),
  2::bigint,
  'initializes rollover state for every planning-settings owner'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    SELECT public.tasks_save_start_reminder(
      NULL, NULL, 'todo', 'd4000000-0000-4000-8000-000000000022',
      '10:15', 'Asia/Tokyo', 'earlier',
      'd4000000-0000-4000-8000-000000000050'
    )
  $$,
  'saves a reminder on the task that will roll over'
);
SELECT set_config(
  'test.tasks_rollover_reminder',
  (
    SELECT jsonb_build_object(
      'id', reminder.id,
      'local_date', reminder.local_date,
      'record_revision', reminder.record_revision,
      'occurrence_id', occurrence.id,
      'occurrence_status', occurrence.status
    )::text
    FROM public.tasks_reminders AS reminder
    JOIN public.tasks_reminder_occurrences AS occurrence
      ON occurrence.reminder_id = reminder.id
    WHERE reminder.task_id = 'd4000000-0000-4000-8000-000000000022'
    ORDER BY occurrence.created_at DESC
    LIMIT 1
  ),
  false
);

RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claim.role;

UPDATE tasks_private.today_rollover_state
SET planning_date = DATE '2099-01-02'
WHERE owner_id NOT IN (
  'd4000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000002'
);

SELECT set_config(
  'test.tasks_rollover_result',
  tasks_private.activate_due_roots(
    '2099-01-01 15:01:00+00',
    NULL
  )::text,
  false
);

SELECT is(
  (current_setting('test.tasks_rollover_result')::jsonb
    ->> 'rolled_over_todos')::integer,
  2,
  'rolls only prior-day non-Inbox Tokyo tasks'
);
SELECT is(
  (current_setting('test.tasks_rollover_result')::jsonb
    ->> 'rolled_over_owners')::integer,
  1,
  'advances only the owner whose planning date crossed midnight'
);
SELECT is(
  (current_setting('test.tasks_rollover_result')::jsonb
    ->> 'activated_todos')::integer,
  1,
  'activates the Start that reached the new date after rollover'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd4000000-0000-4000-8000-000000000020'),
  'inbox',
  'resets prior-day Now to Inbox'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd4000000-0000-4000-8000-000000000022'),
  'inbox',
  'resets prior-day Later to Inbox'
);
SELECT is(
  (SELECT revision FROM public.tasks_todos
    WHERE id = 'd4000000-0000-4000-8000-000000000024'),
  1::bigint,
  'does not revise a task already in Inbox'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd4000000-0000-4000-8000-000000000026'),
  'now',
  'preserves a task deliberately planned after midnight'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd4000000-0000-4000-8000-000000000028'),
  'next',
  'does not roll over completed work'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd4000000-0000-4000-8000-000000000030'),
  'later',
  'does not roll over deleted work'
);
SELECT is(
  (SELECT start_date FROM public.tasks_todos
    WHERE id = 'd4000000-0000-4000-8000-000000000032'),
  NULL::date,
  'clears a newly reached future Start'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd4000000-0000-4000-8000-000000000032'),
  'inbox',
  'activates newly reached work into Inbox after rollover'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd4000000-0000-4000-8000-000000000034'),
  'later',
  'does not roll over an owner whose local date has not advanced'
);
SELECT is(
  (SELECT planning_date FROM tasks_private.today_rollover_state
    WHERE owner_id = 'd4000000-0000-4000-8000-000000000001'),
  DATE '2099-01-02',
  'advances the Tokyo rollover cursor'
);
SELECT is(
  (SELECT planning_date FROM tasks_private.today_rollover_state
    WHERE owner_id = 'd4000000-0000-4000-8000-000000000002'),
  DATE '2099-01-01',
  'leaves the Los Angeles cursor on its current local date'
);
SELECT is(
  (SELECT local_date FROM public.tasks_reminders
    WHERE task_id = 'd4000000-0000-4000-8000-000000000022'),
  (current_setting('test.tasks_rollover_reminder')::jsonb
    ->> 'local_date')::date,
  'preserves the reminder local date through rollover'
);
SELECT is(
  (SELECT record_revision FROM public.tasks_reminders
    WHERE task_id = 'd4000000-0000-4000-8000-000000000022'),
  (current_setting('test.tasks_rollover_reminder')::jsonb
    ->> 'record_revision')::bigint,
  'does not revise the reminder through rollover'
);
SELECT is(
  (
    SELECT jsonb_build_object('id', occurrence.id, 'status', occurrence.status)
    FROM public.tasks_reminder_occurrences AS occurrence
    WHERE occurrence.id = (
      current_setting('test.tasks_rollover_reminder')::jsonb
      ->> 'occurrence_id'
    )::uuid
  ),
  jsonb_build_object(
    'id',
    (current_setting('test.tasks_rollover_reminder')::jsonb
      ->> 'occurrence_id')::uuid,
    'status',
    current_setting('test.tasks_rollover_reminder')::jsonb
      ->> 'occurrence_status'
  ),
  'preserves the original reminder occurrence and status'
);
SELECT is(
  (
    SELECT transition || ':' || actor_type || ':' || mutation_channel
    FROM public.tasks_history_events
    WHERE task_id = 'd4000000-0000-4000-8000-000000000022'
      AND result_revision = 2
  ),
  'move:system:native',
  'records rollover as one system-authored move history event'
);

SELECT set_config(
  'test.tasks_rollover_repeat',
  tasks_private.activate_due_roots(
    '2099-01-01 15:02:00+00',
    NULL
  )::text,
  false
);
SELECT is(
  (current_setting('test.tasks_rollover_repeat')::jsonb
    ->> 'rolled_over_todos')::integer,
  0,
  'makes a repeated same-day rollover check a no-op'
);
SELECT is(
  (current_setting('test.tasks_rollover_repeat')::jsonb
    ->> 'activated_todos')::integer,
  0,
  'does not reactivate reached Starts on a repeated check'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_history_events
    WHERE task_id = 'd4000000-0000-4000-8000-000000000022'),
  2::bigint,
  'does not append another history event on a repeated check'
);

SELECT set_config(
  'test.tasks_rollover_catch_up',
  tasks_private.activate_due_roots(
    '2099-01-03 15:01:00+00',
    'd4000000-0000-4000-8000-000000000001'
  )::text,
  false
);
SELECT is(
  (current_setting('test.tasks_rollover_catch_up')::jsonb
    ->> 'rolled_over_todos')::integer,
  1,
  'catches up the remaining non-Inbox task left active across missed days'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'd4000000-0000-4000-8000-000000000026'),
  'inbox',
  'resets the previously new-day task at the next evaluated boundary'
);
SELECT is(
  (SELECT planning_date FROM tasks_private.today_rollover_state
    WHERE owner_id = 'd4000000-0000-4000-8000-000000000001'),
  DATE '2099-01-04',
  'advances directly to the latest owner-local date after missed days'
);

SELECT * FROM finish();
ROLLBACK;
