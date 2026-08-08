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

INSERT INTO public.bathos_module_access_grants (
  module_id, user_id, grant_source, granted_by
)
SELECT 'tasks', id, 'manual', NULL
FROM auth.users
WHERE email LIKE '%@example.test'
ON CONFLICT DO NOTHING;
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
  has_table_privilege('authenticated', 'public.tasks_todos', 'DELETE'),
  false,
  'continues to withhold direct task deletion'
);
SELECT hasnt_table(
  'public', 'tasks_projects',
  'keeps permanent deletion project-free'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, start_date, order_key,
  hierarchy_order_key, source_kind, source_url, source_external_id,
  disposition, deleted_at, deletion_root_id, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000030',
  'a1000000-0000-4000-8000-000000000001',
  'Deleted task', 'anytime', DATE '2099-01-01', 'a0', 'a0',
  'mail_message', 'message://permanent-delete', '<permanent-delete@example.test>',
  'deleted', '2026-07-20T19:30:00Z',
  'a1000000-0000-4000-8000-000000000030',
  'a1000000-0000-4000-8000-000000000031'
);
INSERT INTO public.tasks_checklist_items (
  id, owner_id, task_id, title, order_key, disposition, deleted_at,
  deletion_root_id, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000040',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000030',
  'Deleted checklist item', 'a0', 'deleted', '2026-07-20T19:30:00Z',
  'a1000000-0000-4000-8000-000000000030',
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
  'test.permanent_preview',
  public.tasks_preview_permanent_deletion(
    'todo', 'a1000000-0000-4000-8000-000000000030'
  )::text,
  false
);
SELECT is(
  current_setting('test.permanent_preview')::jsonb #>> '{root,title}',
  'Deleted task',
  'reports the selected root before irreversible deletion'
);
SELECT is(
  current_setting('test.permanent_preview')::jsonb #>> '{root,type}',
  'todo',
  'reports a task root'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.permanent_preview')::jsonb #> '{hierarchy,todos}'
  ),
  1,
  'reports the deleted task identifier'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.permanent_preview')::jsonb
      #> '{hierarchy,checklist_items}'
  ),
  1,
  'reports every deleted checklist descendant'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.permanent_preview')::jsonb #> '{related,mail_sources}'
  ),
  1,
  'reports related Mail identity that will be erased'
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
      'todo', 'a1000000-0000-4000-8000-000000000030'
    )
  $$,
  '22023', 'The Done task root is unavailable',
  'does not reveal another owner''s Done task root'
);
SELECT set_config(
  'request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true
);

SELECT throws_ok(
  format(
    $$SELECT public.tasks_permanently_delete(
      'todo', 'a1000000-0000-4000-8000-000000000030', %L,
      'a1000000-0000-4000-8000-000000000070', 'DELETE'
    )$$,
    current_setting('test.permanent_preview')::jsonb ->> 'scope_digest'
  ),
  '22023', 'Permanent deletion requires explicit confirmation',
  'rejects execution without the exact confirmation phrase'
);
SELECT throws_ok(
  format(
    $$SELECT public.tasks_permanently_delete(
      'project', 'a1000000-0000-4000-8000-000000000030', %L,
      'a1000000-0000-4000-8000-000000000071', 'PERMANENTLY DELETE'
    )$$,
    current_setting('test.permanent_preview')::jsonb ->> 'scope_digest'
  ),
  '22023', 'Permanent deletion requires explicit task confirmation',
  'rejects retired Project roots'
);

