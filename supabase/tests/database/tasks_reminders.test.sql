BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(50);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '97000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'reminders-a@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '97000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'reminders-b@example.test', '', now(),
    '{}', '{}', now(), now()
  );

SELECT has_table('public', 'tasks_reminders', 'stores canonical reminder intent');
SELECT has_table(
  'public', 'tasks_reminder_occurrences',
  'stores stable logical reminder occurrences'
);
SELECT has_table(
  'public', 'tasks_delivery_targets',
  'stores explicitly registered delivery targets'
);
SELECT has_table(
  'public', 'tasks_reminder_deliveries',
  'stores idempotent per-target delivery state'
);
SELECT has_table(
  'public', 'tasks_reminder_claims',
  'stores exact in-app claim receipts'
);
SELECT has_function(
  'public', 'tasks_save_reminder',
  ARRAY[
    'uuid', 'bigint', 'text', 'uuid', 'date', 'text', 'text', 'text',
    'uuid', 'text', 'text'
  ],
  'saves reminder intent through one guarded function'
);
SELECT has_function(
  'public', 'tasks_cancel_reminder',
  ARRAY['uuid', 'bigint', 'uuid', 'text', 'text'],
  'cancels reminders explicitly'
);
SELECT has_function(
  'public', 'tasks_claim_due_reminders', ARRAY['timestamp with time zone', 'uuid'],
  'claims due in-app reminders idempotently'
);
SELECT has_function(
  'public', 'tasks_acknowledge_reminder_delivery', ARRAY['uuid'],
  'acknowledges an in-app delivery separately from its attempt'
);

SELECT is(
  (
    SELECT resolved_at FROM tasks_private.resolve_reminder_instant(
      '2026-01-15', '09:00', 'America/Los_Angeles', 'earlier'
    )
  ),
  '2026-01-15 17:00:00+00'::timestamptz,
  'resolves an ordinary local reminder into one UTC instant'
);
SELECT is(
  (
    SELECT resolution_kind FROM tasks_private.resolve_reminder_instant(
      '2026-03-08', '02:30', 'America/Los_Angeles', 'earlier'
    )
  ),
  'gap_forward',
  'records daylight-saving gap adjustment explicitly'
);
SELECT is(
  (
    SELECT resolved_at FROM tasks_private.resolve_reminder_instant(
      '2026-03-08', '02:30', 'America/Los_Angeles', 'earlier'
    )
  ),
  '2026-03-08 10:00:00+00'::timestamptz,
  'moves a nonexistent local time to the first valid instant after the gap'
);
SELECT is(
  (
    SELECT resolved_at FROM tasks_private.resolve_reminder_instant(
      '2026-11-01', '01:30', 'America/Los_Angeles', 'earlier'
    )
  ),
  '2026-11-01 08:30:00+00'::timestamptz,
  'chooses the earlier instant for an ambiguous local time by default'
);
SELECT is(
  (
    SELECT resolved_at FROM tasks_private.resolve_reminder_instant(
      '2026-11-01', '01:30', 'America/Los_Angeles', 'later'
    )
  ),
  '2026-11-01 09:30:00+00'::timestamptz,
  'honors an explicit later choice for an ambiguous local time'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  '97000000-0000-4000-8000-000000000010',
  '97000000-0000-4000-8000-000000000001',
  'America/Los_Angeles',
  '97000000-0000-4000-8000-000000000011'
);
INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id,
  source_kind, source_url, source_external_id
) VALUES
  (
    '97000000-0000-4000-8000-000000000020',
    '97000000-0000-4000-8000-000000000001',
    'Scheduled task', 'today', 'a0',
    '97000000-0000-4000-8000-000000000021',
    'mail_message', 'message://reminder-export', '<reminder@example.test>'
  ),
  (
    '97000000-0000-4000-8000-000000000022',
    '97000000-0000-4000-8000-000000000001',
    'Second scheduled task', 'today', 'a1',
    '97000000-0000-4000-8000-000000000023',
    NULL, NULL, NULL
  ),
  (
    '97000000-0000-4000-8000-000000000024',
    '97000000-0000-4000-8000-000000000001',
    'Completing task', 'today', 'a2',
    '97000000-0000-4000-8000-000000000025',
    NULL, NULL, NULL
  );

