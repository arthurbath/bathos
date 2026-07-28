BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(24);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '9b000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'widget-a@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '9b000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'widget-b@example.test', '', now(),
    '{}', '{}', now(), now()
  );

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  '9b000000-0000-4000-8000-000000000003',
  '9b000000-0000-4000-8000-000000000001',
  'UTC',
  '9b000000-0000-4000-8000-000000000004'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES
  (
    '9b000000-0000-4000-8000-000000000010',
    '9b000000-0000-4000-8000-000000000001',
    'Owned widget task', 'anytime', 'a0',
    '9b000000-0000-4000-8000-000000000011'
  ),
  (
    '9b000000-0000-4000-8000-000000000020',
    '9b000000-0000-4000-8000-000000000002',
    'Foreign widget task', 'anytime', 'a0',
    '9b000000-0000-4000-8000-000000000021'
  ),
  (
    '9b000000-0000-4000-8000-000000000030',
    '9b000000-0000-4000-8000-000000000001',
    'Rotated widget task', 'anytime', 'a1',
    '9b000000-0000-4000-8000-000000000031'
  );

SELECT has_table(
  'tasks_private', 'widget_completion_credentials',
  'stores widget credentials outside the synchronized public schema'
);
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_catalog.pg_class
    WHERE oid = 'tasks_private.widget_completion_credentials'::regclass
  ),
  'enables RLS on private widget credentials'
);
SELECT is(
  has_table_privilege(
    'authenticated',
    'tasks_private.widget_completion_credentials',
    'SELECT'
  ),
  false,
  'withholds widget credentials from authenticated table reads'
);
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_complete_from_widget(text,uuid,uuid,uuid)',
    'EXECUTE'
  ),
  false,
  'withholds widget completion authority from ordinary authenticated SQL'
);
SELECT is(
  has_function_privilege(
    'service_role',
    'public.tasks_complete_from_widget(text,uuid,uuid,uuid)',
    'EXECUTE'
  ),
  true,
  'grants widget completion authority only to the service boundary'
);

SELECT is(
  public.tasks_issue_widget_completion_credential(
    '9b000000-0000-4000-8000-000000000001',
    '9b000000-0000-4000-8000-000000000040',
    'twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    clock_timestamp() + interval '90 days'
  ) ->> 'owner_id',
  '9b000000-0000-4000-8000-000000000001',
  'issues one owner-and-installation-bound credential'
);
SELECT is(
  (
    SELECT count(*)
    FROM tasks_private.widget_completion_credentials
    WHERE token_hash = extensions.digest(
      convert_to(
        'twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        'UTF8'
      ),
      'sha256'
    )
  ),
  1::bigint,
  'stores only the credential digest'
);
SELECT is(
  (
    SELECT count(*)
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'tasks_private.widget_completion_credentials'::regclass
      AND attname = 'raw_token'
      AND NOT attisdropped
  ),
  0::bigint,
  'does not retain a raw credential column'
);
SELECT is(
  (
    public.tasks_complete_from_widget(
      'twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      '9b000000-0000-4000-8000-000000000020',
      '9b000000-0000-4000-8000-000000000050',
      '9b000000-0000-4000-8000-000000000051'
    ) #>> '{code}'
  ),
  'task_unavailable',
  'rejects completion of another owner task'
);
SELECT is(
  (
    SELECT lifecycle
    FROM public.tasks_todos
    WHERE id = '9b000000-0000-4000-8000-000000000020'
  ),
  'open',
  'leaves the foreign task unchanged'
);
SELECT is(
  (
    public.tasks_complete_from_widget(
      'twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      '9b000000-0000-4000-8000-000000000010',
      '9b000000-0000-4000-8000-000000000060',
      '9b000000-0000-4000-8000-000000000061'
    ) #>> '{outcome}'
  ),
  'accepted',
  'completes an owned open task'
);
SELECT is(
  (
    SELECT lifecycle
    FROM public.tasks_todos
    WHERE id = '9b000000-0000-4000-8000-000000000010'
  ),
  'completed',
  'stores the authoritative completed lifecycle'
);
SELECT is(
  (
    SELECT transition || ':' || mutation_channel || ':' || actor_type
    FROM public.tasks_history_events
    WHERE client_mutation_id = '9b000000-0000-4000-8000-000000000060'
  ),
  'complete:widget:user',
  'records ordinary attributed lifecycle history'
);
SELECT is(
  (
    SELECT operation_id::text
    FROM public.tasks_history_events
    WHERE client_mutation_id = '9b000000-0000-4000-8000-000000000060'
  ),
  '9b000000-0000-4000-8000-000000000061',
  'preserves the widget operation identifier for atomic undo'
);
SELECT is(
  (
    public.tasks_complete_from_widget(
      'twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      '9b000000-0000-4000-8000-000000000010',
      '9b000000-0000-4000-8000-000000000060',
      '9b000000-0000-4000-8000-000000000061'
    ) #>> '{outcome}'
  ),
  'already_applied',
  'makes an exact completion retry idempotent'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_history_events
    WHERE client_mutation_id = '9b000000-0000-4000-8000-000000000060'
  ),
  1::bigint,
  'does not duplicate history during an exact retry'
);
SELECT is(
  (
    public.tasks_complete_from_widget(
      'twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      '9b000000-0000-4000-8000-000000000010',
      '9b000000-0000-4000-8000-000000000062',
      '9b000000-0000-4000-8000-000000000063'
    ) #>> '{outcome}'
  ),
  'noop',
  'treats a distinct completion of an already completed task as a no-op'
);
SELECT ok(
  (
    SELECT last_used_at IS NOT NULL
    FROM tasks_private.widget_completion_credentials
    WHERE owner_id = '9b000000-0000-4000-8000-000000000001'
      AND installation_id = '9b000000-0000-4000-8000-000000000040'
  ),
  'records credential use without exposing task content'
);

SELECT lives_ok(
  $$
    SELECT public.tasks_issue_widget_completion_credential(
      '9b000000-0000-4000-8000-000000000001',
      '9b000000-0000-4000-8000-000000000040',
      'twc_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      clock_timestamp() + interval '90 days'
    )
  $$,
  'rotates the credential for the same native installation'
);
SELECT is(
  (
    public.tasks_complete_from_widget(
      'twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      '9b000000-0000-4000-8000-000000000030',
      '9b000000-0000-4000-8000-000000000070',
      '9b000000-0000-4000-8000-000000000071'
    ) #>> '{code}'
  ),
  'invalid_credential',
  'rejects the rotated raw credential'
);
SELECT is(
  (
    public.tasks_revoke_widget_completion_credential(
      'twc_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
    ) #>> '{outcome}'
  ),
  'revoked',
  'revokes the current credential'
);
SELECT is(
  (
    public.tasks_complete_from_widget(
      'twc_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      '9b000000-0000-4000-8000-000000000030',
      '9b000000-0000-4000-8000-000000000072',
      '9b000000-0000-4000-8000-000000000073'
    ) #>> '{code}'
  ),
  'invalid_credential',
  'rejects a revoked credential'
);
SELECT is(
  (
    SELECT lifecycle
    FROM public.tasks_todos
    WHERE id = '9b000000-0000-4000-8000-000000000030'
  ),
  'open',
  'leaves the task open after revoked-credential rejection'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'powersync'
      AND schemaname = 'tasks_private'
      AND tablename = 'widget_completion_credentials'
  ),
  0::bigint,
  'does not publish private widget credentials to PowerSync'
);

SELECT * FROM finish();
ROLLBACK;
