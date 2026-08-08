BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(43);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'c2000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'tasks-v12@example.test', '', now(),
  '{}', '{}', now(), now()
);

INSERT INTO public.bathos_module_access_grants (
  module_id, user_id, grant_source, granted_by
)
SELECT 'tasks', id, 'manual', NULL
FROM auth.users
WHERE email LIKE '%@example.test'
ON CONFLICT DO NOTHING;

SELECT hasnt_table('public', 'tasks_headings', 'removes the heading persistence entity');
SELECT hasnt_column('public', 'tasks_todos', 'heading_id', 'removes the to-do heading reference');
SELECT has_column('public', 'tasks_todos', 'primary_link', 'stores one editable primary shortcut');
SELECT has_function(
  'tasks_private', 'activate_due_roots', ARRAY['timestamp with time zone', 'uuid'],
  'activates reached deferral dates through one idempotent server operation'
);
SELECT col_is_null(
  'public', 'tasks_todos', 'today_section',
  'allows undated work to have no day horizon'
);
SELECT ok(
  pg_get_constraintdef((
    SELECT oid FROM pg_constraint
    WHERE conrelid = 'public.tasks_todos'::regclass
      AND conname = 'tasks_todos_today_section_valid'
  )) NOT LIKE '%none%',
  'removes the none day-horizon sentinel'
);
SELECT ok(
  pg_get_constraintdef((
    SELECT oid FROM pg_constraint
    WHERE conrelid = 'public.tasks_todos'::regclass
      AND conname = 'tasks_todos_actionability_valid'
  )) LIKE '%rechecking%',
  'allows the Rechecking actionability state'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'c2000000-0000-4000-8000-000000000010',
  'c2000000-0000-4000-8000-000000000001',
  'America/Los_Angeles',
  'c2000000-0000-4000-8000-000000000011'
);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, start_date, deadline, order_key,
      actionability, client_mutation_id
    ) VALUES (
      'c2000000-0000-4000-8000-000000000020',
      'c2000000-0000-4000-8000-000000000001',
      'Start after deadline', 'anytime', DATE '2099-07-30', DATE '2099-07-24', 'a0',
      'rechecking', 'c2000000-0000-4000-8000-000000000021'
    )
  $$,
  'allows a start date later than the deadline'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'c2000000-0000-4000-8000-000000000020'),
  NULL,
  'stores a future Start without a Today horizon'
);
SELECT is(
  (SELECT actionability FROM public.tasks_todos
    WHERE id = 'c2000000-0000-4000-8000-000000000020'),
  'rechecking',
  'stores Rechecking explicitly'
);
SELECT is(
  (SELECT after_state ->> 'actionability' FROM public.tasks_history_events
    WHERE task_id = 'c2000000-0000-4000-8000-000000000020'
      AND transition = 'create'),
  'rechecking',
  'records Rechecking in authoritative history'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET start_date = (clock_timestamp() AT TIME ZONE 'America/Los_Angeles')::date,
      revision = revision + 1,
      client_mutation_id = 'c2000000-0000-4000-8000-000000000029'
    WHERE id = 'c2000000-0000-4000-8000-000000000020'
  $$,
  '22023',
  'Start must be later than today in the owner planning time zone',
  'rejects a reached Start at the PostgreSQL mutation boundary'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET start_date = NULL, today_section = 'next', revision = revision + 1,
      client_mutation_id = 'c2000000-0000-4000-8000-000000000022'
    WHERE id = 'c2000000-0000-4000-8000-000000000020'
  $$,
  'moves a task from its future Start into Today Next'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'c2000000-0000-4000-8000-000000000020'),
  'next',
  'retains the active day horizon when the start date clears'
);
SELECT lives_ok(
  $$
    SELECT public.tasks_save_start_reminder(
      NULL, NULL, 'todo', 'c2000000-0000-4000-8000-000000000020',
      '10:15', 'America/Los_Angeles', 'earlier',
      'c2000000-0000-4000-8000-000000000028'
    )
  $$,
  'saves a reminder directly against Today work'
);
SELECT is(
  (SELECT local_date FROM public.tasks_reminders
    WHERE task_id = 'c2000000-0000-4000-8000-000000000020'
      AND status = 'active'),
  (clock_timestamp() AT TIME ZONE 'America/Los_Angeles')::date,
  'anchors a directly created Today reminder to the owner planning date'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, start_date, today_section, order_key,
  client_mutation_id
) VALUES (
  'c2000000-0000-4000-8000-000000000030',
  'c2000000-0000-4000-8000-000000000001',
  'Reminder root', 'anytime', DATE '2099-08-03', 'now', 'a1',
  'c2000000-0000-4000-8000-000000000031'
);
SELECT set_config(
  'test.tasks_v12_reminder',
  public.tasks_save_start_reminder(
    NULL, NULL, 'todo', 'c2000000-0000-4000-8000-000000000030',
    '23:59', 'America/Los_Angeles', 'earlier',
    'c2000000-0000-4000-8000-000000000032'
  )::text,
  false
);
SELECT is(
  current_setting('test.tasks_v12_reminder')::jsonb #>> '{reminder,local_date}',
  '2099-08-03',
  'anchors a reminder time to its parent start date'
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET start_date = DATE '2099-08-04', revision = revision + 1,
      client_mutation_id = 'c2000000-0000-4000-8000-000000000033'
    WHERE id = 'c2000000-0000-4000-8000-000000000030'
  $$,
  'moves a start date while retaining the reminder time'
);
SELECT is(
  (SELECT local_date FROM public.tasks_reminders
    WHERE task_id = 'c2000000-0000-4000-8000-000000000030'),
  DATE '2099-08-04',
  'rebinds the active reminder to the new start date'
);
UPDATE public.tasks_todos
SET start_date = NULL, today_section = 'next', revision = revision + 1,
  client_mutation_id = 'c2000000-0000-4000-8000-000000000034'