SELECT set_config(
  'test.permanent_result',
  public.tasks_permanently_delete(
    'todo', 'a1000000-0000-4000-8000-000000000030',
    current_setting('test.permanent_preview')::jsonb ->> 'scope_digest',
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
  (SELECT count(*) FROM public.tasks_todos
   WHERE id = 'a1000000-0000-4000-8000-000000000030')
  + (SELECT count(*) FROM public.tasks_checklist_items
     WHERE id = 'a1000000-0000-4000-8000-000000000040'),
  0::bigint,
  'erases every row in the selected task hierarchy'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_history_events
   WHERE task_id = 'a1000000-0000-4000-8000-000000000030')
  + (SELECT count(*) FROM public.tasks_hierarchy_history_events
     WHERE entity_id = 'a1000000-0000-4000-8000-000000000040')
  + (SELECT count(*) FROM public.tasks_mail_sources
     WHERE task_id = 'a1000000-0000-4000-8000-000000000030'),
  0::bigint,
  'erases related lifecycle and Mail data'
);
SELECT is(
  public.tasks_permanently_delete(
    'todo', 'a1000000-0000-4000-8000-000000000030',
    current_setting('test.permanent_preview')::jsonb ->> 'scope_digest',
    'a1000000-0000-4000-8000-000000000070', 'PERMANENTLY DELETE'
  ),
  current_setting('test.permanent_result')::jsonb,
  'returns the original receipt for an exact ambiguous-response retry'
);
SELECT throws_ok(
  format(
    $$SELECT public.tasks_permanently_delete(
      'todo', 'a1000000-0000-4000-8000-000000000030', %L,
      'a1000000-0000-4000-8000-000000000070', 'PERMANENTLY DELETE'
    )$$,
    repeat('0', 64)
  ),
  '22023',
  'Permanent-deletion request identifier was reused with changed input',
  'rejects changed input under an accepted request identifier'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, lifecycle, completed_at,
  client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000100',
  'a1000000-0000-4000-8000-000000000001',
  'Completed task', 'anytime', 'a0', 'completed',
  '2026-07-20T20:00:00Z',
  'a1000000-0000-4000-8000-000000000101'
);
INSERT INTO public.tasks_checklist_items (
  id, owner_id, task_id, title, order_key, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000110',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000100',
  'Completed task checklist item', 'a0',
  'a1000000-0000-4000-8000-000000000111'
);
INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, lifecycle, canceled_at,
  client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000120',
  'a1000000-0000-4000-8000-000000000001',
  'Canceled task', 'anytime', 'a0', 'canceled',
  '2026-07-20T20:01:00Z',
  'a1000000-0000-4000-8000-000000000121'
);
INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000130',
  'a1000000-0000-4000-8000-000000000001',
  'Active task', 'anytime', 'a0',
  'a1000000-0000-4000-8000-000000000131'
);

SELECT set_config(
  'test.completed_preview',
  public.tasks_preview_permanent_deletion(
    'todo', 'a1000000-0000-4000-8000-000000000100'
  )::text,
  false
);
SELECT is(
  current_setting('test.completed_preview')::jsonb #>> '{root,title}',
  'Completed task',
  'previews a completed task that is already in Done'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.completed_preview')::jsonb #> '{hierarchy,todos}'
  ),
  1,
  'limits a completed task scope to its own task root'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.completed_preview')::jsonb
      #> '{hierarchy,checklist_items}'
  ),
  1,
  'includes a completed task checklist in the preview'
);
SELECT is(
  public.tasks_permanently_delete(
    'todo', 'a1000000-0000-4000-8000-000000000100',
    current_setting('test.completed_preview')::jsonb ->> 'scope_digest',
    'a1000000-0000-4000-8000-000000000140', 'PERMANENTLY DELETE'
  ) ->> 'outcome',
  'accepted',
  'permanently deletes a completed task after confirmation'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_todos
   WHERE id = 'a1000000-0000-4000-8000-000000000100')
  + (SELECT count(*) FROM public.tasks_checklist_items
     WHERE id = 'a1000000-0000-4000-8000-000000000110'),
  0::bigint,
  'erases the completed task and its checklist'
);
SELECT is(
  public.tasks_preview_permanent_deletion(
    'todo', 'a1000000-0000-4000-8000-000000000120'
  ) #>> '{root,title}',
  'Canceled task',
  'previews a legacy canceled task that is already in Done'
);
SELECT throws_ok(
  $$
    SELECT public.tasks_preview_permanent_deletion(
      'todo', 'a1000000-0000-4000-8000-000000000130'
    )
  $$,
  '22023', 'The Done task root is unavailable',
  'rejects permanent deletion for an active task'
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
  public.tasks_permanently_delete(
    'todo', 'a1000000-0000-4000-8000-000000000080',
    current_setting('test.permanent_todo_preview')::jsonb ->> 'scope_digest',
    'a1000000-0000-4000-8000-000000000090', 'PERMANENTLY DELETE'
  ) ->> 'outcome',
  'accepted',
  'permanently deletes another standalone task root'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_todos
   WHERE id = 'a1000000-0000-4000-8000-000000000080'),
  0::bigint,
  'erases the standalone task'
);
RESET ROLE;
SELECT is(
  (SELECT count(*) FROM tasks_private.permanent_deletion_receipts
   WHERE owner_id = 'a1000000-0000-4000-8000-000000000001'),
  3::bigint,
  'retains content-free receipts for every accepted request'
);

SELECT * FROM finish();
ROLLBACK;
