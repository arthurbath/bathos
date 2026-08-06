BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(26);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '9c000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'snapshot-a@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '9c000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'snapshot-b@example.test', '', now(),
    '{}', '{}', now(), now()
  );

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, automatic_list_sorting, client_mutation_id
) VALUES
  (
    '9c000000-0000-4000-8000-000000000003',
    '9c000000-0000-4000-8000-000000000001',
    'UTC',
    false,
    '9c000000-0000-4000-8000-000000000004'
  ),
  (
    '9c000000-0000-4000-8000-000000000005',
    '9c000000-0000-4000-8000-000000000002',
    'UTC',
    false,
    '9c000000-0000-4000-8000-000000000006'
  );

INSERT INTO public.bathos_user_settings (user_id)
VALUES
  ('9c000000-0000-4000-8000-000000000001'),
  ('9c000000-0000-4000-8000-000000000002');

INSERT INTO public.tasks_areas (
  id, owner_id, title, order_key, client_mutation_id
) VALUES
  (
    '9c000000-0000-4000-8000-000000000010',
    '9c000000-0000-4000-8000-000000000001',
    'First Area',
    'a0',
    '9c000000-0000-4000-8000-000000000011'
  ),
  (
    '9c000000-0000-4000-8000-000000000012',
    '9c000000-0000-4000-8000-000000000001',
    'Second Area',
    'a1',
    '9c000000-0000-4000-8000-000000000013'
  );

INSERT INTO public.tasks_todos (
  id, owner_id, title, notes, destination, today_section, start_date,
  deadline, primary_link, actionability, area_id, order_key, lifecycle,
  disposition, completed_at, deleted_at, deletion_root_id, client_mutation_id
) VALUES
  (
    '9c000000-0000-4000-8000-000000000020',
    '9c000000-0000-4000-8000-000000000001',
    'Inbox task', 'Secret notes must not leave Postgres', 'anytime', 'inbox',
    NULL, CURRENT_DATE, 'message://mail/item', 'waiting', NULL, 'a2',
    'open', 'present', NULL, NULL, NULL,
    '9c000000-0000-4000-8000-000000000021'
  ),
  (
    '9c000000-0000-4000-8000-000000000022',
    '9c000000-0000-4000-8000-000000000001',
    'Next area task', '', 'anytime', 'next',
    NULL, CURRENT_DATE + 2, 'javascript:alert(1)', 'actionable',
    '9c000000-0000-4000-8000-000000000010', 'a0',
    'open', 'present', NULL, NULL, NULL,
    '9c000000-0000-4000-8000-000000000023'
  ),
  (
    '9c000000-0000-4000-8000-000000000024',
    '9c000000-0000-4000-8000-000000000001',
    'Unscheduled area task', '', 'anytime', NULL,
    NULL, NULL, 'example.test/task', 'rechecking',
    '9c000000-0000-4000-8000-000000000012', 'a0',
    'open', 'present', NULL, NULL, NULL,
    '9c000000-0000-4000-8000-000000000025'
  ),
  (
    '9c000000-0000-4000-8000-000000000026',
    '9c000000-0000-4000-8000-000000000001',
    'Future task', '', 'anytime', NULL,
    CURRENT_DATE + 3, CURRENT_DATE + 1, NULL, 'waiting', NULL, 'a3',
    'open', 'present', NULL, NULL, NULL,
    '9c000000-0000-4000-8000-000000000027'
  ),
  (
    '9c000000-0000-4000-8000-000000000028',
    '9c000000-0000-4000-8000-000000000001',
    'Someday task', '', 'someday', NULL,
    NULL, NULL, NULL, 'waiting', NULL, 'a4',
    'open', 'present', NULL, NULL, NULL,
    '9c000000-0000-4000-8000-000000000029'
  ),
  (
    '9c000000-0000-4000-8000-000000000030',
    '9c000000-0000-4000-8000-000000000001',
    'Completed task', '', 'anytime', NULL,
    NULL, NULL, NULL, 'actionable', NULL, 'a5',
    'completed', 'present', clock_timestamp(), NULL, NULL,
    '9c000000-0000-4000-8000-000000000031'
  ),
  (
    '9c000000-0000-4000-8000-000000000032',
    '9c000000-0000-4000-8000-000000000001',
    'Deleted task', '', 'anytime', NULL,
    NULL, NULL, NULL, 'waiting', NULL, 'a6',
    'open', 'deleted', NULL, clock_timestamp(),
    '9c000000-0000-4000-8000-000000000032',
    '9c000000-0000-4000-8000-000000000033'
  ),
  (
    '9c000000-0000-4000-8000-000000000034',
    '9c000000-0000-4000-8000-000000000002',
    'Foreign private task', 'Foreign secret', 'anytime', 'inbox',
    NULL, NULL, NULL, 'waiting', NULL, 'a0',
    'open', 'present', NULL, NULL, NULL,
    '9c000000-0000-4000-8000-000000000035'
  ),
  (
    '9c000000-0000-4000-8000-000000000036',
    '9c000000-0000-4000-8000-000000000001',
    'First area overdue task', '', 'anytime', NULL,
    NULL, CURRENT_DATE - 1, NULL, 'waiting',
    '9c000000-0000-4000-8000-000000000010', 'a9',
    'open', 'present', NULL, NULL, NULL,
    '9c000000-0000-4000-8000-000000000037'
  );

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_read_widget_snapshot(text)',
    'EXECUTE'
  ),
  false,
  'withholds widget snapshot reads from ordinary authenticated SQL'
);

