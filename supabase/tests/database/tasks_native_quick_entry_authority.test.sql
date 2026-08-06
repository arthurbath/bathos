BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(26);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'ae000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'quick-entry-owner@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    'ae000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'quick-entry-foreign@example.test', '', now(),
    '{}', '{}', now(), now()
  );

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'ae000000-0000-4000-8000-000000000003',
  'ae000000-0000-4000-8000-000000000001',
  'UTC',
  'ae000000-0000-4000-8000-000000000004'
);

INSERT INTO public.tasks_areas (
  id, owner_id, title, order_key, client_mutation_id
) VALUES
  (
    'ae000000-0000-4000-8000-000000000010',
    'ae000000-0000-4000-8000-000000000001',
    'Home', 'a0', 'ae000000-0000-4000-8000-000000000011'
  ),
  (
    'ae000000-0000-4000-8000-000000000012',
    'ae000000-0000-4000-8000-000000000002',
    'Foreign', 'a0', 'ae000000-0000-4000-8000-000000000013'
  );

SELECT has_table(
  'tasks_private', 'native_quick_entry_credentials',
  'stores native Quick Entry credentials outside synchronized public data'
);
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_catalog.pg_class
    WHERE oid = 'tasks_private.native_quick_entry_credentials'::regclass
  ),
  'enables RLS on native Quick Entry credentials'
);
SELECT is(
  has_table_privilege(
    'authenticated',
    'tasks_private.native_quick_entry_credentials',
    'SELECT'
  ),
  false,
  'withholds the credential table from authenticated SQL'
);
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_create_from_native_quick_entry(text,jsonb)',
    'EXECUTE'
  ),
  false,
  'withholds native creation authority from authenticated SQL'
);
SELECT is(
  has_function_privilege(
    'service_role',
    'public.tasks_create_from_native_quick_entry(text,jsonb)',
    'EXECUTE'
  ),
  true,
  'grants native creation authority only to the service boundary'
);

SELECT is(
  public.tasks_issue_native_quick_entry_credential(
    'ae000000-0000-4000-8000-000000000001',
    'ae000000-0000-4000-8000-000000000020',
    'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    clock_timestamp() + interval '30 days'
  ) #>> '{outcome}',
  'issued',
  'issues an owner-and-installation-bound native credential'
);
SELECT is(
  (
    SELECT count(*)
    FROM tasks_private.native_quick_entry_credentials
    WHERE token_hash = extensions.digest(
      convert_to(
        'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        'UTF8'
      ),
      'sha256'
    )
  ),
  1::bigint,
  'stores only the native credential digest'
);
SELECT is(
  public.tasks_read_native_quick_entry_bootstrap('invalid') #>> '{code}',
  'invalid_credential',
  'rejects malformed bootstrap credentials'
);
SELECT is(
  public.tasks_read_native_quick_entry_bootstrap(
    'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  ) #>> '{ownerId}',
  'ae000000-0000-4000-8000-000000000001',
  'returns bootstrap data for the credential owner'
);
SELECT is(
  jsonb_array_length(
    public.tasks_read_native_quick_entry_bootstrap(
      'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    ) -> 'areas'
  ),
  1,
  'returns only owned present Areas in the bootstrap'
);
SELECT is(
  public.tasks_read_native_quick_entry_bootstrap(
    'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  ) #>> '{contractFingerprint}',
  '5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1',
  'returns the exact generated contract fingerprint'
);

SELECT is(
  public.tasks_create_from_native_quick_entry(
    'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    jsonb_build_object(
      'payloadSchemaVersion', 1,
      'contractFingerprint',
        '5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1',
      'clientMutationID', 'ae000000-0000-4000-8000-000000000030',
      'operationID', 'ae000000-0000-4000-8000-000000000031',
      'summary', '  Native capture  ',
      'notes', 'Native notes',
      'link', 'https://example.test/native',
      'destination', 'anytime',
      'todaySection', 'inbox',
      'startDate', NULL,
      'deadlineDate', ((clock_timestamp() AT TIME ZONE 'UTC')::date - 2)::text,
      'areaID', 'ae000000-0000-4000-8000-000000000010',
      'actionability', 'waiting',
      'reminderLocalTime', '09:30:00',
      'checklist', jsonb_build_array(
        jsonb_build_object(
          'clientID', 'ae000000-0000-4000-8000-000000000040',
          'title', 'First item',
          'position', 0
        ),
        jsonb_build_object(
          'clientID', 'ae000000-0000-4000-8000-000000000041',
          'title', 'Second item',
          'position', 1
        )
      )
    )
  ) #>> '{outcome}',
  'accepted',
  'atomically creates a full native Quick Entry task'
);
SELECT is(
  (
    SELECT title || ':' || notes || ':' || destination || ':'
      || today_section || ':' || actionability || ':' || entry_channel
    FROM public.tasks_todos
    WHERE client_mutation_id = 'ae000000-0000-4000-8000-000000000030'
  ),
  'Native capture:Native notes:anytime:inbox:waiting:native',
  'stores normalized task metadata with native attribution'
);
SELECT is(
  (
    SELECT deadline
    FROM public.tasks_todos
    WHERE client_mutation_id = 'ae000000-0000-4000-8000-000000000030'
  ),
  (clock_timestamp() AT TIME ZONE 'UTC')::date - 2,
  'allows a past deadline as required by the Tasks contract'
);
SELECT is(
  (
    SELECT string_agg(title, ',' ORDER BY order_key COLLATE "C")
    FROM public.tasks_checklist_items
    WHERE task_id = (
      SELECT id
      FROM public.tasks_todos
      WHERE client_mutation_id = 'ae000000-0000-4000-8000-000000000030'
    )
  ),
  'First item,Second item',
  'preserves checklist order with canonical order keys'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_reminders
    WHERE task_id = (
      SELECT id
      FROM public.tasks_todos
      WHERE client_mutation_id = 'ae000000-0000-4000-8000-000000000030'
    )
      AND local_time = '09:30:00'::time
      AND status = 'active'
  ),
  1::bigint,
  'creates the reminder and its authoritative local time'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_history_events
    WHERE client_mutation_id = 'ae000000-0000-4000-8000-000000000030'
      AND transition = 'create'
  ),
  1::bigint,
  'records task creation in undo history'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_hierarchy_history_events
    WHERE action_id = 'ae000000-0000-4000-8000-000000000031'
      AND transition = 'create'
  ),
  2::bigint,
  'records the checklist creation under the same undo action'
);
SELECT is(
  public.tasks_create_from_native_quick_entry(
    'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    jsonb_build_object(
      'payloadSchemaVersion', 1,
      'contractFingerprint',
        '5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1',
      'clientMutationID', 'ae000000-0000-4000-8000-000000000030',
      'operationID', 'ae000000-0000-4000-8000-000000000031',
      'summary', 'Native capture',
      'destination', 'anytime',
      'todaySection', 'inbox',
      'actionability', 'waiting',
      'checklist', '[]'::jsonb
    )
  ) #>> '{outcome}',
  'already_applied',
  'makes an exact native retry idempotent'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_todos
    WHERE client_mutation_id = 'ae000000-0000-4000-8000-000000000030'
  ),
  1::bigint,
  'does not duplicate the retried task'
);

