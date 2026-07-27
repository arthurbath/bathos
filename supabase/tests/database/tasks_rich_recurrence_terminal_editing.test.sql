BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(24);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '9a000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'rich-recurrence@example.test', '', now(),
  '{}', '{}', now(), now()
);

SELECT has_column(
  'public', 'tasks_recurrence_revisions', 'rule_config',
  'stores structured calendar rule configuration'
);
SELECT has_column(
  'public', 'tasks_recurrence_revisions', 'end_mode',
  'stores recurrence end mode'
);
SELECT has_column(
  'public', 'tasks_recurrence_revisions', 'end_after_count',
  'stores count-bounded recurrence'
);
SELECT has_column(
  'public', 'tasks_recurrence_revisions', 'end_on_date',
  'stores date-bounded recurrence'
);
SELECT has_column(
  'public', 'tasks_recurrence_revisions', 'reminder_local_time',
  'stores inherited reminder time'
);
SELECT has_column(
  'public', 'tasks_recurrence_revisions', 'deadline_offset_days',
  'stores Start lead time for repeating Deadlines'
);
SELECT has_column(
  'public', 'tasks_recurrence_occurrences', 'origin',
  'distinguishes adopted and generated occurrences'
);
SELECT has_function(
  'public', 'tasks_create_recurrence_from_task',
  ARRAY[
    'uuid', 'text', 'text', 'text', 'integer', 'date', 'jsonb', 'text',
    'integer', 'date', 'time without time zone', 'integer', 'uuid', 'text', 'text'
  ],
  'adopts an existing task into a rich recurrence'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  '9a000000-0000-4000-8000-000000000010',
  '9a000000-0000-4000-8000-000000000001',
  'UTC',
  '9a000000-0000-4000-8000-000000000011'
);
INSERT INTO public.tasks_todos (
  id, owner_id, title, notes, destination, order_key, client_mutation_id
) VALUES
  (
    '9a000000-0000-4000-8000-000000000012',
    '9a000000-0000-4000-8000-000000000001',
    'Calendar source', 'Inherited notes', 'anytime', 'a0',
    '9a000000-0000-4000-8000-000000000013'
  ),
  (
    '9a000000-0000-4000-8000-000000000014',
    '9a000000-0000-4000-8000-000000000001',
    'Completion source', '', 'anytime', 'a1',
    '9a000000-0000-4000-8000-000000000015'
  );

