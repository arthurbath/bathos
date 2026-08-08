BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(24);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'fa000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'first-pair@example.test', '', now(),
  '{}', '{}', now(), now()
);

INSERT INTO public.bathos_module_access_grants (
  module_id, user_id, grant_source, granted_by
)
SELECT 'tasks', id, 'manual', NULL
FROM auth.users
WHERE email LIKE '%@example.test'
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'fa000000-0000-4000-8000-000000000002',
  'fa000000-0000-4000-8000-000000000001',
  'UTC',
  'fa000000-0000-4000-8000-000000000003'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, notes, actionability, destination, order_key,
  upcoming_order_key, start_date, deadline, today_section, client_mutation_id
) VALUES
  (
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000001',
    'Adopt Start Today', '', 'actionable', 'anytime', 'a0', 'a0',
    current_date + 20, current_date + 30, NULL,
    'fa000000-0000-4000-8000-000000000011'
  ),
  (
    'fa000000-0000-4000-8000-000000000020',
    'fa000000-0000-4000-8000-000000000001',
    'Adopt Deadline Today', '', 'actionable', 'anytime', 'a1', 'a1',
    NULL, current_date + 30, 'next',
    'fa000000-0000-4000-8000-000000000021'
  ),
  (
    'fa000000-0000-4000-8000-000000000030',
    'fa000000-0000-4000-8000-000000000001',
    'Adopt Future Start', '', 'actionable', 'anytime', 'a2', 'a2',
    NULL, NULL, 'inbox',
    'fa000000-0000-4000-8000-000000000031'
  );

SELECT set_config(
  'test.first_start',
  public.tasks_create_recurrence_from_task_v2(
    'fa000000-0000-4000-8000-000000000010',
    'calendar', 'daily', 1, current_date, 'start',
    '{"version":2}'::jsonb, 'never', NULL, NULL, NULL, 6,
    'fa000000-0000-4000-8000-000000000012'
  )::text,
  false
);

SELECT is(
  (SELECT start_date FROM public.tasks_todos
    WHERE id = 'fa000000-0000-4000-8000-000000000010'),
  current_date,
  'a Start-based source task receives the first Start even when it is today'
);
SELECT is(
  (SELECT deadline FROM public.tasks_todos
    WHERE id = 'fa000000-0000-4000-8000-000000000010'),
  current_date + 6,
  'a Start-based source task replaces its prior Deadline with the first pair'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'fa000000-0000-4000-8000-000000000010'),
  'inbox',
  'an adopted source task whose Start is today enters Today Inbox'
);
SELECT is(
  current_setting('test.first_start')::jsonb #>> '{occurrence,root_id}',
  'fa000000-0000-4000-8000-000000000010',
  'the original Start-based task is the adopted first occurrence'
);
SELECT is(
  (current_setting('test.first_start')::jsonb
    #>> '{definition,next_occurrence_date}')::date,
  current_date + 1,
  'the Start-based prototype advances beyond the adopted first occurrence'
);

SELECT set_config(
  'test.first_deadline',
  public.tasks_create_recurrence_from_task_v2(
    'fa000000-0000-4000-8000-000000000020',
    'calendar', 'weekly', 1, current_date, 'deadline',
    jsonb_build_object(
      'version', 2,
      'weekdays', jsonb_build_array(extract(isodow FROM current_date + 6)::integer)
    ),
    'never', NULL, NULL, NULL, 6,
    'fa000000-0000-4000-8000-000000000022'
  )::text,
  false
);

SELECT is(
  (SELECT start_date FROM public.tasks_todos
    WHERE id = 'fa000000-0000-4000-8000-000000000020'),
  current_date,
  'a Deadline-based source task receives its implied first Start today'
);
SELECT is(
  (SELECT deadline FROM public.tasks_todos
    WHERE id = 'fa000000-0000-4000-8000-000000000020'),
  current_date + 6,
  'a Deadline-based source task receives the accepted first Deadline'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'fa000000-0000-4000-8000-000000000020'),
  'inbox',
  'a Deadline-based source task with an implied Start today enters Inbox'
);
SELECT is(
  current_setting('test.first_deadline')::jsonb #>> '{occurrence,root_id}',
  'fa000000-0000-4000-8000-000000000020',
  'the original Deadline-based task is the adopted first occurrence'
);

SELECT set_config(
  'test.first_future',
  public.tasks_create_recurrence_from_task_v2(
    'fa000000-0000-4000-8000-000000000030',
    'calendar', 'daily', 1, current_date + 10, 'start',
    '{"version":2}'::jsonb, 'never', NULL, NULL, NULL, 2,
    'fa000000-0000-4000-8000-000000000032'
  )::text,
  false
);

