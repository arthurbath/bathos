BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(30);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'permanent-delete-a@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'permanent-delete-b@example.test', '', now(),
    '{}', '{}', now(), now()
  );

SELECT has_function(
  'public', 'tasks_preview_permanent_deletion', ARRAY['text', 'uuid'],
  'previews one owner-scoped permanent-deletion scope'
);
SELECT has_function(
  'public', 'tasks_permanently_delete',
  ARRAY['text', 'uuid', 'text', 'uuid', 'text'],
  'executes one confirmed permanent-deletion scope'
);
SELECT is(
  has_function_privilege(
    'anon', 'public.tasks_preview_permanent_deletion(text,uuid)', 'EXECUTE'
  ),
  false,
  'withholds permanent-deletion preview from anonymous callers'
);
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.tasks_permanently_delete(text,uuid,text,uuid,text)',
    'EXECUTE'
  ),
  true,
  'grants confirmed permanent deletion to authenticated callers only'
);
SELECT is(
  has_table_privilege(
    'authenticated', 'public.tasks_todos', 'DELETE'
  ),
  false,
  'continues to withhold direct task deletion'
);
SELECT is(
  has_table_privilege(
    'authenticated',
    'tasks_private.permanent_deletion_receipts', 'SELECT'
  ),
  false,
  'keeps permanent-deletion receipts behind the guarded function'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_projects (
  id, owner_id, title, order_key, planning_order_key, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000010',
  'a1000000-0000-4000-8000-000000000001',
  'Deleted project', 'a0', 'a0',
  'a1000000-0000-4000-8000-000000000011'
);
INSERT INTO public.tasks_todos (
  id, owner_id, project_id, title, destination, start_date, order_key,
  hierarchy_order_key, source_kind, source_url, source_external_id,
  client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000030',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000010',
  'Deleted task', 'anytime', DATE '2099-01-01', 'a0', 'a0',
  'mail_message', 'message://permanent-delete', '<permanent-delete@example.test>',
  'a1000000-0000-4000-8000-000000000031'
);
INSERT INTO public.tasks_checklist_items (
  id, owner_id, task_id, title, order_key, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000040',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000030',
  'Deleted checklist item', 'a0',
  'a1000000-0000-4000-8000-000000000041'
);
INSERT INTO public.tasks_mail_sources (
  task_id, owner_id, account_identifier, mailbox_identifier,
  message_identifier, deep_link, retirement_destination_identifier,
  client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000030',
  'a1000000-0000-4000-8000-000000000001',
  'synthetic-account', 'synthetic-inbox', '<permanent-delete@example.test>',
  'message://permanent-delete', 'synthetic-archive',
  'a1000000-0000-4000-8000-000000000042'
);

SELECT set_config(
  'test.permanent_reminder',
  public.tasks_save_reminder(
    NULL, NULL, 'todo', 'a1000000-0000-4000-8000-000000000030',
    '2099-01-01', '09:00', 'UTC', 'earlier',
    'a1000000-0000-4000-8000-000000000043'
  )::text,
  false
);
SELECT set_config(
  'test.permanent_claim',
  public.tasks_claim_due_reminders(
    '2100-01-01 00:00:00+00', 'a1000000-0000-4000-8000-000000000044'
  )::text,
  false
);

INSERT INTO public.tasks_hierarchy_operations (
  id, owner_id, root_type, root_id, operation, descendant_policy,
  expected_revisions, requested_at
) VALUES (
  'a1000000-0000-4000-8000-000000000050',
  'a1000000-0000-4000-8000-000000000001',
  'project', 'a1000000-0000-4000-8000-000000000010', 'delete', 'cascade',
  jsonb_build_object(
    'a1000000-0000-4000-8000-000000000010', 1,
    'a1000000-0000-4000-8000-000000000030', 1,
    'a1000000-0000-4000-8000-000000000040', 1
  ),
  '2026-07-20T19:30:00Z'
);

SELECT set_config(
  'test.permanent_preview',
  public.tasks_preview_permanent_deletion(
    'project', 'a1000000-0000-4000-8000-000000000010'
  )::text,
  false
);

SELECT is(
  current_setting('test.permanent_preview')::jsonb #>> '{root,title}',
  'Deleted project',
  'reports the selected root before irreversible deletion'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.permanent_preview')::jsonb #> '{hierarchy,projects}'
  ),
  1,
  'reports the deleted project identifier'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.permanent_preview')::jsonb #> '{hierarchy,todos}'
  ),
  1,
  'reports every deleted to-do descendant'
);
SELECT ok(
  jsonb_array_length(
    current_setting('test.permanent_preview')::jsonb
      #> '{related,task_history_events}'
  ) > 0,
  'reports task history snapshots that will be erased'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.permanent_preview')::jsonb #> '{related,mail_sources}'
  ),
  1,
  'reports related Mail identity that will be erased'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.permanent_preview')::jsonb #> '{related,reminders}'
  ),
  1,
  'reports related reminder intent that will be erased'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.permanent_preview')::jsonb
      #> '{related,reminder_deliveries}'
  ),
  1,
  'reports related reminder delivery state that will be erased'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.permanent_preview')::jsonb
      #> '{preserved_receipts,hierarchy_operations}'
  ),
  1,
  'reports the content-free hierarchy operation that will remain'
);
SELECT is(
  char_length(
    current_setting('test.permanent_preview')::jsonb ->> 'scope_digest'
  ),
  64,
  'binds confirmation to a SHA-256 digest of the exact preview scope'
);