SELECT set_config(
  'test.rich_calendar',
  public.tasks_create_recurrence_from_task(
    '9a000000-0000-4000-8000-000000000012',
    'Calendar source',
    'calendar',
    'daily',
    1,
    '2027-01-01',
    '{}'::jsonb,
    'after',
    3,
    NULL,
    '09:30',
    2,
    '9a000000-0000-4000-8000-000000000020'
  )::text,
  false
);
SELECT is(
  current_setting('test.rich_calendar')::jsonb ->> 'outcome',
  'accepted',
  'accepts a rich calendar recurrence'
);
SELECT is(
  current_setting('test.rich_calendar')::jsonb #>> '{occurrence,origin}',
  'adopted',
  'adopts the source as the first occurrence'
);
SELECT is(
  current_setting('test.rich_calendar')::jsonb #>> '{occurrence,template_instantiation_id}',
  NULL,
  'does not duplicate the adopted source through template instantiation'
);
SELECT is(
  (
    SELECT recurrence_definition_id::text
    FROM public.tasks_todos
    WHERE id = '9a000000-0000-4000-8000-000000000012'
  ),
  current_setting('test.rich_calendar')::jsonb #>> '{definition,id}',
  'stores recurrence provenance on the adopted task'
);
SELECT is(
  (
    public.tasks_evaluate_recurrence(
      (current_setting('test.rich_calendar')::jsonb #>> '{definition,id}')::uuid,
      '2027-01-03',
      '9a000000-0000-4000-8000-000000000021'
    ) ->> 'generated_count'
  )::integer,
  2,
  'generates only the remaining count-bounded occurrences'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.rich_calendar')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  3::bigint,
  'retains exactly one adopted and two generated logical occurrences'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.rich_calendar')::jsonb #>> '{definition,id}'
    )::uuid
      AND origin = 'generated'
      AND template_instantiation_id IS NOT NULL
  ),
  2::bigint,
  'generated occurrences retain their template instantiations'
);
SELECT results_eq(
  $$
    SELECT start_date, deadline
    FROM public.tasks_todos
    WHERE recurrence_definition_id = (
      current_setting('test.rich_calendar')::jsonb #>> '{definition,id}'
    )::uuid
      AND id <> '9a000000-0000-4000-8000-000000000012'
    ORDER BY deadline
  $$,
  $$
    VALUES
      ('2026-12-31'::date, '2027-01-02'::date),
      ('2027-01-01'::date, '2027-01-03'::date)
  $$,
  'derives each generated Start from its repeating Deadline'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_reminders
    WHERE task_id IN (
      SELECT id FROM public.tasks_todos
      WHERE recurrence_definition_id = (
        current_setting('test.rich_calendar')::jsonb #>> '{definition,id}'
      )::uuid
        AND id <> '9a000000-0000-4000-8000-000000000012'
    )
      AND local_time = '09:30'
      AND status = 'active'
  ),
  2::bigint,
  'inherits the configured reminder on every generated Start'
);
SELECT is(
  (
    public.tasks_evaluate_recurrence(
      (current_setting('test.rich_calendar')::jsonb #>> '{definition,id}')::uuid,
      '2027-01-03',
      '9a000000-0000-4000-8000-000000000021'
    ) ->> 'outcome'
  ),
  'already_applied',
  'retries rich evaluation idempotently'
);
SELECT is(
  (
    public.tasks_evaluate_recurrence(
      (current_setting('test.rich_calendar')::jsonb #>> '{definition,id}')::uuid,
      '2027-01-20',
      '9a000000-0000-4000-8000-000000000022'
    ) ->> 'generated_count'
  )::integer,
  0,
  'honors an inclusive occurrence-count boundary'
);

SELECT set_config(
  'test.after_completion',
  public.tasks_create_recurrence_from_task(
    '9a000000-0000-4000-8000-000000000014',
    'Completion source',
    'after_completion',
    'weekly',
    1,
    '2026-07-26',
    '{}'::jsonb,
    'after',
    2,
    NULL,
    NULL,
    NULL,
    '9a000000-0000-4000-8000-000000000023'
  )::text,
  false
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET lifecycle = 'completed',
        completed_at = '2026-07-26T12:00:00Z',
        revision = revision + 1,
        client_mutation_id = '9a000000-0000-4000-8000-000000000024'
    WHERE id = '9a000000-0000-4000-8000-000000000014'
  $$,
  'advances an after-completion recurrence from authoritative completion'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.after_completion')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  2::bigint,
  'creates exactly one successor after completion'
);
SELECT is(
  (
    SELECT scheduled_date
    FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.after_completion')::jsonb #>> '{definition,id}'
    )::uuid
      AND origin = 'generated'
  ),
  '2026-08-02'::date,
  'derives the successor date in the owner planning timezone'
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET title = 'Edited while Done',
        deadline = '2027-02-01',
        actionability = 'waiting',
        revision = revision + 1,
        client_mutation_id = '9a000000-0000-4000-8000-000000000025'
    WHERE id = '9a000000-0000-4000-8000-000000000014'
  $$,
  'permits ordinary metadata editing while a task remains terminal'
);
SELECT is(
  (
    SELECT lifecycle || ':' || title
    FROM public.tasks_todos
    WHERE id = '9a000000-0000-4000-8000-000000000014'
  ),
  'completed:Edited while Done',
  'does not implicitly recover a terminal task during metadata editing'
);
SELECT * FROM finish();
ROLLBACK;
