BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(20);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '71000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'today-owner@example.test', '', now(),
  '{}', '{}', now(), now()
);

SELECT has_column('public', 'tasks_todos', 'today_section', 'stores a Today section');
SELECT is(
  (
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks_todos'
      AND column_name = 'today_section'
  ),
  NULL,
  'leaves unscheduled work outside Today by default'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tasks_todos'::regclass
      AND conname = 'tasks_todos_today_section_valid'
  ),
  'constrains Today membership to current sections'
);
SELECT ok(
  pg_get_indexdef('public.tasks_todos_owner_today_section_order_idx'::regclass)
    LIKE '%today_section%',
  'indexes active manual order by Today section'
);
SELECT has_function('public', 'tasks_create_export_v12', ARRAY[]::text[], 'exports schema version twelve');
SELECT has_function(
  'public',
  'tasks_restore_export_current',
  ARRAY['jsonb', 'boolean'],
  'restores every supported schema through current planning'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, order_key,
      client_mutation_id
    )
    VALUES (
      '71000000-0000-4000-8000-000000000010',
      '71000000-0000-4000-8000-000000000001',
      'Synthetic evening task', 'anytime', 'later', 'a0',
      '71000000-0000-4000-8000-000000000020'
    )
  $$,
  'stores This Evening as a section of Today'
);
SELECT is(
  (
    SELECT today_section
    FROM public.tasks_todos
    WHERE id = '71000000-0000-4000-8000-000000000010'
  ),
  'later',
  'reads the stored evening section'
);
SELECT is(
  (
    SELECT after_state ->> 'today_section'
    FROM public.tasks_history_events
    WHERE task_id = '71000000-0000-4000-8000-000000000010'
  ),
  'later',
  'records the section in append-only history'
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      today_section = 'next',
      revision = 2,
      client_mutation_id = '71000000-0000-4000-8000-000000000021'
    WHERE id = '71000000-0000-4000-8000-000000000010'
  $$,
  'moves an evening task to daytime with one revision'
);
SELECT is(
  (
    SELECT transition
    FROM public.tasks_history_events
    WHERE task_id = '71000000-0000-4000-8000-000000000010'
      AND result_revision = 2
  ),
  'move',
  'classifies a section change as a move'
);
SELECT is(
  (
    SELECT before_state ->> 'today_section'
    FROM public.tasks_history_events
    WHERE task_id = '71000000-0000-4000-8000-000000000010'
      AND result_revision = 2
  ),
  'later',
  'preserves the prior section for undo'
);
SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, today_section, order_key, client_mutation_id
    )
    VALUES (
      '71000000-0000-4000-8000-000000000011',
      '71000000-0000-4000-8000-000000000001',
      'Invalid retired section', 'anytime', 'evening', 'a1',
      '71000000-0000-4000-8000-000000000022'
    )
  $$,
  '23514',
  NULL,
  'rejects a retired day horizon'
);

UPDATE public.tasks_todos
SET
  today_section = 'later',
  revision = 3,
  client_mutation_id = '71000000-0000-4000-8000-000000000023'
WHERE id = '71000000-0000-4000-8000-000000000010';

SELECT set_config('test.tasks_today_export', public.tasks_create_export_v12()::text, false);
SELECT is(
  (current_setting('test.tasks_today_export')::jsonb ->> 'schema_version')::integer,
  12,
  'uses portable export schema version twelve'
);
SELECT is(
  current_setting('test.tasks_today_export')::jsonb
    #>> '{data,tasks_todos,0,today_section}',
  'later',
  'exports the current Today section'
);
SELECT ok(
  jsonb_path_exists(
    current_setting('test.tasks_today_export')::jsonb,
    '$.data.tasks_history_events[*].after_state.today_section'
  ),
  'normalizes Today sections into every exported history state'
);
SELECT is(
  jsonb_path_exists(public.tasks_create_export_v2(), '$.data.tasks_todos[*].today_section'),
  false,
  'keeps version two task records backward compatible'
);
SELECT is(
  jsonb_path_exists(
    public.tasks_create_export_v2(),
    '$.data.tasks_history_events[*].after_state.today_section'
  ),
  false,
  'keeps version two history records backward compatible'
);

RESET ROLE;
DELETE FROM public.tasks_todos
WHERE id = '71000000-0000-4000-8000-000000000010';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_today_export')::jsonb,
      true
    ) #>> '{tasks_todos,inserts}'
  )::integer,
  1,
  'previews restoring sectioned Today work'
);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.tasks_today_export')::jsonb,
      false
    ) #>> '{tasks_todos,inserts}'
  )::integer,
  1,
  'restores sectioned Today work'
);

SELECT * FROM finish();
ROLLBACK;
