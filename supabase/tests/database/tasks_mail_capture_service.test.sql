BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(17);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '71000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'mail-capture-owner-a@example.test', '', now(), '{}', '{}', now(), now()
  ),
  (
    '72000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'mail-capture-owner-b@example.test', '', now(), '{}', '{}', now(), now()
  );

SELECT has_function(
  'public',
  'tasks_create_mail_capture',
  ARRAY[
    'uuid', 'uuid', 'text', 'text', 'date', 'text', 'text',
    'text', 'text', 'text', 'text', 'text', 'text', 'uuid'
  ],
  'creates Mail tasks and source records through one atomic function'
);

SELECT is(
  has_function_privilege(
    'anon',
    'public.tasks_create_mail_capture(uuid,uuid,text,text,date,text,text,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'withholds Mail capture from anonymous callers'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_create_mail_capture(uuid,uuid,text,text,date,text,text,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  true,
  'grants Mail capture to authenticated callers'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

CREATE TEMP TABLE first_capture AS
SELECT public.tasks_create_mail_capture(
  '71000000-0000-4000-8000-000000000010',
  '71000000-0000-4000-8000-000000000011',
  'Reply to project update',
  'Review the source message and reply.',
  '2026-07-20',
  'a0',
  NULL,
  'Work',
  'INBOX',
  'mail-owner-a@example.test',
  'message://%3Cmail-owner-a%40example.test%3E',
  'Archive',
  'Project update',
  NULL
) AS result;

SELECT is(
  (SELECT result ->> 'idempotency_outcome' FROM first_capture),
  'created',
  'reports a newly created Mail capture'
);

SELECT is(
  (SELECT result #>> '{task,entry_channel}' FROM first_capture),
  'mail_automation',
  'records Mail automation entry provenance'
);

SELECT is(
  (SELECT result #>> '{task,destination}' FROM first_capture),
  'today',
  'places processed Mail capture in Today'
);

SELECT is(
  (SELECT result #>> '{mail_source,lifecycle}' FROM first_capture),
  'retained',
  'starts the source lifecycle in retained state'
);

SELECT is(
  (SELECT result #>> '{receipt,transition}' FROM first_capture),
  'create',
  'returns the accepted task creation receipt'
);

SELECT is(
  public.tasks_create_mail_capture(
    '71000000-0000-4000-8000-000000000010',
    '71000000-0000-4000-8000-000000000099',
    'Reply to project update',
    'Review the source message and reply.',
    '2026-07-20', 'a0', NULL, 'Work', 'INBOX',
    'mail-owner-a@example.test',
    'message://%3Cmail-owner-a%40example.test%3E',
    'Archive', 'Project update', NULL
  ) ->> 'idempotency_outcome',
  'already_applied',
  'replays the exact idempotency key without duplication'
);

SELECT is(
  public.tasks_create_mail_capture(
    '71000000-0000-4000-8000-000000000012',
    '71000000-0000-4000-8000-000000000013',
    'A newly enriched title',
    'New notes after a caller restart.',
    '2026-07-20', 'a1', NULL, 'Work', 'INBOX',
    'mail-owner-a@example.test',
    'message://%3Cmail-owner-a%40example.test%3E',
    'Archive', 'Project update', NULL
  ) ->> 'idempotency_outcome',
  'source_already_applied',
  'deduplicates the same owner account and message across new request IDs'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_todos),
  1::bigint,
  'keeps one task after idempotency and source-identity retries'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_create_mail_capture(
      '71000000-0000-4000-8000-000000000010',
      '71000000-0000-4000-8000-000000000011',
      'Different title',
      'Review the source message and reply.',
      '2026-07-20', 'a0', NULL, 'Work', 'INBOX',
      'mail-owner-a@example.test',
      'message://%3Cmail-owner-a%40example.test%3E',
      'Archive', 'Project update', NULL
    )
  $$,
  '23505', NULL,
  'rejects reuse of an idempotency key for different task content'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_create_mail_capture(
      '71000000-0000-4000-8000-000000000014',
      '71000000-0000-4000-8000-000000000015',
      'Same message', '', '2026-07-20', 'a2', NULL,
      'Work', 'Other mailbox', 'mail-owner-a@example.test',
      'message://%3Cmail-owner-a%40example.test%3E',
      'Trash', 'Project update', NULL
    )
  $$,
  '23505', NULL,
  'rejects conflicting metadata for an existing source identity'
);

SELECT throws_ok(
  $$
    SELECT public.tasks_create_mail_capture(
      '71000000-0000-4000-8000-000000000016',
      '71000000-0000-4000-8000-000000000017',
      'Invalid source', '', '2026-07-20', 'a3', NULL,
      'Work', 'INBOX', 'invalid@example.test',
      'https://example.test/not-mail', 'Archive', NULL, NULL
    )
  $$,
  '22023', NULL,
  'rejects incomplete or invalid Mail source identity before mutation'
);

SELECT throws_ok(
  format(
    $$
      SELECT public.tasks_create_mail_capture(
        '71000000-0000-4000-8000-000000000018',
        '71000000-0000-4000-8000-000000000019',
        'Atomic failure', '', '2026-07-20', 'a4', NULL,
        'Work', 'INBOX', 'atomic-failure@example.test',
        'message://%%3Catomic-failure%%40example.test%%3E', %L, NULL, NULL
      )
    $$,
    repeat('x', 1001)
  ),
  '23514', NULL,
  'rolls back the task when its paired Mail source fails validation'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_todos
   WHERE id = '71000000-0000-4000-8000-000000000019'),
  0::bigint,
  'leaves no partial task after source insertion failure'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  public.tasks_create_mail_capture(
    '72000000-0000-4000-8000-000000000010',
    '72000000-0000-4000-8000-000000000011',
    'Owner B same external message', '', '2026-07-20', 'a0', NULL,
    'Work', 'INBOX', 'mail-owner-a@example.test',
    'message://%3Cmail-owner-a%40example.test%3E',
    'Archive', NULL, NULL
  ) ->> 'idempotency_outcome',
  'created',
  'scopes source identity deduplication to the authenticated owner'
);

SELECT * FROM finish();
ROLLBACK;