SELECT is(
  has_function_privilege(
    'service_role',
    'public.tasks_read_widget_snapshot(text)',
    'EXECUTE'
  ),
  true,
  'grants widget snapshot reads only to the service boundary'
);

SELECT is(
  public.tasks_read_widget_snapshot('invalid') #>> '{code}',
  'invalid_credential',
  'rejects a malformed widget credential without content'
);

SELECT lives_ok(
  $$
    SELECT public.tasks_issue_widget_completion_credential(
      '9c000000-0000-4000-8000-000000000001',
      '9c000000-0000-4000-8000-000000000040',
      'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      clock_timestamp() + interval '90 days'
    )
  $$,
  'issues the existing owner-and-installation-bound credential'
);

CREATE TEMP TABLE widget_snapshot AS
SELECT public.tasks_read_widget_snapshot(
  'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
) AS value;

SELECT is(
  (SELECT value #>> '{type}' FROM widget_snapshot),
  'snapshot',
  'returns a native snapshot response'
);

SELECT is(
  (SELECT value #>> '{schemaVersion}' FROM widget_snapshot),
  '2',
  'returns the current native snapshot schema'
);

SELECT is(
  (SELECT value #>> '{ownerId}' FROM widget_snapshot),
  '9c000000-0000-4000-8000-000000000001',
  'binds the projection to the credential owner'
);

SELECT is(
  (SELECT jsonb_array_length(value -> 'lists') FROM widget_snapshot),
  5,
  'returns every supported cached list'
);

SELECT is(
  (
    SELECT string_agg(task ->> 'summary', ',' ORDER BY ordinal)
    FROM widget_snapshot,
    jsonb_array_elements(value #> '{lists,0,tasks}')
      WITH ORDINALITY AS item(task, ordinal)
  ),
  'Inbox task,Next area task',
  'orders Today by horizon and manual order'
);

SELECT is(
  (
    SELECT string_agg(task ->> 'summary', ',' ORDER BY ordinal)
    FROM widget_snapshot,
    jsonb_array_elements(value #> '{lists,1,tasks}')
      WITH ORDINALITY AS item(task, ordinal)
  ),
  'Next area task,Future task',
  'uses future start before deadline and orders Upcoming by date buckets'
);

SELECT is(
  (SELECT value #>> '{lists,1,tasks,0,upcomingDate}' FROM widget_snapshot),
  (CURRENT_DATE + 2)::text,
  'projects the same authoritative Upcoming date used for list placement'
);

SELECT is(
  (SELECT value #>> '{lists,1,tasks,0,isRecurrenceProjection}' FROM widget_snapshot),
  'false',
  'identifies an ordinary Upcoming task as completable'
);

SELECT is(
  (
    SELECT string_agg(task ->> 'summary', ',' ORDER BY ordinal)
    FROM widget_snapshot,
    jsonb_array_elements(value #> '{lists,2,tasks}')
      WITH ORDINALITY AS item(task, ordinal)
  ),
  'Inbox task,Next area task,First area overdue task,Unscheduled area task',
  'orders Anytime with no-area tasks before ordered area buckets'
);

SELECT is(
  (SELECT value #>> '{lists,0,tasks,0,primaryLink,kind}' FROM widget_snapshot),
  'mail',
  'projects the approved Mail Primary Link transport'
);

SELECT is(
  (SELECT value #>> '{lists,0,tasks,1,primaryLink}' FROM widget_snapshot),
  NULL,
  'withholds an unsupported Primary Link protocol'
);

SELECT is(
  (
    SELECT task #>> '{primaryLink,href}'
    FROM widget_snapshot,
    jsonb_array_elements(value #> '{lists,2,tasks}') AS task
    WHERE task ->> 'summary' = 'Unscheduled area task'
  ),
  'https://example.test/task',
  'normalizes a scheme-less Primary Link like the web projection'
);

SELECT ok(
  (
    SELECT value::text NOT LIKE '%Secret notes%'
      AND value::text NOT LIKE '%Foreign private task%'
      AND value::text NOT LIKE '%Foreign secret%'
      AND value::text NOT LIKE '%checklist%'
      AND value::text NOT LIKE '%credential%'
    FROM widget_snapshot
  ),
  'withholds detailed and foreign task content'
);

UPDATE public.bathos_user_settings
SET tasks_quick_filter = 'actionable_waiting',
    tasks_quick_filter_updated_at = clock_timestamp()
WHERE user_id = '9c000000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT string_agg(task ->> 'summary', ',' ORDER BY ordinal)
    FROM jsonb_array_elements(
      public.tasks_read_widget_snapshot(
        'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
      ) #> '{lists,2,tasks}'
    ) WITH ORDINALITY AS item(task, ordinal)
  ),
  'Inbox task,Next area task,First area overdue task',
  'honors a two-state actionability quick filter during background reads'
);

UPDATE public.bathos_user_settings
SET tasks_quick_filter = 'waiting',
    tasks_quick_filter_updated_at = clock_timestamp()
WHERE user_id = '9c000000-0000-4000-8000-000000000001';

SELECT is(
  (
    public.tasks_read_widget_snapshot(
      'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
    ) #>> '{lists,0,totalCount}'
  ),
  '1',
  'honors the durable quick filter during background reads'
);

UPDATE public.tasks_user_settings
SET automatic_list_sorting = true,
    revision = revision + 1,
    client_mutation_id = '9c000000-0000-4000-8000-000000000041'
WHERE owner_id = '9c000000-0000-4000-8000-000000000001';

UPDATE public.bathos_user_settings
SET tasks_quick_filter = 'all',
    tasks_quick_filter_updated_at = clock_timestamp()
WHERE user_id = '9c000000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT string_agg(task ->> 'summary', ',' ORDER BY ordinal)
    FROM jsonb_array_elements(
      public.tasks_read_widget_snapshot(
        'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
      ) #> '{lists,2,tasks}'
    ) WITH ORDINALITY AS item(task, ordinal)
  ),
  'Inbox task,First area overdue task,Next area task,Unscheduled area task',
  'honors automatic sorting within each area without crossing area buckets'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, actionability, order_key, client_mutation_id
)
SELECT
  gen_random_uuid(),
  '9c000000-0000-4000-8000-000000000001',
  'Bounded someday ' || value,
  'someday',
  'waiting',
  'z' || lpad(value::text, 3, '0'),
  gen_random_uuid()
FROM generate_series(1, 51) AS value;

SELECT is(
  (
    public.tasks_read_widget_snapshot(
      'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
    ) #>> '{lists,3,totalCount}'
  ),
  '52',
  'reports the complete filtered list count'
);

SELECT is(
  (
    SELECT jsonb_array_length(
      public.tasks_read_widget_snapshot(
        'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
      ) #> '{lists,3,tasks}'
    )
  ),
  50,
  'bounds the returned list projection to 50 tasks'
);

SELECT is(
  (
    public.tasks_read_widget_snapshot(
      'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
    ) #>> '{lists,3,truncated}'
  ),
  'true',
  'marks a bounded list as truncated'
);

SELECT is(
  public.tasks_revoke_widget_completion_credential(
    'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
  ) #>> '{outcome}',
  'revoked',
  'revokes snapshot authority with the existing credential lifecycle'
);

SELECT is(
  public.tasks_read_widget_snapshot(
    'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
  ) #>> '{code}',
  'invalid_credential',
  'rejects a revoked credential without content'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'powersync'
      AND schemaname = 'tasks_private'
  ),
  0::bigint,
  'keeps native credential authority outside PowerSync'
);

SELECT * FROM finish();
ROLLBACK;