INSERT INTO public.tasks_mail_sources (
  task_id, owner_id, account_identifier, mailbox_identifier,
  message_identifier, deep_link, retirement_destination_identifier,
  client_mutation_id
) VALUES (
  '97000000-0000-4000-8000-000000000020',
  '97000000-0000-4000-8000-000000000001',
  'synthetic-account', 'synthetic-inbox', '<reminder@example.test>',
  'message://reminder-export', 'synthetic-archive',
  '97000000-0000-4000-8000-000000000022'
);

SELECT lives_ok(
  $$
    SELECT set_config(
      'test.reminder_save',
      public.tasks_save_reminder(
        NULL, NULL, 'todo', '97000000-0000-4000-8000-000000000020',
        '2026-01-15', '09:00', 'America/Los_Angeles', 'earlier',
        '97000000-0000-4000-8000-000000000030'
      )::text,
      false
    )
  $$,
  'creates a canonical task reminder and occurrence atomically'
);
SELECT is(
  current_setting('test.reminder_save')::jsonb #>> '{reminder,resolved_at}',
  '2026-01-15T17:00:00+00:00',
  'stores the resolved instant alongside its local intent'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_reminder_occurrences),
  1::bigint,
  'creates one logical occurrence for the reminder revision'
);
SELECT is(
  (
    public.tasks_save_reminder(
      (current_setting('test.reminder_save')::jsonb #>> '{reminder,id}')::uuid,
      1, 'todo', '97000000-0000-4000-8000-000000000020',
      '2026-01-15', '09:00', 'America/Los_Angeles', 'earlier',
      '97000000-0000-4000-8000-000000000030'
    ) ->> 'outcome'
  ),
  'already_applied',
  'returns the stored result for an exact save retry'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_reminder_occurrences),
  1::bigint,
  'does not duplicate the occurrence on an exact save retry'
);
SELECT is(
  (
    public.tasks_save_reminder(
      (current_setting('test.reminder_save')::jsonb #>> '{reminder,id}')::uuid,
      99, 'todo', '97000000-0000-4000-8000-000000000020',
      '2026-01-16', '09:00', 'America/Los_Angeles', 'earlier',
      '97000000-0000-4000-8000-000000000031'
    ) ->> 'outcome'
  ),
  'conflict',
  'rejects a stale reminder revision without overwriting newer intent'
);
SELECT is(
  (
    public.tasks_save_reminder(
      (current_setting('test.reminder_save')::jsonb #>> '{reminder,id}')::uuid,
      1, 'todo', '97000000-0000-4000-8000-000000000020',
      '2026-01-16', '09:00', 'America/Los_Angeles', 'earlier',
      '97000000-0000-4000-8000-000000000032'
    ) ->> 'outcome'
  ),
  'accepted',
  'revises future reminder intent under optimistic concurrency'
);
SELECT is(
  (
    SELECT record_revision FROM public.tasks_reminders
    WHERE task_id = '97000000-0000-4000-8000-000000000020'
  ),
  2::bigint,
  'advances the reminder record revision'
);
SELECT is(
  (
    SELECT count(*) FROM public.tasks_reminder_occurrences
    WHERE reminder_id = (
      current_setting('test.reminder_save')::jsonb #>> '{reminder,id}'
    )::uuid AND status = 'canceled'
  ),
  1::bigint,
  'cancels the superseded logical occurrence'
);
SELECT is(
  (
    SELECT count(*) FROM public.tasks_reminder_occurrences
    WHERE reminder_id = (
      current_setting('test.reminder_save')::jsonb #>> '{reminder,id}'
    )::uuid AND status = 'scheduled'
  ),
  1::bigint,
  'keeps exactly one scheduled occurrence after revision'
);

SELECT lives_ok(
  $$
    SELECT set_config(
      'test.due_reminder',
      public.tasks_save_reminder(
        NULL, NULL, 'todo', '97000000-0000-4000-8000-000000000022',
        '2020-01-01', '09:00', 'UTC', 'earlier',
        '97000000-0000-4000-8000-000000000033'
      )::text,
      false
    )
  $$,
  'creates a second reminder that is already due'
);
SELECT set_config(
  'test.reminder_claim',
  public.tasks_claim_due_reminders(
    '2025-01-01 00:00:00+00', '97000000-0000-4000-8000-000000000034'
  )::text,
  false
);
SELECT is(
  jsonb_array_length(current_setting('test.reminder_claim')::jsonb -> 'items'),
  1,
  'claims one due logical reminder for the account in-app target'
);
SELECT is(
  (SELECT status FROM public.tasks_reminder_deliveries),
  'attempted',
  'records an attempt separately from user acknowledgement'
);
SELECT is(
  public.tasks_claim_due_reminders(
    '2025-01-01 00:00:00+00', '97000000-0000-4000-8000-000000000034'
  ),
  current_setting('test.reminder_claim')::jsonb,
  'returns the immutable claim receipt for an exact retry'
);
SELECT is(
  (SELECT attempt_count FROM public.tasks_reminder_deliveries),
  1,
  'does not increment attempts for an exact claim retry'
);
SELECT is(
  (
    public.tasks_acknowledge_reminder_delivery(
      (current_setting('test.reminder_claim')::jsonb #>> '{items,0,delivery_id}')::uuid
    ) ->> 'outcome'
  ),
  'accepted',
  'acknowledges a displayed in-app reminder explicitly'
);
SELECT is(
  (
    public.tasks_acknowledge_reminder_delivery(
      (current_setting('test.reminder_claim')::jsonb #>> '{items,0,delivery_id}')::uuid
    ) ->> 'outcome'
  ),
  'already_applied',
  'makes acknowledgement idempotent'
);
SELECT is(
  jsonb_array_length(
    public.tasks_claim_due_reminders(
      '2025-01-01 00:00:00+00', '97000000-0000-4000-8000-000000000035'
    ) -> 'items'
  ),
  0,
  'does not show an acknowledged logical reminder again'
);
SELECT is(
  (
    public.tasks_cancel_reminder(
      (current_setting('test.reminder_save')::jsonb #>> '{reminder,id}')::uuid,
      2, '97000000-0000-4000-8000-000000000036'
    ) ->> 'outcome'
  ),
  'accepted',
  'cancels a reminder under optimistic concurrency'
);
SELECT is(
  (
    SELECT status FROM public.tasks_reminders
    WHERE id = (current_setting('test.reminder_save')::jsonb #>> '{reminder,id}')::uuid
  ),
  'canceled',
  'persists explicit cancellation separately from deletion'
);

SELECT set_config(
  'test.lifecycle_reminder',
  public.tasks_save_reminder(
    NULL, NULL, 'todo', '97000000-0000-4000-8000-000000000024',
    '2030-01-01', '09:00', 'UTC', 'earlier',
    '97000000-0000-4000-8000-000000000037'
  )::text,
  false
);
UPDATE public.tasks_todos
SET lifecycle = 'completed', completed_at = clock_timestamp(),
    revision = revision + 1,
    client_mutation_id = '97000000-0000-4000-8000-000000000038'
WHERE id = '97000000-0000-4000-8000-000000000024';
SELECT is(
  (
    SELECT status FROM public.tasks_reminders
    WHERE id = (
      current_setting('test.lifecycle_reminder')::jsonb #>> '{reminder,id}'
    )::uuid
  ),
  'canceled',
  'automatically cancels a reminder when its root becomes terminal'
);

SELECT set_config(
  'test.reminder_export', public.tasks_create_export_v10()::text, false
);
SELECT is(
  (current_setting('test.reminder_export')::jsonb ->> 'schema_version')::integer,
  10,
  'uses portable task export schema version ten'
);
SELECT ok(
  jsonb_array_length(
    current_setting('test.reminder_export')::jsonb #> '{data,tasks_reminders}'
  ) > 0,
  'exports canonical reminder intent and schedule history'
);
SELECT ok(
  NOT (current_setting('test.reminder_export')::jsonb -> 'data' ? 'tasks_delivery_targets')
    AND NOT (
      current_setting('test.reminder_export')::jsonb -> 'data'
        ? 'tasks_reminder_deliveries'
    ),
  'excludes delivery endpoints, tokens, and diagnostics from portable export'
);
SELECT throws_ok(
  $$
    SELECT public.tasks_restore_export_v10(
      jsonb_set(
        current_setting('test.reminder_export')::jsonb,
        '{manifest,checksums,tasks_reminders}',
        to_jsonb(repeat('0', 64))
      ), true
    )
  $$,
  '22023',
  'Task export v10 collection tasks_reminders is invalid',
  'rejects reminder data with a mismatched checksum'
);

SELECT set_config(
  'request.jwt.claim.sub', '97000000-0000-4000-8000-000000000002', true
);
SELECT is(
  (SELECT count(*) FROM public.tasks_reminders),
  0::bigint,
  'RLS hides another owner reminders'
);
SELECT throws_ok(
  format(
    $$
      SELECT public.tasks_cancel_reminder(
        %L::uuid, 1, '97000000-0000-4000-8000-000000000039'
      )
    $$,
    current_setting('test.due_reminder')::jsonb #>> '{reminder,id}'
  ),
  '22023',
  'The reminder is unavailable',
  'another owner cannot mutate a reminder through the guarded service'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
DELETE FROM auth.users
WHERE id = '97000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '97000000-0000-4000-8000-000000000002', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT ok(
  (
    public.tasks_restore_export_v10(
      current_setting('test.reminder_export')::jsonb, true
    ) #>> '{tasks_reminders,inserts}'
  )::integer > 0,
  'previews reminder records as owner-rebound inserts'
);
SELECT lives_ok(
  $$
    SELECT set_config(
      'test.reminder_restore',
      public.tasks_restore_export_v10(
        current_setting('test.reminder_export')::jsonb, false
      )::text,
      false
    )
  $$,
  'restores the complete reminder graph for another owner'
);
SELECT is(
  (current_setting('test.reminder_restore')::jsonb ->> 'applied')::boolean,
  true,
  'reports an applied reminder merge restore'
);
SELECT set_config(
  'test.reminder_replay',
  public.tasks_restore_export_v10(
    current_setting('test.reminder_export')::jsonb, false
  )::text,
  false
);
SELECT is(
  current_setting('test.reminder_replay')::jsonb ->> 'code',
  'already_applied',
  'classifies an exact current-schema replay without legacy conflicts'
);
SELECT is(
  (
    current_setting('test.reminder_replay')::jsonb
      #>> '{tasks_mail_sources,matches}'
  )::integer,
  1,
  'reports the task-keyed Mail source as an exact replay match'
);
SELECT throws_ok(
  format(
    'SELECT public.tasks_restore_export_v10(%L::jsonb, true)',
    jsonb_set(
      current_setting('test.reminder_export')::jsonb,
      '{data,tasks_mail_sources,0,account_identifier}',
      '"tampered-account"'::jsonb
    )::text
  ),
  'Task export checksum mismatch for tasks_mail_sources',
  'rejects Mail source tampering before adding its temporary validator identity'
);
SELECT ok(
  (SELECT count(*) FROM public.tasks_reminder_occurrences) > 0,
  'rebinds restored reminder occurrences to the authenticated owner'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_delivery_targets),
  0::bigint,
  'does not restore excluded delivery targets'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_mail_sources),
  1::bigint,
  'restores task-keyed Mail sources through the current export validator'
);

SELECT * FROM finish();
ROLLBACK;