WHERE id = 'c2000000-0000-4000-8000-000000000030';
SELECT is(
  (SELECT status FROM public.tasks_reminders
    WHERE task_id = 'c2000000-0000-4000-8000-000000000030'),
  'active',
  'keeps the reminder active when a future Start becomes Today work'
);
SELECT is(
  (SELECT local_date FROM public.tasks_reminders
    WHERE task_id = 'c2000000-0000-4000-8000-000000000030'),
  (clock_timestamp() AT TIME ZONE 'America/Los_Angeles')::date,
  'rebinds a Today reminder to the owner planning date'
);
UPDATE public.tasks_todos
SET today_section = NULL, revision = revision + 1,
  client_mutation_id = 'c2000000-0000-4000-8000-000000000038'
WHERE id = 'c2000000-0000-4000-8000-000000000030';
SELECT is(
  (SELECT status FROM public.tasks_reminders
    WHERE task_id = 'c2000000-0000-4000-8000-000000000030'),
  'canceled',
  'cancels the reminder when the complete Start intent clears'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, start_date, order_key,
  client_mutation_id
) VALUES
  (
    'c2000000-0000-4000-8000-000000000050',
    'c2000000-0000-4000-8000-000000000001',
    'Elapsed Today reminder', 'anytime', current_date + 1, 'a3',
    'c2000000-0000-4000-8000-000000000051'
  ),
  (
    'c2000000-0000-4000-8000-000000000052',
    'c2000000-0000-4000-8000-000000000001',
    'Someday reminder', 'anytime', current_date + 1, 'a4',
    'c2000000-0000-4000-8000-000000000053'
  );
SELECT public.tasks_save_start_reminder(
  NULL, NULL, 'todo', 'c2000000-0000-4000-8000-000000000050',
  '00:00', 'America/Los_Angeles', 'earlier',
  'c2000000-0000-4000-8000-000000000054'
);
SELECT public.tasks_save_start_reminder(
  NULL, NULL, 'todo', 'c2000000-0000-4000-8000-000000000052',
  '23:59', 'America/Los_Angeles', 'earlier',
  'c2000000-0000-4000-8000-000000000055'
);
UPDATE public.tasks_todos
SET start_date = NULL, today_section = 'inbox', revision = revision + 1,
  client_mutation_id = 'c2000000-0000-4000-8000-000000000056'
WHERE id = 'c2000000-0000-4000-8000-000000000050';
SELECT is(
  (SELECT status FROM public.tasks_reminders
    WHERE task_id = 'c2000000-0000-4000-8000-000000000050'),
  'canceled',
  'clears an elapsed reminder when a future task moves into Today'
);
UPDATE public.tasks_todos
SET destination = 'someday', revision = revision + 1,
  client_mutation_id = 'c2000000-0000-4000-8000-000000000057'
WHERE id = 'c2000000-0000-4000-8000-000000000052';
SELECT is(
  (SELECT status FROM public.tasks_reminders
    WHERE task_id = 'c2000000-0000-4000-8000-000000000052'),
  'canceled',
  'clears a reminder when its task moves to Someday'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, start_date, today_section, order_key,
  client_mutation_id
) VALUES (
  'c2000000-0000-4000-8000-000000000035',
  'c2000000-0000-4000-8000-000000000001',
  'Activation root', 'anytime', DATE '2099-08-05', 'later', 'a2',
  'c2000000-0000-4000-8000-000000000036'
);
SELECT set_config(
  'test.tasks_v12_activation_reminder',
  public.tasks_save_start_reminder(
    NULL, NULL, 'todo', 'c2000000-0000-4000-8000-000000000035',
    '09:15', 'America/Los_Angeles', 'earlier',
    'c2000000-0000-4000-8000-000000000037'
  )::text,
  false
);

