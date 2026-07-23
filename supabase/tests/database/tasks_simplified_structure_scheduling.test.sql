BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(34);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'c2000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'tasks-v12@example.test', '', now(),
  '{}', '{}', now(), now()
);

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
  'next',
  'defaults a dated task without a horizon to Next'
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
  'Start Date must be later than today in the owner planning time zone',
  'rejects a reached Start Date at the PostgreSQL mutation boundary'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET start_date = NULL, revision = revision + 1,
      client_mutation_id = 'c2000000-0000-4000-8000-000000000022'
    WHERE id = 'c2000000-0000-4000-8000-000000000020'
  $$,
  'clears a task start date without requiring a separate horizon write'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'c2000000-0000-4000-8000-000000000020'),
  'next',
  'retains the active day horizon when the start date clears'
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
    '09:15', 'America/Los_Angeles', 'earlier',
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
SET start_date = NULL, revision = revision + 1,
  client_mutation_id = 'c2000000-0000-4000-8000-000000000034'
WHERE id = 'c2000000-0000-4000-8000-000000000030';
SELECT is(
  (SELECT status FROM public.tasks_reminders
    WHERE task_id = 'c2000000-0000-4000-8000-000000000030'),
  'canceled',
  'cancels the reminder when its parent start date clears'
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
  'later',
  'retains the selected day horizon after activation'
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
  'next',
  'captures Mail work in Next'
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

INSERT INTO public.tasks_projects (
  id, owner_id, title, destination, start_date, order_key, planning_order_key,
  client_mutation_id
) VALUES (
  'c2000000-0000-4000-8000-000000000050',
  'c2000000-0000-4000-8000-000000000001',
  'Flat project', 'anytime', NULL, 'a0', 'a0',
  'c2000000-0000-4000-8000-000000000051'
);
INSERT INTO public.tasks_todos (
  id, owner_id, project_id, title, destination, start_date,
  order_key, hierarchy_order_key, client_mutation_id
) VALUES (
  'c2000000-0000-4000-8000-000000000052',
  'c2000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000050',
  'Flat child', 'anytime', NULL, 'a3', 'a0',
  'c2000000-0000-4000-8000-000000000053'
);
SELECT set_config(
  'test.tasks_v12_template',
  public.tasks_capture_template(
    NULL, 'project', 'c2000000-0000-4000-8000-000000000050',
    'Flat project template', DATE '2099-07-22',
    'c2000000-0000-4000-8000-000000000054'
  )::text,
  false
);
SELECT ok(
  NOT (current_setting('test.tasks_v12_template')::jsonb
    #> '{revision,snapshot}' ? 'headings'),
  'captures a project template without heading structure'
);
SELECT set_config(
  'test.tasks_v12_instance',
  public.tasks_instantiate_template(
    (current_setting('test.tasks_v12_template')::jsonb #>> '{template,id}')::uuid,
    1, DATE '2099-07-23', 'c2000000-0000-4000-8000-000000000055'
  )::text,
  false
);
SELECT ok(
  NOT (current_setting('test.tasks_v12_instance')::jsonb #> '{result}' ? 'heading_ids'),
  'instantiates a project template without heading identifiers'
);
SELECT is(
  jsonb_array_length(current_setting('test.tasks_v12_instance')::jsonb
    #> '{result,task_ids}'),
  1,
  'instantiates the flattened project child'
);

SELECT set_config(
  'test.tasks_v12_delete',
  public.tasks_request_mcp_hierarchy_operation(
    'c2000000-0000-4000-8000-000000000060', 'project',
    'c2000000-0000-4000-8000-000000000050', 1, 'delete', 'cascade'
  )::text,
  false
);
SELECT is(
  (SELECT disposition FROM public.tasks_projects
    WHERE id = 'c2000000-0000-4000-8000-000000000050'),
  'deleted',
  'deletes a flat project hierarchy through the MCP boundary'
);
SELECT set_config(
  'test.tasks_v12_restore',
  public.tasks_request_mcp_hierarchy_operation(
    'c2000000-0000-4000-8000-000000000061', 'project',
    'c2000000-0000-4000-8000-000000000050', 2, 'restore', 'cascade'
  )::text,
  false
);
SELECT is(
  (SELECT disposition FROM public.tasks_todos
    WHERE id = 'c2000000-0000-4000-8000-000000000052'),
  'present',
  'restores flat project descendants through the MCP boundary'
);

SELECT set_config('test.tasks_v12_export', public.tasks_create_export_v12()::text, false);
SELECT is(
  (current_setting('test.tasks_v12_export')::jsonb ->> 'schema_version')::integer,
  12,
  'creates schema-12 task exports'
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
  '12',
  'previews a schema-12 merge restore through the current compatibility boundary'
);

SELECT * FROM finish();
ROLLBACK;
