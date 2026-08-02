BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(14);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'ac000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'watch-owner@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    'ac000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'watch-foreign@example.test', '', now(),
    '{}', '{}', now(), now()
  );

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'ac000000-0000-4000-8000-000000000003',
  'ac000000-0000-4000-8000-000000000001',
  'UTC',
  'ac000000-0000-4000-8000-000000000004'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_create_inbox_from_watch(text,text,uuid,uuid)',
    'EXECUTE'
  ),
  false,
  'withholds Watch Inbox capture from authenticated SQL'
);
SELECT is(
  has_function_privilege(
    'service_role',
    'public.tasks_create_inbox_from_watch(text,text,uuid,uuid)',
    'EXECUTE'
  ),
  true,
  'grants Watch Inbox capture to the service boundary'
);
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_read_today_progress_for_watch(text)',
    'EXECUTE'
  ),
  false,
  'withholds Watch Today progress from authenticated SQL'
);
SELECT is(
  has_function_privilege(
    'service_role',
    'public.tasks_read_today_progress_for_watch(text)',
    'EXECUTE'
  ),
  true,
  'grants Watch Today progress to the service boundary'
);

SELECT is(
  public.tasks_issue_widget_completion_credential(
    'ac000000-0000-4000-8000-000000000001',
    'ac000000-0000-4000-8000-000000000005',
    'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    clock_timestamp() + interval '90 days'
  ) ->> 'owner_id',
  'ac000000-0000-4000-8000-000000000001',
  'issues a credential for the Watch owner'
);

SELECT is(
  public.tasks_create_inbox_from_watch(
    'invalid', 'Watch capture',
    'ac000000-0000-4000-8000-000000000010',
    'ac000000-0000-4000-8000-000000000011'
  ) #>> '{code}',
  'invalid_request',
  'rejects malformed Watch capture authority'
);

SELECT is(
  public.tasks_create_inbox_from_watch(
    'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    '  Watch capture  ',
    'ac000000-0000-4000-8000-000000000010',
    'ac000000-0000-4000-8000-000000000011'
  ) #>> '{outcome}',
  'accepted',
  'creates an owned Watch Inbox task'
);
SELECT is(
  (
    SELECT title || ':' || destination || ':' || today_section || ':'
      || entry_channel || ':' || last_mutation_channel
    FROM public.tasks_todos
    WHERE client_mutation_id = 'ac000000-0000-4000-8000-000000000010'
  ),
  'Watch capture:anytime:inbox:watch:watch',
  'stores the normalized task in Today Inbox with Watch attribution'
);
SELECT is(
  (
    SELECT start_date
    FROM public.tasks_todos
    WHERE client_mutation_id = 'ac000000-0000-4000-8000-000000000010'
  ),
  (clock_timestamp() AT TIME ZONE 'UTC')::date,
  'uses the owner planning date as the explicit Start date'
);
SELECT is(
  public.tasks_create_inbox_from_watch(
    'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    'Watch capture',
    'ac000000-0000-4000-8000-000000000010',
    'ac000000-0000-4000-8000-000000000011'
  ) #>> '{outcome}',
  'already_applied',
  'makes a Watch capture retry idempotent'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_todos
    WHERE client_mutation_id = 'ac000000-0000-4000-8000-000000000010'
  ),
  1::bigint,
  'does not duplicate the retried task'
);

SELECT set_config('garden.bath.tasks_activation', 'on', true);

INSERT INTO public.tasks_todos (
  id, owner_id, title, lifecycle, completed_at, disposition, deleted_at,
  deletion_root_id, destination, today_section, start_date, order_key,
  entry_channel, last_mutation_channel, client_mutation_id
) VALUES
  (
    'ac000000-0000-4000-8000-000000000020',
    'ac000000-0000-4000-8000-000000000001',
    'Completed today', 'completed', clock_timestamp(), 'present', NULL, NULL,
    'anytime', 'inbox', (clock_timestamp() AT TIME ZONE 'UTC')::date, 'a1',
    'web', 'web', 'ac000000-0000-4000-8000-000000000021'
  ),
  (
    'ac000000-0000-4000-8000-000000000022',
    'ac000000-0000-4000-8000-000000000001',
    'Deleted today', 'open', NULL, 'deleted', clock_timestamp(),
    'ac000000-0000-4000-8000-000000000022',
    'anytime', 'inbox', (clock_timestamp() AT TIME ZONE 'UTC')::date, 'a2',
    'web', 'web', 'ac000000-0000-4000-8000-000000000023'
  ),
  (
    'ac000000-0000-4000-8000-000000000024',
    'ac000000-0000-4000-8000-000000000001',
    'Future task', 'open', NULL, 'present', NULL, NULL,
    'anytime', NULL, (clock_timestamp() AT TIME ZONE 'UTC')::date + 1, 'a3',
    'web', 'web', 'ac000000-0000-4000-8000-000000000025'
  ),
  (
    'ac000000-0000-4000-8000-000000000026',
    'ac000000-0000-4000-8000-000000000002',
    'Foreign today', 'completed', clock_timestamp(), 'present', NULL, NULL,
    'anytime', 'inbox', (clock_timestamp() AT TIME ZONE 'UTC')::date, 'a0',
    'web', 'web', 'ac000000-0000-4000-8000-000000000027'
  );

SELECT set_config('garden.bath.tasks_activation', 'off', true);

SELECT is(
  public.tasks_read_today_progress_for_watch(
    'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
  ) #>> '{completedCount}',
  '1',
  'counts only completed owned present explicit-Today tasks'
);
SELECT is(
  public.tasks_read_today_progress_for_watch(
    'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
  ) #>> '{totalCount}',
  '2',
  'excludes deleted, future, and foreign tasks from Today progress'
);
SELECT is(
  public.tasks_read_today_progress_for_watch(
    'twc_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
  ) #>> '{type}',
  'todayProgress',
  'returns the versioned aggregate progress contract'
);

SELECT * FROM finish();
ROLLBACK;