RESET ROLE;
SELECT set_config(
  'test.tasks_v12_activation',
  tasks_private.activate_due_roots(
    '2099-08-05 08:00:00+00',
    'c2000000-0000-4000-8000-000000000001'
  )::text,
  false
);
SELECT is(
  (current_setting('test.tasks_v12_activation')::jsonb ->> 'activated_todos')::integer,
  1,
  'activates each reached to-do once'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT is(
  (SELECT start_date FROM public.tasks_todos
    WHERE id = 'c2000000-0000-4000-8000-000000000035'),
  NULL,
  'clears the reached Start Date durably'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'c2000000-0000-4000-8000-000000000035'),
  'inbox',
  'activates a reached Start into Today Inbox'
);
SELECT is(
  (SELECT status FROM public.tasks_reminders
    WHERE task_id = 'c2000000-0000-4000-8000-000000000035'),
  'active',
  'keeps the same-day reminder active after automatic activation'
);
SELECT is(
  (SELECT status FROM public.tasks_reminder_occurrences
    WHERE reminder_id = (
      current_setting('test.tasks_v12_activation_reminder')::jsonb #>> '{reminder,id}'
    )::uuid),
  'scheduled',
  'keeps the same-day reminder occurrence scheduled after activation'
);

SELECT set_config(
  'test.tasks_v12_mail',
  public.tasks_create_mail_capture(
    'c2000000-0000-4000-8000-000000000040',
    'c2000000-0000-4000-8000-000000000041',
    'Mail task', '', NULL, 'a2', NULL,
    'Work', 'Inbox', 'mail-v12', 'message://mail-v12', 'Archive', 'Mail task', NULL
  )::text,
  false
);
SELECT is(
  current_setting('test.tasks_v12_mail')::jsonb #>> '{task,today_section}',
  'inbox',
  'captures Mail work in Today Inbox'
);
SELECT is(
  current_setting('test.tasks_v12_mail')::jsonb #>> '{task,start_date}',
  NULL,
  'captures Mail work as active without inventing a Start Date'
);
SELECT is(
  current_setting('test.tasks_v12_mail')::jsonb #>> '{task,primary_link}',
  'message://mail-v12',
  'initializes editable Primary Link from the Mail deep link'
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET primary_link = NULL,
      revision = revision + 1,
      client_mutation_id = 'c2000000-0000-4000-8000-000000000042'
    WHERE id = 'c2000000-0000-4000-8000-000000000041'
  $$,
  'allows the editable Mail Primary Link to be cleared'
);
SELECT is(
  (SELECT primary_link FROM public.tasks_todos
    WHERE id = 'c2000000-0000-4000-8000-000000000041'),
  NULL,
  'preserves an explicitly cleared Primary Link'
);
SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, lifecycle, completed_at, destination,
      start_date, today_section, order_key, client_mutation_id
    ) VALUES (
      'c2000000-0000-4000-8000-000000000044',
      'c2000000-0000-4000-8000-000000000001',
      'Historical completed task', 'completed', clock_timestamp(), 'anytime',
      DATE '2020-01-01', 'later', 'a4',
      'c2000000-0000-4000-8000-000000000045'
    )
  $$,
  'allows retained terminal task history with a past Start'
);
SELECT is(
  (SELECT start_date FROM public.tasks_todos
    WHERE id = 'c2000000-0000-4000-8000-000000000044'),
  DATE '2020-01-01',
  'preserves the historical terminal task Start'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'c2000000-0000-4000-8000-000000000044'),
  NULL,
  'clears the obsolete terminal task horizon'
);
RESET ROLE;
SELECT is(
  tasks_private.normalize_export_v12_record(
    'tasks_todos',
    (
      SELECT to_jsonb(task) - 'owner_id'
      FROM public.tasks_todos AS task
      WHERE task.id = 'c2000000-0000-4000-8000-000000000041'
    ),
    (clock_timestamp() AT TIME ZONE 'America/Los_Angeles')::date
  ) ->> 'primary_link',
  NULL,
  'preserves explicit Primary Link null through export normalization'
);
SELECT is(
  tasks_private.normalize_export_v12_record(
    'tasks_todos',
    (
      SELECT (to_jsonb(task) - 'owner_id') - 'primary_link'
      FROM public.tasks_todos AS task
      WHERE task.id = 'c2000000-0000-4000-8000-000000000041'
    ),
    (clock_timestamp() AT TIME ZONE 'America/Los_Angeles')::date
  ) ->> 'primary_link',
  'message://mail-v12',
  'initializes a missing legacy Primary Link from supported provenance'
);
SELECT is(
  tasks_private.normalize_export_v12_record(
    'tasks_todos',
    jsonb_build_object(
      'destination', 'anytime',
      'start_date', '2099-07-22',
      'today_section', 'later'
    ),
    DATE '2099-07-22'
  ) ->> 'today_section',
  'inbox',
  'normalizes a reached legacy future horizon to Today Inbox'
);
SELECT set_config('test.tasks_v12_export', public.tasks_create_export_v14()::text, false);
SELECT is(
  (current_setting('test.tasks_v12_export')::jsonb ->> 'schema_version')::integer,
  14,
  'creates schema-fourteen task exports'
);
SELECT ok(
  NOT (current_setting('test.tasks_v12_export')::jsonb
    #> '{manifest,collections}' @> '["tasks_headings"]'::jsonb),
  'omits headings from the portable collection manifest'
);
SELECT is(
  public.tasks_restore_export_current(
    current_setting('test.tasks_v12_export')::jsonb, true
  ) ->> 'schema_version',
  '14',
  'previews a schema-fourteen merge restore through the current boundary'
);

SELECT * FROM finish();
ROLLBACK;