SELECT is(
  public.tasks_create_from_native_quick_entry(
    'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    jsonb_build_object(
      'payloadSchemaVersion', 1,
      'contractFingerprint',
        '5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1',
      'clientMutationID', 'AE000000-0000-4000-8000-000000000060',
      'operationID', 'AE000000-0000-4000-8000-000000000061',
      'summary', 'Uppercase Swift UUID capture',
      'destination', 'anytime',
      'todaySection', 'inbox',
      'actionability', 'actionable',
      'checklist', jsonb_build_array(
        jsonb_build_object(
          'clientID', 'AE000000-0000-4000-8000-000000000062',
          'title', 'Swift checklist item',
          'position', 0
        )
      )
    )
  ) #>> '{outcome}',
  'accepted',
  'accepts the uppercase hexadecimal UUID representation emitted by Swift'
);

SELECT is(
  public.tasks_create_from_native_quick_entry(
    'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    jsonb_build_object(
      'payloadSchemaVersion', 1,
      'contractFingerprint',
        '5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1',
      'clientMutationID', 'ae000000-0000-4000-8000-000000000050',
      'operationID', 'ae000000-0000-4000-8000-000000000051',
      'summary', 'Foreign Area',
      'destination', 'anytime',
      'todaySection', 'inbox',
      'areaID', 'ae000000-0000-4000-8000-000000000012',
      'actionability', 'actionable',
      'checklist', '[]'::jsonb
    )
  ) #>> '{code}',
  'invalid_area',
  'rejects another owner Area'
);
SELECT is(
  public.tasks_create_from_native_quick_entry(
    'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    jsonb_build_object(
      'payloadSchemaVersion', 1,
      'contractFingerprint',
        '5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1',
      'clientMutationID', 'ae000000-0000-4000-8000-000000000052',
      'operationID', 'ae000000-0000-4000-8000-000000000053',
      'summary', 'Invalid checklist',
      'destination', 'anytime',
      'todaySection', 'inbox',
      'actionability', 'actionable',
      'checklist', jsonb_build_array(
        jsonb_build_object(
          'clientID', 'ae000000-0000-4000-8000-000000000054',
          'title', 'Skipped position',
          'position', 2
        )
      )
    )
  ) #>> '{code}',
  'invalid_checklist',
  'rejects non-sequential checklist positions before any insert'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_todos
    WHERE client_mutation_id IN (
      'ae000000-0000-4000-8000-000000000050',
      'ae000000-0000-4000-8000-000000000052'
    )
  ),
  0::bigint,
  'keeps rejected native requests atomic'
);
SELECT is(
  public.tasks_revoke_native_quick_entry_credential(
    'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  ) #>> '{outcome}',
  'revoked',
  'revokes the native credential'
);
SELECT is(
  public.tasks_read_native_quick_entry_bootstrap(
    'tqe_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  ) #>> '{code}',
  'invalid_credential',
  'rejects a revoked credential'
);

SELECT * FROM finish();
ROLLBACK;
