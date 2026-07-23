BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(26);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '81000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'hierarchy-owner-a@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'hierarchy-owner-b@example.test', '', now(),
    '{}', '{}', now(), now()
  );

INSERT INTO public.tasks_areas (
  id, owner_id, title, order_key, client_mutation_id
)
VALUES
  (
    '81000000-0000-4000-8000-000000000010',
    '81000000-0000-4000-8000-000000000001',
    'Owner A area', 'a0', '81000000-0000-4000-8000-000000000011'
  ),
  (
    '82000000-0000-4000-8000-000000000010',
    '82000000-0000-4000-8000-000000000002',
    'Owner B area', 'a0', '82000000-0000-4000-8000-000000000011'
  );

INSERT INTO public.tasks_projects (
  id, owner_id, area_id, title, order_key, planning_order_key, client_mutation_id
)
VALUES
  (
    '81000000-0000-4000-8000-000000000020',
    '81000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000010',
    'Owner A project', 'a0', 'a0', '81000000-0000-4000-8000-000000000021'
  ),
  (
    '82000000-0000-4000-8000-000000000020',
    '82000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000010',
    'Owner B project', 'a0', 'a0', '82000000-0000-4000-8000-000000000021'
  );

INSERT INTO public.tasks_headings (
  id, owner_id, project_id, title, order_key, client_mutation_id
)
VALUES
  (
    '81000000-0000-4000-8000-000000000030',
    '81000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000020',
    'Owner A heading', 'a0', '81000000-0000-4000-8000-000000000031'
  ),
  (
    '82000000-0000-4000-8000-000000000030',
    '82000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000020',
    'Owner B heading', 'a0', '82000000-0000-4000-8000-000000000031'
  );

SELECT has_table('public', 'tasks_areas', 'creates the task area table');
SELECT has_table('public', 'tasks_projects', 'creates the task project table');
SELECT has_table('public', 'tasks_headings', 'creates the task heading table');
SELECT has_table('public', 'tasks_checklist_items', 'creates the task checklist table');
SELECT has_column('public', 'tasks_todos', 'area_id', 'stores loose task area membership');
SELECT has_column('public', 'tasks_todos', 'project_id', 'stores task project membership');
SELECT has_column('public', 'tasks_todos', 'heading_id', 'stores task heading membership');
SELECT has_column('public', 'tasks_todos', 'hierarchy_order_key', 'separates hierarchy order from planning order');
SELECT has_index('public', 'tasks_projects', 'tasks_projects_owner_area_order_idx', 'indexes project hierarchy order');
SELECT has_index('public', 'tasks_projects', 'tasks_projects_owner_planning_order_idx', 'indexes project planning order');
SELECT has_index('public', 'tasks_todos', 'tasks_todos_owner_container_order_idx', 'indexes task hierarchy order');
SELECT has_trigger('public', 'tasks_projects', 'tasks_projects_prepare_update', 'enforces project mutation invariants');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is((SELECT count(*) FROM public.tasks_areas), 1::bigint, 'shows only the owner area');
SELECT is((SELECT count(*) FROM public.tasks_projects), 1::bigint, 'shows only the owner project');

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_projects (
      id, owner_id, area_id, title, order_key, planning_order_key, client_mutation_id
    ) VALUES (
      '81000000-0000-4000-8000-000000000040',
      '81000000-0000-4000-8000-000000000001',
      '82000000-0000-4000-8000-000000000010',
      'Cross-owner project', 'a1', 'a1', '81000000-0000-4000-8000-000000000041'
    )
  $$,
  '23503', NULL, 'rejects cross-owner area membership'
);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key,
      project_id, heading_id, hierarchy_order_key, client_mutation_id
    ) VALUES (
      '81000000-0000-4000-8000-000000000050',
      '81000000-0000-4000-8000-000000000001',
      'Project task', 'anytime', 'p0',
      '81000000-0000-4000-8000-000000000020',
      '81000000-0000-4000-8000-000000000030',
      'h0', '81000000-0000-4000-8000-000000000051'
    )
  $$,
  'stores a task beneath a heading in its project'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key,
      area_id, project_id, hierarchy_order_key, client_mutation_id
    ) VALUES (
      '81000000-0000-4000-8000-000000000052',
      '81000000-0000-4000-8000-000000000001',
      'Ambiguous task', 'anytime', 'p1',
      '81000000-0000-4000-8000-000000000010',
      '81000000-0000-4000-8000-000000000020',
      'h1', '81000000-0000-4000-8000-000000000053'
    )
  $$,
  '23514', NULL, 'rejects simultaneous direct area and project membership'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key,
      project_id, heading_id, hierarchy_order_key, client_mutation_id
    ) VALUES (
      '81000000-0000-4000-8000-000000000054',
      '81000000-0000-4000-8000-000000000001',
      'Mismatched heading task', 'anytime', 'p2',
      '81000000-0000-4000-8000-000000000020',
      '82000000-0000-4000-8000-000000000030',
      'h2', '81000000-0000-4000-8000-000000000055'
    )
  $$,
  '23503', NULL, 'rejects a heading outside the owner and project'
);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_checklist_items (
      id, owner_id, task_id, title, order_key, client_mutation_id
    ) VALUES (
      '81000000-0000-4000-8000-000000000060',
      '81000000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000050',
      'Independent checklist item', 'a0',
      '81000000-0000-4000-8000-000000000061'
    )
  $$,
  'stores a checklist item beneath exactly one owned task'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_checklist_items
    SET completed = true,
        completed_at = '2026-07-20T06:00:00.000Z',
        revision = 2,
        client_mutation_id = '81000000-0000-4000-8000-000000000062'
    WHERE id = '81000000-0000-4000-8000-000000000060'
  $$,
  'completes a checklist item independently of its parent task'
);

SELECT is(
  (SELECT lifecycle FROM public.tasks_todos WHERE id = '81000000-0000-4000-8000-000000000050'),
  'open',
  'leaves the parent task open after checklist completion'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_projects
    SET revision = 3,
        client_mutation_id = '81000000-0000-4000-8000-000000000022'
    WHERE id = '81000000-0000-4000-8000-000000000020'
  $$,
  '23514', 'Hierarchy revision must increment by exactly one',
  'rejects a skipped hierarchy revision'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET project_id = NULL,
        heading_id = NULL,
        area_id = '81000000-0000-4000-8000-000000000010',
        hierarchy_order_key = 'a1',
        revision = 2,
        client_mutation_id = '81000000-0000-4000-8000-000000000056'
    WHERE id = '81000000-0000-4000-8000-000000000050'
  $$,
  'moves a task atomically while preserving its planning placement'
);

SELECT is(
  (SELECT transition FROM public.tasks_history_events
   WHERE task_id = '81000000-0000-4000-8000-000000000050'
   ORDER BY result_revision DESC LIMIT 1),
  'move',
  'records hierarchy placement changes as moves'
);

SELECT throws_ok(
  $$DELETE FROM public.tasks_areas WHERE id = '81000000-0000-4000-8000-000000000010'$$,
  '42501', NULL, 'rejects authenticated hard deletion of hierarchy rows'
);

SELECT is(
  (SELECT order_key FROM public.tasks_todos WHERE id = '81000000-0000-4000-8000-000000000050'),
  'p0',
  'keeps planning order independent from hierarchy order'
);

SELECT * FROM finish();
ROLLBACK;