SELECT is(
  (SELECT start_date FROM public.tasks_todos
    WHERE id = 'fa000000-0000-4000-8000-000000000030'),
  current_date + 10,
  'a future first Start is applied to the original ordinary task'
);
SELECT is(
  (SELECT deadline FROM public.tasks_todos
    WHERE id = 'fa000000-0000-4000-8000-000000000030'),
  current_date + 12,
  'a future first Deadline is applied to the original ordinary task'
);
SELECT is(
  (SELECT today_section FROM public.tasks_todos
    WHERE id = 'fa000000-0000-4000-8000-000000000030'),
  NULL::text,
  'a future adopted occurrence leaves the Today horizon'
);
SELECT is(
  current_setting('test.first_future')::jsonb #>> '{occurrence,root_id}',
  'fa000000-0000-4000-8000-000000000030',
  'future creation preserves the original task identity'
);
SELECT is(
  (current_setting('test.first_future')::jsonb
    #>> '{definition,next_occurrence_date}')::date,
  current_date + 11,
  'a future prototype also advances beyond its adopted first pair'
);

SELECT set_config(
  'test.edit_start_today',
  public.tasks_edit_recurrence_v2(
    (current_setting('test.first_future')::jsonb #>> '{definition,id}')::uuid,
    (current_setting('test.first_future')::jsonb
      #>> '{definition,record_revision}')::bigint,
    'calendar', 'daily', 1, current_date, 'start', 'UTC', 'latest', 100,
    NULL, '{"version":2}'::jsonb, 'never', NULL, NULL, NULL, 2,
    current_setting('test.first_future')::jsonb -> 'revision'
      -> 'prototype_snapshot',
    'fa000000-0000-4000-8000-000000000033'
  )::text,
  false
);

SELECT is(
  (current_setting('test.edit_start_today')::jsonb
    ->> 'generated_count')::integer,
  1,
  'editing an existing Start-based prototype to today generates immediately'
);
SELECT is(
  (
    SELECT task.start_date
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_todos AS task
      ON task.owner_id = occurrence.owner_id AND task.id = occurrence.root_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.first_future')::jsonb #>> '{definition,id}'
    )::uuid
      AND occurrence.recurrence_revision = 2
  ),
  current_date,
  'the same-day edited occurrence retains Start today'
);
SELECT is(
  (
    SELECT task.today_section
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_todos AS task
      ON task.owner_id = occurrence.owner_id AND task.id = occurrence.root_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.first_future')::jsonb #>> '{definition,id}'
    )::uuid
      AND occurrence.recurrence_revision = 2
  ),
  'inbox',
  'the same-day edited occurrence enters Today Inbox'
);
SELECT is(
  (
    SELECT task.deadline
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_todos AS task
      ON task.owner_id = occurrence.owner_id AND task.id = occurrence.root_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.first_future')::jsonb #>> '{definition,id}'
    )::uuid
      AND occurrence.recurrence_revision = 2
  ),
  current_date + 2,
  'the same-day edited occurrence receives its derived Deadline'
);
SELECT is(
  (current_setting('test.edit_start_today')::jsonb
    #>> '{definition,next_occurrence_date}')::date,
  current_date + 1,
  'the edited prototype advances after atomically generating today'
);

SELECT is(
  (
    public.tasks_edit_recurrence_v2(
      (current_setting('test.first_future')::jsonb #>> '{definition,id}')::uuid,
      (current_setting('test.first_future')::jsonb
        #>> '{definition,record_revision}')::bigint,
      'calendar', 'daily', 1, current_date, 'start', 'UTC', 'latest', 100,
      NULL, '{"version":2}'::jsonb, 'never', NULL, NULL, NULL, 2,
      current_setting('test.first_future')::jsonb -> 'revision'
        -> 'prototype_snapshot',
      'fa000000-0000-4000-8000-000000000033'
    ) ->> 'outcome'
  ),
  'already_applied',
  'replaying a same-day prototype edit does not create another occurrence'
);

SELECT set_config(
  'test.edit_deadline_today',
  public.tasks_edit_recurrence_v2(
    (current_setting('test.first_deadline')::jsonb #>> '{definition,id}')::uuid,
    (current_setting('test.first_deadline')::jsonb
      #>> '{definition,record_revision}')::bigint,
    'calendar', 'weekly', 1, current_date, 'deadline', 'UTC', 'latest', 100,
    NULL,
    jsonb_build_object(
      'version', 2,
      'weekdays', jsonb_build_array(extract(isodow FROM current_date + 5)::integer)
    ),
    'never', NULL, NULL, NULL, 5,
    current_setting('test.first_deadline')::jsonb -> 'revision'
      -> 'prototype_snapshot',
    'fa000000-0000-4000-8000-000000000023'
  )::text,
  false
);

SELECT is(
  (current_setting('test.edit_deadline_today')::jsonb
    ->> 'generated_count')::integer,
  1,
  'editing a Deadline-based prototype with an implied Start today generates immediately'
);
SELECT is(
  (
    SELECT task.start_date
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_todos AS task
      ON task.owner_id = occurrence.owner_id AND task.id = occurrence.root_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.first_deadline')::jsonb #>> '{definition,id}'
    )::uuid
      AND occurrence.recurrence_revision = 2
  ),
  current_date,
  'the Deadline-based edited occurrence retains its implied Start today'
);
SELECT is(
  (
    SELECT task.deadline
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_todos AS task
      ON task.owner_id = occurrence.owner_id AND task.id = occurrence.root_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.first_deadline')::jsonb #>> '{definition,id}'
    )::uuid
      AND occurrence.recurrence_revision = 2
  ),
  current_date + 5,
  'the Deadline-based edited occurrence receives the accepted Deadline'
);
SELECT is(
  (
    SELECT task.today_section
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_todos AS task
      ON task.owner_id = occurrence.owner_id AND task.id = occurrence.root_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.first_deadline')::jsonb #>> '{definition,id}'
    )::uuid
      AND occurrence.recurrence_revision = 2
  ),
  'inbox',
  'the Deadline-based edited occurrence enters Today Inbox'
);

SELECT * FROM finish();
ROLLBACK;
