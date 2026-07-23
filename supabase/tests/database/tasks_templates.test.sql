BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(59);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '95000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'templates-a@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '95000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'templates-b@example.test', '', now(),
    '{}', '{}', now(), now()
  );

SELECT has_table('public', 'tasks_templates', 'stores template definitions');
SELECT has_table('public', 'tasks_template_revisions', 'stores immutable template revisions');
SELECT has_table(
  'public', 'tasks_template_instantiations',
  'stores idempotent template instantiations'
);
SELECT has_column(
  'public', 'tasks_todos', 'template_instantiation_id',
  'stores to-do template provenance'
);
SELECT has_column(
  'public', 'tasks_projects', 'template_node_id',
  'stores project template-node provenance'
);
SELECT hasnt_table(
  'public', 'tasks_headings',
  'keeps template provenance heading-free'
);
SELECT has_column(
  'public', 'tasks_checklist_items', 'template_node_id',
  'stores checklist template-node provenance'
);
SELECT has_function(
  'public', 'tasks_capture_template',
  ARRAY['uuid', 'text', 'uuid', 'text', 'date', 'uuid', 'text', 'text'],
  'captures and revises templates through one guarded function'
);
SELECT has_function(
  'tasks_private', 'capture_template_source',
  ARRAY['uuid', 'text', 'uuid', 'date'],
  'resolves source revision and hierarchy behind one private function boundary'
);
SELECT is(
  (
    SELECT routine.provolatile::text
    FROM pg_catalog.pg_proc AS routine
    WHERE routine.oid = 'tasks_private.capture_template_source(uuid,text,uuid,date)'::regprocedure
  ),
  's',
  'keeps all source-capture reads on the calling statement snapshot'
);
SELECT is(
  has_function_privilege(
    'authenticated',
    'tasks_private.capture_template_source(uuid,text,uuid,date)',
    'EXECUTE'
  ),
  false,
  'withholds the private source-capture boundary from authenticated callers'
);
SELECT ok(
  pg_get_functiondef(
    'public.tasks_capture_template(uuid,text,uuid,text,date,uuid,text,text)'::regprocedure
  ) LIKE '%tasks_private.capture_template_source%',
  'delegates capture provenance and hierarchy to the stable source boundary'
);
SELECT ok(
  pg_get_functiondef(
    'public.tasks_capture_template(uuid,text,uuid,text,date,uuid,text,text)'::regprocedure
  ) NOT LIKE '%template_snapshot_from_%',
  'does not rebuild hierarchy through a later public-capture statement'
);
SELECT has_function(
  'public', 'tasks_instantiate_template',
  ARRAY['uuid', 'bigint', 'date', 'uuid', 'text', 'text', 'uuid'],
  'instantiates a template atomically'
);
SELECT has_function(
  'public', 'tasks_archive_template',
  ARRAY['uuid', 'bigint', 'uuid', 'text', 'text'],
  'archives template definitions explicitly'
);
SELECT has_function(
  'public', 'tasks_create_export_v12', ARRAY[]::text[],
  'exports template definitions and provenance'
);
SELECT has_function(
  'public', 'tasks_restore_export_current', ARRAY['jsonb', 'boolean'],
  'restores template definitions and provenance'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  '95000000-0000-4000-8000-000000000010',
  '95000000-0000-4000-8000-000000000001',
  'UTC',
  '95000000-0000-4000-8000-000000000011'
);
INSERT INTO public.tasks_todos (
  id, owner_id, title, notes, destination, today_section, start_date,
  deadline, order_key, actionability, client_mutation_id
) VALUES (
  '95000000-0000-4000-8000-000000000020',
  '95000000-0000-4000-8000-000000000001',
  'Synthetic source to-do', 'Reusable source notes', 'anytime', 'later',
  (now() AT TIME ZONE 'UTC')::date + 1,
  (now() AT TIME ZONE 'UTC')::date + 2,
  'a0', 'waiting',
  '95000000-0000-4000-8000-000000000021'
);
INSERT INTO public.tasks_checklist_items (
  id, owner_id, task_id, title, completed, completed_at, order_key,
  client_mutation_id
) VALUES (
  '95000000-0000-4000-8000-000000000022',
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000020',
  'Reusable checklist step', true, now(), 'a0',
  '95000000-0000-4000-8000-000000000023'
);

