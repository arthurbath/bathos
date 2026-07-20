BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(28);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '94000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'actionability@example.test', '', now(),
  '{}', '{}', now(), now()
);

SELECT has_column(
  'public', 'tasks_todos', 'actionability',
  'stores task actionability explicitly'
);
SELECT col_default_is(
  'public', 'tasks_todos', 'actionability', 'actionable',
  'defaults new tasks to actionable'
);
SELECT is(
  (SELECT count(*) FROM pg_constraint
   WHERE conrelid = 'public.tasks_todos'::regclass
     AND conname = 'tasks_todos_actionability_valid'),
  1::bigint,
  'constrains the actionability vocabulary'
);
SELECT has_index(
  'public', 'tasks_todos', 'tasks_todos_owner_actionability_idx',
  'indexes owner-scoped actionability filters'
);
SELECT has_function(
  'public', 'tasks_create_export_v7', ARRAY[]::text[],
  'creates the actionability-aware portable export'
);
SELECT has_function(
  'public', 'tasks_restore_export_v7', ARRAY['jsonb', 'boolean'],
  'restores the actionability-aware portable export'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, client_mutation_id
    ) VALUES (
      '94000000-0000-4000-8000-000000000010',
      '94000000-0000-4000-8000-000000000001',
      'Synthetic task', 'today', 'a0',
      '94000000-0000-4000-8000-000000000020'
    )
  $$,
  'creates a task without an actionability workaround'
);
SELECT is(
  (SELECT actionability FROM public.tasks_todos
   WHERE id = '94000000-0000-4000-8000-000000000010'),
  'actionable',
  'uses the actionable default'
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET actionability = 'waiting',
        revision = 2,
        client_mutation_id = '94000000-0000-4000-8000-000000000021'
    WHERE id = '94000000-0000-4000-8000-000000000010'
  $$,
  'marks open present work as waiting'
);
SELECT is(
  (SELECT actionability FROM public.tasks_todos
   WHERE id = '94000000-0000-4000-8000-000000000010'),
  'waiting',
  'stores waiting explicitly'
);
SELECT is(
  (SELECT transition FROM public.tasks_history_events
   WHERE client_mutation_id = '94000000-0000-4000-8000-000000000021'),
  'set_actionability',
  'records a dedicated actionability transition'
);
SELECT is(
  (SELECT before_state ->> 'actionability' FROM public.tasks_history_events
   WHERE client_mutation_id = '94000000-0000-4000-8000-000000000021'),
  'actionable',
  'records the previous actionability in history'
);
SELECT is(
  (SELECT after_state ->> 'actionability' FROM public.tasks_history_events
   WHERE client_mutation_id = '94000000-0000-4000-8000-000000000021'),
  'waiting',
  'records the resulting actionability in history'
);
SELECT is(
  (SELECT destination FROM public.tasks_todos
   WHERE id = '94000000-0000-4000-8000-000000000010'),
  'today',
  'does not move waiting work from its planned destination'
);
SELECT is(
  (SELECT order_key FROM public.tasks_todos
   WHERE id = '94000000-0000-4000-8000-000000000010'),
  'a0',
  'does not reorder waiting work'
);
SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, actionability,
      client_mutation_id
    ) VALUES (
      '94000000-0000-4000-8000-000000000011',
      '94000000-0000-4000-8000-000000000001',
      'Invalid task', 'inbox', 'a1', 'blocked',
      '94000000-0000-4000-8000-000000000022'
    )
  $$,
  '23514', NULL,
  'rejects uncontracted actionability values'
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET lifecycle = 'completed',
        completed_at = '2026-07-20T20:00:00Z',
        revision = 3,
        client_mutation_id = '94000000-0000-4000-8000-000000000023'
    WHERE id = '94000000-0000-4000-8000-000000000010'
  $$,
  'completes waiting work without rewriting actionability'
);
SELECT is(
  (SELECT actionability FROM public.tasks_todos
   WHERE id = '94000000-0000-4000-8000-000000000010'),
  'waiting',
  'retains actionability on terminal work'
);
SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET actionability = 'actionable',
        revision = 4,
        client_mutation_id = '94000000-0000-4000-8000-000000000024'
    WHERE id = '94000000-0000-4000-8000-000000000010'
  $$,
  '23514',
  'Actionability can be changed only on open, present tasks',
  'rejects actionability changes on terminal work'
);
SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, actionability,
      client_mutation_id
    ) VALUES (
      '94000000-0000-4000-8000-000000000012',
      '94000000-0000-4000-8000-000000000001',
      'Waiting deletion task', 'inbox', 'a2', 'waiting',
      '94000000-0000-4000-8000-000000000025'
    )
  $$,
  'creates waiting work directly through a structured field'
);
SELECT lives_ok(
  $$
    INSERT INTO public.tasks_hierarchy_operations (
      id, owner_id, root_type, root_id, operation, descendant_policy,
      expected_revisions, requested_at
    ) VALUES (
      '94000000-0000-4000-8000-000000000026',
      '94000000-0000-4000-8000-000000000001',
      'todo', '94000000-0000-4000-8000-000000000012', 'delete', 'cascade',
      jsonb_build_object('94000000-0000-4000-8000-000000000012', 1),
      '2026-07-20T20:05:00Z'
    )
  $$,
  'recoverably deletes waiting work'
);
SELECT is(
  (SELECT actionability FROM public.tasks_todos
   WHERE id = '94000000-0000-4000-8000-000000000012'),
  'waiting',
  'retains actionability in Trash'
);
SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET actionability = 'actionable',
        revision = revision + 1,
        client_mutation_id = '94000000-0000-4000-8000-000000000027'
    WHERE id = '94000000-0000-4000-8000-000000000012'
  $$,
  '23514',
  'Actionability can be changed only on open, present tasks',
  'rejects actionability changes in Trash'
);

SELECT set_config('test.tasks_actionability_export', public.tasks_create_export_v7()::text, false);
SELECT is(
  (current_setting('test.tasks_actionability_export')::jsonb ->> 'schema_version')::integer,
  7,
  'advances the portable schema to version seven'
);
SELECT is(
  (
    SELECT task ->> 'actionability'
    FROM jsonb_array_elements(
      current_setting('test.tasks_actionability_export')::jsonb #> '{data,tasks_todos}'
    ) AS task
    WHERE task ->> 'id' = '94000000-0000-4000-8000-000000000010'
  ),
  'waiting',
  'exports current actionability'
);
SELECT is(
  (
    SELECT event #>> '{after_state,actionability}'
    FROM jsonb_array_elements(
      current_setting('test.tasks_actionability_export')::jsonb
      #> '{data,tasks_history_events}'
    ) AS event
    WHERE event ->> 'client_mutation_id' = '94000000-0000-4000-8000-000000000021'
  ),
  'waiting',
  'exports actionability history'
);
SELECT is(
  (
    public.tasks_restore_export_v7(
      current_setting('test.tasks_actionability_export')::jsonb,
      true
    ) #>> '{tasks_todos,matches}'
  )::integer,
  2,
  'previews an exact actionability-aware restore as matches'
);
SELECT throws_ok(
  format(
    'SELECT public.tasks_restore_export_v7(%L::jsonb, true)',
    jsonb_set(
      current_setting('test.tasks_actionability_export')::jsonb,
      '{data,tasks_todos,0,actionability}',
      '"blocked"'::jsonb
    )::text
  ),
  '22023', NULL,
  'rejects a tampered actionability export'
);

SELECT * FROM finish();
ROLLBACK;