SELECT set_config(
  'request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true
);
SELECT throws_ok(
  $$
    SELECT public.tasks_preview_permanent_deletion(
      'project', 'a1000000-0000-4000-8000-000000000010'
    )
  $$,
  '22023', 'The deleted task root is unavailable',
  'does not reveal another owner''s deleted root'
);
SELECT set_config(
  'request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true
);

RESET ROLE;
INSERT INTO public.tasks_hierarchy_history_events (
  owner_id, entity_type, entity_id, client_mutation_id, actor_type,
  mutation_channel, affected_ids, base_revision, result_revision,
  transition, occurred_at, before_state, after_state
) VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'project', 'a1000000-0000-4000-8000-000000000010',
  'a1000000-0000-4000-8000-000000000060', 'system', 'web',
  ARRAY['a1000000-0000-4000-8000-000000000010'::uuid],
  2, 3, 'update', '2026-07-20T19:31:00Z', '{}'::jsonb, '{}'::jsonb
);
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT throws_ok(
  format(
    $$SELECT public.tasks_permanently_delete(
      'project', 'a1000000-0000-4000-8000-000000000010', %L,
      'a1000000-0000-4000-8000-000000000070', 'PERMANENTLY DELETE'
    )$$,
    current_setting('test.permanent_preview')::jsonb ->> 'scope_digest'
  ),
  '40001', 'Permanent-deletion preview is stale',
  'rejects a changed scope before deleting any record'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_projects
   WHERE id = 'a1000000-0000-4000-8000-000000000010'),
  1::bigint,
  'leaves the complete hierarchy untouched after stale-preview rejection'
);

SELECT set_config(
  'test.permanent_fresh_preview',
  public.tasks_preview_permanent_deletion(
    'project', 'a1000000-0000-4000-8000-000000000010'
  )::text,
  false
);
SELECT throws_ok(
  format(
    $$SELECT public.tasks_permanently_delete(
      'project', 'a1000000-0000-4000-8000-000000000010', %L,
      'a1000000-0000-4000-8000-000000000070', 'DELETE'
    )$$,
    current_setting('test.permanent_fresh_preview')::jsonb ->> 'scope_digest'
  ),
  '22023', 'Permanent deletion requires explicit confirmation',
  'rejects execution without the exact confirmation phrase'
);
SELECT throws_ok(
  format(
    $$SELECT public.tasks_permanently_delete(
      'project', 'a1000000-0000-4000-8000-000000000010', %L,
      'a1000000-0000-4000-8000-000000000070', NULL
    )$$,
    current_setting('test.permanent_fresh_preview')::jsonb ->> 'scope_digest'
  ),
  '22023', 'Permanent deletion requires explicit confirmation',
  'rejects null confirmation before destructive scope evaluation'
);

