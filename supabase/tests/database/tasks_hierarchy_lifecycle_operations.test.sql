BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(23);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '83000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'hierarchy-lifecycle@example.test', '', now(),
  '{}', '{}', now(), now()
);

INSERT INTO public.tasks_areas (
  id, owner_id, title, order_key, client_mutation_id
) VALUES (
  '83000000-0000-4000-8000-000000000010',
  '83000000-0000-4000-8000-000000000001',
  'Lifecycle area', 'a0', '83000000-0000-4000-8000-000000000011'
);

INSERT INTO public.tasks_projects (
  id, owner_id, area_id, title, order_key, planning_order_key, client_mutation_id
) VALUES (
  '83000000-0000-4000-8000-000000000020',
  '83000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000010',
  'Lifecycle project', 'a0', 'a0', '83000000-0000-4000-8000-000000000021'
);

INSERT INTO public.tasks_headings (
  id, owner_id, project_id, title, order_key, client_mutation_id
) VALUES (
  '83000000-0000-4000-8000-000000000030',
  '83000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000020',
  'Lifecycle heading', 'a0', '83000000-0000-4000-8000-000000000031'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, project_id, heading_id,
  hierarchy_order_key, client_mutation_id
) VALUES (
  '83000000-0000-4000-8000-000000000040',
  '83000000-0000-4000-8000-000000000001',
  'Open descendant', 'anytime', 'a0',
  '83000000-0000-4000-8000-000000000020',
  '83000000-0000-4000-8000-000000000030',
  'a0', '83000000-0000-4000-8000-000000000041'
);

INSERT INTO public.tasks_checklist_items (
  id, owner_id, task_id, title, order_key, client_mutation_id
) VALUES (
  '83000000-0000-4000-8000-000000000050',
  '83000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000040',
  'Preserved checklist state', 'a0', '83000000-0000-4000-8000-000000000051'
);