SELECT lives_ok(
  $$
    SELECT set_config(
      'test.todo_template_capture',
      public.tasks_capture_template(
        NULL,
        'todo',
        '95000000-0000-4000-8000-000000000020',
        'Synthetic to-do template',
        (now() AT TIME ZONE 'UTC')::date,
        '95000000-0000-4000-8000-000000000024'
      )::text,
      false
    )
  $$,
  'captures a to-do template from current work'
);
SELECT is(
  current_setting('test.todo_template_capture')::jsonb #>> '{template,kind}',
  'todo',
  'creates a to-do definition'
);
SELECT is(
  (
    current_setting('test.todo_template_capture')::jsonb
      #>> '{revision,snapshot,root,deadline_offset_days}'
  )::integer,
  2,
  'stores a relative deadline instead of an absolute date'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.todo_template_capture')::jsonb
      #> '{revision,snapshot,root,checklist}'
  ),
  1,
  'captures the reusable checklist hierarchy'
);

SELECT lives_ok(
  $$
    SELECT set_config(
      'test.todo_template_instance',
      public.tasks_instantiate_template(
        (
          current_setting('test.todo_template_capture')::jsonb
            #>> '{template,id}'
        )::uuid,
        1,
        (now() AT TIME ZONE 'UTC')::date,
        '95000000-0000-4000-8000-000000000025'
      )::text,
      false
    )
  $$,
  'instantiates a to-do template'
);
SELECT is(
  (
    SELECT destination FROM public.tasks_todos
    WHERE id = (
      current_setting('test.todo_template_instance')::jsonb
        #>> '{result,root_id}'
    )::uuid
  ),
  'anytime',
  'keeps generated future work in Anytime'
);
SELECT is(
  (
    SELECT today_section FROM public.tasks_todos
    WHERE id = (
      current_setting('test.todo_template_instance')::jsonb
        #>> '{result,root_id}'
    )::uuid
  ),
  'later',
  'preserves the relative This Evening intent'
);
SELECT is(
  (
    SELECT actionability FROM public.tasks_todos
    WHERE id = (
      current_setting('test.todo_template_instance')::jsonb
        #>> '{result,root_id}'
    )::uuid
  ),
  'waiting',
  'copies structured actionability without a tag'
);
SELECT is(
  (
    SELECT source_kind FROM public.tasks_todos
    WHERE id = (
      current_setting('test.todo_template_instance')::jsonb
        #>> '{result,root_id}'
    )::uuid
  ),
  'template',
  'marks generated work with typed template provenance'
);
SELECT is(
  (
    SELECT count(*) FROM public.tasks_checklist_items
    WHERE task_id = (
      current_setting('test.todo_template_instance')::jsonb
        #>> '{result,root_id}'
    )::uuid
      AND completed = false
  ),
  1::bigint,
  'creates independent unchecked checklist work'
);
SELECT is(
  (
    public.tasks_instantiate_template(
      (
        current_setting('test.todo_template_capture')::jsonb
          #>> '{template,id}'
      )::uuid,
      1,
      (now() AT TIME ZONE 'UTC')::date,
      '95000000-0000-4000-8000-000000000025'
    ) #>> '{result,root_id}'
  ),
  current_setting('test.todo_template_instance')::jsonb #>> '{result,root_id}',
  'returns the same hierarchy for an exact retry'
);
SELECT is(
  (
    SELECT count(*) FROM public.tasks_template_instantiations
    WHERE client_mutation_id = '95000000-0000-4000-8000-000000000025'
  ),
  1::bigint,
  'stores one logical instantiation receipt'
);
SELECT throws_ok(
  $$
    SELECT public.tasks_instantiate_template(
      (
        current_setting('test.todo_template_capture')::jsonb
          #>> '{template,id}'
      )::uuid,
      1,
      (now() AT TIME ZONE 'UTC')::date + 1,
      '95000000-0000-4000-8000-000000000025'
    )
  $$,
  '23505',
  'The request identifier belongs to a different template instance',
  'rejects changed input under an existing request identifier'
);
SELECT throws_ok(
  $$
    INSERT INTO public.tasks_todos (
      id, owner_id, title, destination, order_key, source_kind,
      source_external_id, template_definition_id, template_revision,
      template_instantiation_id, template_node_id, client_mutation_id
    ) VALUES (
      '95000000-0000-4000-8000-000000000026',
      '95000000-0000-4000-8000-000000000001',
      'Spoofed template task', 'anytime', 'a1', 'template',
      current_setting('test.todo_template_capture')::jsonb #>> '{template,id}',
      (current_setting('test.todo_template_capture')::jsonb #>> '{template,id}')::uuid,
      1,
      (
        current_setting('test.todo_template_instance')::jsonb
          #>> '{instantiation,id}'
      )::uuid,
      '95000000-0000-4000-8000-000000000020',
      '95000000-0000-4000-8000-000000000027'
    )
  $$,
  '42501',
  'Template provenance can be assigned only by instantiation or restore',
  'rejects client-spoofed template provenance'
);

UPDATE public.tasks_todos
SET title = 'Revised synthetic source', revision = revision + 1,
    client_mutation_id = '95000000-0000-4000-8000-000000000028'
WHERE id = '95000000-0000-4000-8000-000000000020';
SELECT lives_ok(
  format(
    $$
      SELECT set_config(
        'test.todo_template_revision',
        public.tasks_capture_template(
          %L::uuid,
          'todo',
          '95000000-0000-4000-8000-000000000020',
          'Synthetic to-do template',
          (now() AT TIME ZONE 'UTC')::date,
          '95000000-0000-4000-8000-000000000029'
        )::text,
        false
      )
    $$,
    current_setting('test.todo_template_capture')::jsonb #>> '{template,id}'
  ),
  'creates a new immutable template revision'
);
SELECT is(
  (
    current_setting('test.todo_template_revision')::jsonb
      #>> '{revision,revision}'
  )::integer,
  2,
  'advances the current template revision'
);
SELECT is(
  (
    SELECT snapshot #>> '{root,title}'
    FROM public.tasks_template_revisions
    WHERE template_id = (
      current_setting('test.todo_template_capture')::jsonb #>> '{template,id}'
    )::uuid AND revision = 1
  ),
  'Synthetic source to-do',
  'leaves the prior revision unchanged'
);
SELECT is(
  (
    SELECT title FROM public.tasks_todos
    WHERE id = (
      current_setting('test.todo_template_instance')::jsonb #>> '{result,root_id}'
    )::uuid
  ),
  'Synthetic source to-do',
  'leaves an existing instance unchanged after revision'
);

INSERT INTO public.tasks_areas (
  id, owner_id, title, order_key, client_mutation_id
) VALUES (
  '95000000-0000-4000-8000-000000000030',
  '95000000-0000-4000-8000-000000000001',
  'Synthetic area', 'a0',
  '95000000-0000-4000-8000-000000000031'
);
INSERT INTO public.tasks_projects (
  id, owner_id, title, notes, destination, order_key, planning_order_key,
  client_mutation_id
) VALUES (
  '95000000-0000-4000-8000-000000000032',
  '95000000-0000-4000-8000-000000000001',
  'Synthetic project source', 'Project source notes', 'anytime', 'a0', 'a0',
  '95000000-0000-4000-8000-000000000033'
);
INSERT INTO public.tasks_todos (
  id, owner_id, project_id, title, destination, order_key,
  hierarchy_order_key, client_mutation_id
) VALUES (
  '95000000-0000-4000-8000-000000000036',
  '95000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000032',
  'Synthetic project task', 'anytime', 'a1', 'a0',
  '95000000-0000-4000-8000-000000000037'
);

SELECT lives_ok(
  $$
    SELECT set_config(
      'test.project_template_capture',
      public.tasks_capture_template(
        NULL,
        'project',
        '95000000-0000-4000-8000-000000000032',
        'Synthetic project template',
        (now() AT TIME ZONE 'UTC')::date,
        '95000000-0000-4000-8000-000000000038'
      )::text,
      false
    )
  $$,
  'captures a project hierarchy as a template'
);
SELECT lives_ok(
  $$
    SELECT set_config(
      'test.project_template_instance',
      public.tasks_instantiate_template(
        (
          current_setting('test.project_template_capture')::jsonb
            #>> '{template,id}'
        )::uuid,
        NULL,
        (now() AT TIME ZONE 'UTC')::date,
        '95000000-0000-4000-8000-000000000039',
        'web', 'user',
        '95000000-0000-4000-8000-000000000030'
      )::text,
      false
    )
  $$,
  'instantiates a project template into a selected area'
);
SELECT is(
  (
    SELECT area_id FROM public.tasks_projects
    WHERE id = (
      current_setting('test.project_template_instance')::jsonb
        #>> '{result,root_id}'
    )::uuid
  ),
  '95000000-0000-4000-8000-000000000030'::uuid,
  'places the generated project in the selected owner-safe area'
);
SELECT ok(
  NOT (current_setting('test.project_template_instance')::jsonb
    #> '{result}' ? 'heading_ids'),
  'instantiates a flat project hierarchy'
);
SELECT is(
  (
    SELECT count(*) FROM public.tasks_todos
    WHERE project_id = (
      current_setting('test.project_template_instance')::jsonb
        #>> '{result,root_id}'
    )::uuid
      AND template_instantiation_id = (
        current_setting('test.project_template_instance')::jsonb
          #>> '{instantiation,id}'
      )::uuid
  ),
  1::bigint,
  'assigns shared instance provenance to generated project work'
);
SELECT is(
  (
    SELECT count(DISTINCT template_node_id)
    FROM public.tasks_todos
    WHERE project_id = (
      current_setting('test.project_template_instance')::jsonb
        #>> '{result,root_id}'
    )::uuid
  ),
  1::bigint,
  'retains a stable template node on the generated task'
);

SELECT lives_ok(
  format(
    $$
      SELECT set_config(
        'test.archived_template',
        public.tasks_archive_template(
          %L::uuid,
          2,
          '95000000-0000-4000-8000-000000000040'
        )::text,
        false
      )
    $$,
    current_setting('test.todo_template_capture')::jsonb #>> '{template,id}'
  ),
  'archives a used template without deleting provenance'
);
SELECT ok(
  (
    current_setting('test.archived_template')::jsonb
      #>> '{template,archived_at}'
  ) IS NOT NULL,
  'records the archive time'
);
SELECT is(
  (
    SELECT count(*) FROM public.tasks_template_revisions
    WHERE template_id = (
      current_setting('test.todo_template_capture')::jsonb #>> '{template,id}'
    )::uuid
  ),
  2::bigint,
  'preserves every immutable revision after archive'
);
SELECT throws_ok(
  format(
    $$
      SELECT public.tasks_instantiate_template(
        %L::uuid, NULL, (now() AT TIME ZONE 'UTC')::date,
        '95000000-0000-4000-8000-000000000041'
      )
    $$,
    current_setting('test.todo_template_capture')::jsonb #>> '{template,id}'
  ),
  '22023', 'The template is unavailable',
  'excludes archived templates from new instantiation'
);

SELECT lives_ok(
  $$
    SELECT set_config(
      'test.template_export',
      public.tasks_create_export_v12()::text,
      false
    )
  $$,
  'creates a template-aware portable export'
);
SELECT is(
  (current_setting('test.template_export')::jsonb ->> 'schema_version')::integer,
  12,
  'uses the current portable format'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.template_export')::jsonb #> '{manifest,collections}'
  ),
  20,
  'declares every current portable collection'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.template_export')::jsonb #> '{data,tasks_templates}'
  ),
  2,
  'exports both template definitions'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.template_export')::jsonb
      #> '{data,tasks_template_revisions}'
  ),
  3,
  'exports the complete immutable revision history'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      current_setting('test.template_export')::jsonb #> '{data,tasks_todos}'
    ) AS task(value)
    WHERE task.value ->> 'template_instantiation_id' IS NOT NULL
      AND task.value ->> 'template_node_id' IS NOT NULL
  ),
  'exports generated-record provenance'
);
SELECT throws_ok(
  $$
    SELECT public.tasks_restore_export_current(
      jsonb_set(
        current_setting('test.template_export')::jsonb,
        '{manifest,checksums,tasks_templates}',
        to_jsonb(repeat('0', 64))
      ),
      true
    )
  $$,
  '22023',
  'Task export v12 collection tasks_templates is invalid',
  'rejects a template collection with a mismatched checksum'
);

SELECT set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000002', true);
SELECT is(
  (SELECT count(*) FROM public.tasks_templates),
  0::bigint,
  'RLS hides another owner template definitions'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_template_instantiations),
  0::bigint,
  'RLS hides another owner template instances'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
DELETE FROM auth.users
WHERE id = '95000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT is(
  (
    public.tasks_restore_export_current(
      current_setting('test.template_export')::jsonb,
      true
    ) #>> '{tasks_templates,inserts}'
  )::integer,
  2,
  'previews template definitions as owner-rebound inserts'
);
SELECT lives_ok(
  $$
    SELECT set_config(
      'test.template_restore',
      public.tasks_restore_export_current(
        current_setting('test.template_export')::jsonb,
        false
      )::text,
      false
    )
  $$,
  'restores the complete template graph for another owner'
);
SELECT is(
  (current_setting('test.template_restore')::jsonb ->> 'applied')::boolean,
  true,
  'reports an applied merge restore'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_templates),
  2::bigint,
  'rebinds restored template definitions to the authenticated owner'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_template_instantiations),
  2::bigint,
  'restores every instantiation receipt and generated hierarchy'
);

SELECT * FROM finish();
ROLLBACK;
