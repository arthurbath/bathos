BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(25);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '84000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'hierarchy-export@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '84000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'hierarchy-restore@example.test', '', now(),
    '{}', '{}', now(), now()
  );

SELECT has_function(
  'public', 'tasks_create_export_v4', ARRAY[]::text[],
  'creates a complete hierarchy export'
);
SELECT has_function(
  'public', 'tasks_restore_export_v4', ARRAY['jsonb', 'boolean'],
  'previews and merges a complete hierarchy restore'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_areas (
  id, owner_id, title, order_key, client_mutation_id
) VALUES (
  '84000000-0000-4000-8000-000000000010',
  '84000000-0000-4000-8000-000000000001',
  'Export area', 'a0', '84000000-0000-4000-8000-000000000011'
);
INSERT INTO public.tasks_projects (
  id, owner_id, area_id, title, order_key, planning_order_key, client_mutation_id
) VALUES (
  '84000000-0000-4000-8000-000000000020',
  '84000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000010',
  'Export project', 'a0', 'a0', '84000000-0000-4000-8000-000000000021'
);
INSERT INTO public.tasks_headings (
  id, owner_id, project_id, title, order_key, client_mutation_id
) VALUES (
  '84000000-0000-4000-8000-000000000030',
  '84000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000020',
  'Export heading', 'a0', '84000000-0000-4000-8000-000000000031'
);
INSERT INTO public.tasks_todos (
  id, owner_id, project_id, heading_id, title, destination, order_key,
  hierarchy_order_key, client_mutation_id
) VALUES (
  '84000000-0000-4000-8000-000000000040',
  '84000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000020',
  '84000000-0000-4000-8000-000000000030',
  'Export task', 'anytime', 'a0', 'a0',
  '84000000-0000-4000-8000-000000000041'
);
INSERT INTO public.tasks_checklist_items (
  id, owner_id, task_id, title, order_key, client_mutation_id
) VALUES (
  '84000000-0000-4000-8000-000000000050',
  '84000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000040',
  'Export checklist item', 'a0', '84000000-0000-4000-8000-000000000051'
);
INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  '84000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001',
  'America/Los_Angeles', '84000000-0000-4000-8000-000000000071'
);
INSERT INTO public.tasks_hierarchy_operations (
  id, owner_id, root_type, root_id, operation, descendant_policy,
  expected_revisions, requested_at
) VALUES (
  '84000000-0000-4000-8000-000000000060',
  '84000000-0000-4000-8000-000000000001',
  'project', '84000000-0000-4000-8000-000000000020',
  'complete_project', 'reject',
  jsonb_build_object('84000000-0000-4000-8000-000000000020', 1),
  '2026-07-20T09:00:00Z'
);

SELECT set_config('test.tasks_hierarchy_export', public.tasks_create_export_v4()::text, false);