SELECT has_table(
  'public', 'tasks_hierarchy_operations', 'creates durable hierarchy operation receipts'
);
SELECT has_table(
  'public', 'tasks_hierarchy_history_events', 'creates append-only hierarchy history'
);
SELECT has_column(
  'public', 'tasks_projects', 'deletion_root_id', 'tracks the project deletion root'
);
SELECT has_column(
  'public', 'tasks_todos', 'deletion_root_id', 'tracks the task deletion root'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT throws_ok(
  $$
    UPDATE public.tasks_projects
    SET lifecycle = 'completed', completed_at = '2026-07-20T08:00:00Z',
      revision = 2, client_mutation_id = '83000000-0000-4000-8000-000000000022'
    WHERE id = '83000000-0000-4000-8000-000000000020'
  $$,
  '23514', 'Projects with open descendants require an explicit cascade policy',
  'rejects a direct terminal transition while open descendants remain'
);

INSERT INTO public.tasks_hierarchy_operations (
  id, owner_id, root_type, root_id, operation, descendant_policy,
  expected_revisions, requested_at
) VALUES (
  '83000000-0000-4000-8000-000000000060',
  '83000000-0000-4000-8000-000000000001',
  'project', '83000000-0000-4000-8000-000000000020',
  'complete_project', 'reject',
  jsonb_build_object('83000000-0000-4000-8000-000000000020', 1),
  '2026-07-20T08:01:00Z'
);

SELECT is(
  (SELECT outcome FROM public.tasks_hierarchy_operations
   WHERE id = '83000000-0000-4000-8000-000000000060'),
  'rejected', 'records the default descendant-policy rejection'
);
SELECT is(
  (SELECT code FROM public.tasks_hierarchy_operations
   WHERE id = '83000000-0000-4000-8000-000000000060'),
  'open_descendants', 'returns a content-free open-descendant code'
);
SELECT is(
  (SELECT lifecycle FROM public.tasks_projects
   WHERE id = '83000000-0000-4000-8000-000000000020'),
  'open', 'leaves the project unchanged after rejection'
);

INSERT INTO public.tasks_hierarchy_operations (
  id, owner_id, root_type, root_id, operation, descendant_policy,
  expected_revisions, requested_at
) VALUES (
  '83000000-0000-4000-8000-000000000061',
  '83000000-0000-4000-8000-000000000001',
  'project', '83000000-0000-4000-8000-000000000020',
  'complete_project', 'cascade',
  jsonb_build_object(
    '83000000-0000-4000-8000-000000000020', 1,
    '83000000-0000-4000-8000-000000000040', 1
  ),
  '2026-07-20T08:02:00Z'
);

SELECT is(
  (SELECT outcome FROM public.tasks_hierarchy_operations
   WHERE id = '83000000-0000-4000-8000-000000000061'),
  'accepted', 'accepts an explicit revision-checked cascade'
);
SELECT is(
  (SELECT lifecycle FROM public.tasks_projects
   WHERE id = '83000000-0000-4000-8000-000000000020'),
  'completed', 'completes the project atomically'
);
SELECT is(
  (SELECT lifecycle FROM public.tasks_todos
   WHERE id = '83000000-0000-4000-8000-000000000040'),
  'completed', 'completes the open descendant atomically'
);
SELECT is(
  (SELECT completed FROM public.tasks_checklist_items
   WHERE id = '83000000-0000-4000-8000-000000000050'),
  false, 'preserves checklist completion state during parent completion'
);
SELECT is(
  (SELECT transition FROM public.tasks_hierarchy_history_events
   WHERE entity_id = '83000000-0000-4000-8000-000000000020'
   ORDER BY result_revision DESC LIMIT 1),
  'complete', 'appends project lifecycle history'
);

INSERT INTO public.tasks_hierarchy_operations (
  id, owner_id, root_type, root_id, operation, descendant_policy,
  expected_revisions, requested_at
) VALUES (
  '83000000-0000-4000-8000-000000000062',
  '83000000-0000-4000-8000-000000000001',
  'project', '83000000-0000-4000-8000-000000000020', 'delete', 'cascade',
  jsonb_build_object(
    '83000000-0000-4000-8000-000000000020', 2,
    '83000000-0000-4000-8000-000000000030', 1,
    '83000000-0000-4000-8000-000000000040', 2,
    '83000000-0000-4000-8000-000000000050', 1
  ),
  '2026-07-20T08:03:00Z'
);

SELECT is(
  (SELECT outcome FROM public.tasks_hierarchy_operations
   WHERE id = '83000000-0000-4000-8000-000000000062'),
  'accepted', 'deletes the complete project hierarchy atomically'
);
SELECT is(
  (SELECT count(*) FROM (
    SELECT deletion_root_id FROM public.tasks_projects
    WHERE id = '83000000-0000-4000-8000-000000000020'
    UNION ALL SELECT deletion_root_id FROM public.tasks_headings
    WHERE id = '83000000-0000-4000-8000-000000000030'
    UNION ALL SELECT deletion_root_id FROM public.tasks_todos
    WHERE id = '83000000-0000-4000-8000-000000000040'
    UNION ALL SELECT deletion_root_id FROM public.tasks_checklist_items
    WHERE id = '83000000-0000-4000-8000-000000000050'
  ) AS deleted WHERE deletion_root_id = '83000000-0000-4000-8000-000000000020'),
  4::bigint, 'marks every deleted descendant with the selected root'
);

INSERT INTO public.tasks_hierarchy_operations (
  id, owner_id, root_type, root_id, operation, descendant_policy,
  expected_revisions, requested_at
) VALUES (
  '83000000-0000-4000-8000-000000000063',
  '83000000-0000-4000-8000-000000000001',
  'area', '83000000-0000-4000-8000-000000000010', 'delete', 'cascade',
  jsonb_build_object('83000000-0000-4000-8000-000000000010', 1),
  '2026-07-20T08:04:00Z'
);

SELECT is(
  (SELECT outcome FROM public.tasks_hierarchy_operations
   WHERE id = '83000000-0000-4000-8000-000000000063'),
  'accepted', 'allows the former area to be deleted independently'
);

INSERT INTO public.tasks_hierarchy_operations (
  id, owner_id, root_type, root_id, operation, descendant_policy,
  expected_revisions, requested_at
) VALUES (
  '83000000-0000-4000-8000-000000000064',
  '83000000-0000-4000-8000-000000000001',
  'project', '83000000-0000-4000-8000-000000000020', 'restore', 'cascade',
  jsonb_build_object(
    '83000000-0000-4000-8000-000000000020', 3,
    '83000000-0000-4000-8000-000000000030', 2,
    '83000000-0000-4000-8000-000000000040', 3,
    '83000000-0000-4000-8000-000000000050', 2
  ),
  '2026-07-20T08:05:00Z'
);

SELECT is(
  (SELECT outcome FROM public.tasks_hierarchy_operations
   WHERE id = '83000000-0000-4000-8000-000000000064'),
  'accepted', 'restores exactly the root-marked hierarchy'
);
SELECT is(
  (SELECT area_id FROM public.tasks_projects
   WHERE id = '83000000-0000-4000-8000-000000000020'),
  NULL::uuid, 'restores a project without its unavailable former area'
);
SELECT is(
  (SELECT disposition FROM public.tasks_areas
   WHERE id = '83000000-0000-4000-8000-000000000010'),
  'deleted', 'does not resurrect an independently deleted ancestor'
);
SELECT is(
  (SELECT count(*) FROM (
    SELECT disposition, deletion_root_id FROM public.tasks_projects
    WHERE id = '83000000-0000-4000-8000-000000000020'
    UNION ALL SELECT disposition, deletion_root_id FROM public.tasks_headings
    WHERE id = '83000000-0000-4000-8000-000000000030'
    UNION ALL SELECT disposition, deletion_root_id FROM public.tasks_todos
    WHERE id = '83000000-0000-4000-8000-000000000040'
    UNION ALL SELECT disposition, deletion_root_id FROM public.tasks_checklist_items
    WHERE id = '83000000-0000-4000-8000-000000000050'
  ) AS restored WHERE disposition = 'present' AND deletion_root_id IS NULL),
  4::bigint, 'clears root markers from every restored descendant'
);
SELECT is(
  (SELECT lifecycle FROM public.tasks_todos
   WHERE id = '83000000-0000-4000-8000-000000000040'),
  'completed', 'preserves descendant lifecycle through delete and restore'
);

INSERT INTO public.tasks_hierarchy_operations (
  id, owner_id, root_type, root_id, operation, descendant_policy,
  expected_revisions, requested_at
) VALUES (
  '83000000-0000-4000-8000-000000000065',
  '83000000-0000-4000-8000-000000000001',
  'project', '83000000-0000-4000-8000-000000000020', 'delete', 'cascade',
  jsonb_build_object('83000000-0000-4000-8000-000000000020', 999),
  '2026-07-20T08:06:00Z'
);

SELECT is(
  (SELECT outcome FROM public.tasks_hierarchy_operations
   WHERE id = '83000000-0000-4000-8000-000000000065'),
  'conflict', 'rejects a stale or incomplete revision set without partial mutation'
);
SELECT is(
  (SELECT disposition FROM public.tasks_projects
   WHERE id = '83000000-0000-4000-8000-000000000020'),
  'present', 'leaves the hierarchy unchanged after a revision-set conflict'
);

SELECT * FROM finish();
ROLLBACK;