SELECT set_config(
  'test.permanent_result',
  public.tasks_permanently_delete(
    'project', 'a1000000-0000-4000-8000-000000000010',
    current_setting('test.permanent_fresh_preview')::jsonb ->> 'scope_digest',
    'a1000000-0000-4000-8000-000000000070', 'PERMANENTLY DELETE'
  )::text,
  false
);
SELECT is(
  current_setting('test.permanent_result')::jsonb ->> 'outcome',
  'accepted',
  'returns an accepted content-free permanent-deletion receipt'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_projects
   WHERE id = 'a1000000-0000-4000-8000-000000000010')
  + (SELECT count(*) FROM public.tasks_todos
     WHERE id = 'a1000000-0000-4000-8000-000000000030')
  + (SELECT count(*) FROM public.tasks_checklist_items
     WHERE id = 'a1000000-0000-4000-8000-000000000040'),
  0::bigint,
  'erases every row in the selected hierarchy'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_history_events
   WHERE task_id = 'a1000000-0000-4000-8000-000000000030')
  + (SELECT count(*) FROM public.tasks_hierarchy_history_events
     WHERE entity_id = ANY(ARRAY[
       'a1000000-0000-4000-8000-000000000010'::uuid,
       'a1000000-0000-4000-8000-000000000040'::uuid
     ]))
  + (SELECT count(*) FROM public.tasks_mail_sources
     WHERE task_id = 'a1000000-0000-4000-8000-000000000030')
  + (SELECT count(*) FROM public.tasks_reminders
     WHERE task_id = 'a1000000-0000-4000-8000-000000000030'),
  0::bigint,
  'erases related personal lifecycle, Mail, and reminder data'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_hierarchy_operations
   WHERE id = 'a1000000-0000-4000-8000-000000000050'),
  1::bigint,
  'preserves the content-free hierarchy operation receipt'
);
SELECT is(
  public.tasks_permanently_delete(
    'project', 'a1000000-0000-4000-8000-000000000010',
    current_setting('test.permanent_fresh_preview')::jsonb ->> 'scope_digest',
    'a1000000-0000-4000-8000-000000000070', 'PERMANENTLY DELETE'
  ),
  current_setting('test.permanent_result')::jsonb,
  'returns the original receipt for an exact ambiguous-response retry'
);
SELECT throws_ok(
  format(
    $$SELECT public.tasks_permanently_delete(
      'todo', 'a1000000-0000-4000-8000-000000000010', %L,
      'a1000000-0000-4000-8000-000000000070', 'PERMANENTLY DELETE'
    )$$,
    current_setting('test.permanent_fresh_preview')::jsonb ->> 'scope_digest'
  ),
  '22023',
  'Permanent-deletion request identifier was reused with changed input',
  'rejects changed input under an accepted request identifier'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, disposition, deleted_at,
  deletion_root_id, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000080',
  'a1000000-0000-4000-8000-000000000001',
  'Deleted standalone task', 'anytime', 'a0', 'deleted',
  '2026-07-20T19:40:00Z',
  'a1000000-0000-4000-8000-000000000080',
  'a1000000-0000-4000-8000-000000000081'
);
SELECT set_config(
  'test.permanent_todo_preview',
  public.tasks_preview_permanent_deletion(
    'todo', 'a1000000-0000-4000-8000-000000000080'
  )::text,
  false
);
SELECT is(
  current_setting('test.permanent_todo_preview')::jsonb #>> '{root,type}',
  'todo',
  'previews a deleted standalone to-do root'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.permanent_todo_preview')::jsonb #> '{hierarchy,todos}'
  ),
  1,
  'scopes standalone to-do deletion to that hierarchy root'
);
SELECT is(
  public.tasks_permanently_delete(
    'todo', 'a1000000-0000-4000-8000-000000000080',
    current_setting('test.permanent_todo_preview')::jsonb ->> 'scope_digest',
    'a1000000-0000-4000-8000-000000000090', 'PERMANENTLY DELETE'
  ) ->> 'outcome',
  'accepted',
  'permanently deletes a standalone to-do root'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_todos
   WHERE id = 'a1000000-0000-4000-8000-000000000080')
  + (SELECT count(*) FROM public.tasks_history_events
     WHERE task_id = 'a1000000-0000-4000-8000-000000000080'),
  0::bigint,
  'erases the standalone to-do and its personal history'
);

SELECT * FROM finish();
ROLLBACK;