SELECT is(
  (current_setting('test.tasks_hierarchy_export')::jsonb ->> 'schema_version')::integer,
  4, 'uses portable schema version four'
);
SELECT is(
  current_setting('test.tasks_hierarchy_export')::jsonb #> '{manifest,collections}',
  '["tasks_areas", "tasks_projects", "tasks_headings", "tasks_todos", "tasks_checklist_items", "tasks_history_events", "tasks_hierarchy_operations", "tasks_hierarchy_history_events", "tasks_user_settings"]'::jsonb,
  'declares every collection in dependency order'
);
SELECT is(
  (current_setting('test.tasks_hierarchy_export')::jsonb #>> '{manifest,counts,tasks_areas}')::integer,
  1, 'exports the area'
);
SELECT is(
  (current_setting('test.tasks_hierarchy_export')::jsonb #>> '{manifest,counts,tasks_projects}')::integer,
  1, 'exports the project'
);
SELECT is(
  (current_setting('test.tasks_hierarchy_export')::jsonb #>> '{manifest,counts,tasks_headings}')::integer,
  1, 'exports the heading'
);
SELECT is(
  (current_setting('test.tasks_hierarchy_export')::jsonb #>> '{manifest,counts,tasks_todos}')::integer,
  1, 'exports the todo'
);
SELECT is(
  (current_setting('test.tasks_hierarchy_export')::jsonb #>> '{manifest,counts,tasks_checklist_items}')::integer,
  1, 'exports the checklist item'
);
SELECT is(
  (current_setting('test.tasks_hierarchy_export')::jsonb #>> '{manifest,counts,tasks_hierarchy_operations}')::integer,
  1, 'exports the operation receipt'
);
SELECT is(
  jsonb_path_exists(
    current_setting('test.tasks_hierarchy_export')::jsonb,
    '$.data.*[*].owner_id'
  ),
  false, 'strips the owner from every exported collection'
);

RESET ROLE;
DELETE FROM auth.users WHERE id = '84000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT set_config(
  'test.tasks_hierarchy_preview',
  public.tasks_restore_export_v4(
    current_setting('test.tasks_hierarchy_export')::jsonb,
    true
  )::text,
  false
);
SELECT is(
  (current_setting('test.tasks_hierarchy_preview')::jsonb #>> '{tasks_areas,inserts}')::integer,
  1, 'previews the area insert'
);
SELECT is(
  (current_setting('test.tasks_hierarchy_preview')::jsonb #>> '{tasks_hierarchy_history_events,inserts}')::integer,
  4, 'previews the complete hierarchy history'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_areas),
  0::bigint, 'does not mutate during dry-run'
);

SELECT lives_ok(
  $$
    SELECT public.tasks_restore_export_v4(
      current_setting('test.tasks_hierarchy_export')::jsonb,
      false
    )
  $$,
  'merges the complete hierarchy export'
);
SELECT is(
  (SELECT owner_id FROM public.tasks_projects
   WHERE id = '84000000-0000-4000-8000-000000000020'),
  '84000000-0000-4000-8000-000000000002'::uuid,
  'rebinds project ownership to the restoring user'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_todos),
  1::bigint, 'restores the todo once'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_history_events),
  1::bigint, 'restores todo history without trigger duplication'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_hierarchy_history_events),
  4::bigint, 'restores hierarchy history without trigger duplication'
);
SELECT is(
  (SELECT outcome FROM public.tasks_hierarchy_operations
   WHERE id = '84000000-0000-4000-8000-000000000060'),
  'rejected', 'restores the operation receipt without replaying it'
);
SELECT is(
  (SELECT lifecycle FROM public.tasks_projects
   WHERE id = '84000000-0000-4000-8000-000000000020'),
  'open', 'preserves project lifecycle when the receipt is restored'
);
SELECT is(
  (public.tasks_restore_export_v4(
    current_setting('test.tasks_hierarchy_export')::jsonb,
    true
  ) #>> '{tasks_projects,matches}')::integer,
  1, 'reports the restored project as an idempotent match'
);
SELECT is(
  (public.tasks_restore_export_v4(
    current_setting('test.tasks_hierarchy_export')::jsonb,
    true
  ) #>> '{tasks_hierarchy_operations,matches}')::integer,
  1, 'reports the restored receipt as an idempotent match'
);
SELECT throws_ok(
  format(
    'SELECT public.tasks_restore_export_v4(%L::jsonb, true)',
    jsonb_set(
      current_setting('test.tasks_hierarchy_export')::jsonb,
      '{data,tasks_areas,0,title}',
      '"Tampered"'::jsonb
    )::text
  ),
  '22023',
  'Task export v4 collection tasks_areas is invalid',
  'rejects checksum-tampered hierarchy data'
);
RESET ROLE;
SELECT is(
  (SELECT count(*) FROM tasks_private.restore_contexts),
  0::bigint, 'cleans up the private restore context'
);

SELECT * FROM finish();
ROLLBACK;
