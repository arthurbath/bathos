BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(76);

SELECT has_table('public', 'tasks_recurrence_definitions', 'stores recurrence prototypes');
SELECT has_table('public', 'tasks_recurrence_revisions', 'stores immutable prototype revisions');
SELECT has_table('public', 'tasks_recurrence_occurrences', 'stores spawned-instance receipts');
SELECT has_column(
  'public', 'tasks_recurrence_definitions', 'next_occurrence_date',
  'stores the next virtual prototype date'
);
SELECT has_column(
  'public', 'tasks_todos', 'upcoming_order_key',
  'stores an Upcoming-only task rank'
);
SELECT has_column(
  'public', 'tasks_recurrence_definitions', 'upcoming_order_key',
  'stores an Upcoming-only recurrence prototype rank'
);
SELECT has_column(
  'public', 'tasks_recurrence_revisions', 'prototype_snapshot',
  'stores first-class prototype content'
);
SELECT hasnt_table('public', 'tasks_templates', 'removes Template definitions');
SELECT hasnt_table('public', 'tasks_template_revisions', 'removes Template revisions');
SELECT hasnt_table('public', 'tasks_template_instantiations', 'removes Template instances');
SELECT hasnt_column(
  'public', 'tasks_todos', 'template_instantiation_id',
  'removes Template provenance from ordinary tasks'
);
SELECT has_function(
  'public', 'tasks_create_recurrence_from_task',
  ARRAY[
    'uuid', 'text', 'text', 'text', 'integer', 'date', 'jsonb', 'text',
    'integer', 'date', 'time without time zone', 'integer', 'uuid', 'text', 'text'
  ],
  'creates a recurrence prototype from an ordinary task'
);
SELECT has_function(
  'public', 'tasks_edit_recurrence',
  ARRAY[
    'uuid', 'bigint', 'text', 'text', 'text', 'integer', 'date', 'text',
    'text', 'integer', 'uuid', 'jsonb', 'text', 'integer', 'date',
    'time without time zone', 'integer', 'jsonb', 'uuid', 'text', 'text'
  ],
  'edits recurrence schedule and prototype content explicitly'
);
SELECT has_function(
  'public', 'tasks_evaluate_recurrence',
  ARRAY['uuid', 'date', 'uuid', 'text', 'text'],
  'spawns due ordinary instances'
);
SELECT has_function(
  'public', 'tasks_reorder_recurrence_projection',
  ARRAY['uuid', 'bigint', 'text', 'uuid', 'text', 'text'],
  'reorders one owner-scoped recurrence projection'
);
SELECT has_function(
  'public', 'tasks_create_export_v14', ARRAY[]::text[],
  'exports the template-free task graph'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'recurrence@example.test', '', now(),
  '{}', '{}', now(), now()
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  'UTC',
  'a1000000-0000-4000-8000-000000000003'
);

INSERT INTO public.tasks_areas (
  id, owner_id, title, order_key, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000001',
  'Health', 'a0',
  'a1000000-0000-4000-8000-000000000005'
);

INSERT INTO public.tasks_todos (
  id, owner_id, area_id, title, notes, primary_link, actionability,
  destination, order_key, start_date, today_section, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000010',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000004',
  'Exercise', 'Prototype notes', 'https://example.test/exercise', 'actionable',
  'anytime', 'a0', NULL, 'inbox',
  'a1000000-0000-4000-8000-000000000011'
);

INSERT INTO public.tasks_checklist_items (
  id, owner_id, task_id, title, completed, completed_at, order_key,
  client_mutation_id
) VALUES
  (
    'a1000000-0000-4000-8000-000000000012',
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000010',
    'Warm up', true, '2026-07-31T12:00:00Z', 'a0',
    'a1000000-0000-4000-8000-000000000013'
  ),
  (
    'a1000000-0000-4000-8000-000000000014',
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000010',
    'Work out', false, NULL, 'a1',
    'a1000000-0000-4000-8000-000000000015'
  );

SELECT set_config(
  'test.calendar_recurrence',
  public.tasks_create_recurrence_from_task(
    'a1000000-0000-4000-8000-000000000010',
    'Exercise', 'calendar', 'daily', 1, current_date, '{}'::jsonb,
    'never', NULL, NULL, NULL, NULL,
    'a1000000-0000-4000-8000-000000000016'
  )::text,
  false
);

SELECT is(
  current_setting('test.calendar_recurrence')::jsonb ->> 'outcome',
  'accepted',
  'creates a calendar recurrence without creating a Template'
);
SELECT is(
  (
    current_setting('test.calendar_recurrence')::jsonb
      #>> '{occurrence,scheduled_date}'
  )::date,
  current_date,
  'adopts the source task as the reached ordinary instance'
);
SELECT is(
  (
    current_setting('test.calendar_recurrence')::jsonb
      #>> '{definition,next_occurrence_date}'
  )::date,
  current_date + 1,
  'places the virtual prototype on its next spawn date'
);
SELECT is(
  (
    SELECT upcoming_order_key FROM public.tasks_todos
    WHERE id = 'a1000000-0000-4000-8000-000000000010'
  ),
  'a0',
  'defaults an ordinary task Upcoming rank from its list rank'
);
SELECT is(
  (
    SELECT upcoming_order_key FROM public.tasks_recurrence_definitions
    WHERE id = (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  'a0',
  'defaults the recurrence prototype rank from its prototype snapshot'
);
SELECT is(
  (
    SELECT today_section
    FROM public.tasks_todos
    WHERE id = 'a1000000-0000-4000-8000-000000000010'
  ),
  'inbox',
  'places a reached adopted instance in Today Inbox'
);
SELECT is(
  current_setting('test.calendar_recurrence')::jsonb
    #>> '{revision,prototype_snapshot,root,title}',
  'Exercise',
  'stores the prototype Summary independently'
);
SELECT is(
  current_setting('test.calendar_recurrence')::jsonb
    #>> '{revision,prototype_snapshot,root,primary_link}',
  'https://example.test/exercise',
  'stores the prototype Primary Link independently'
);
SELECT is(
  (
    current_setting('test.calendar_recurrence')::jsonb
      #>> '{revision,prototype_snapshot,root,checklist,0,completed}'
  )::boolean,
  true,
  'stores checklist completion state on the prototype'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET title = 'Deferred Exercise Instance',
        notes = 'Instance-only notes',
        primary_link = 'https://example.test/instance',
        revision = revision + 1,
        client_mutation_id = 'a1000000-0000-4000-8000-000000000017'
    WHERE id = 'a1000000-0000-4000-8000-000000000010'
  $$,
  'allows the ordinary instance to diverge from prototype content'
);
SELECT is(
  (
    SELECT prototype_snapshot #>> '{root,title}'
    FROM public.tasks_recurrence_revisions
    WHERE recurrence_id = (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid AND revision = 1
  ),
  'Exercise',
  'instance edits never mutate the prototype snapshot'
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET start_date = current_date + 1,
        today_section = NULL,
        revision = revision + 1,
        client_mutation_id = 'a1000000-0000-4000-8000-000000000018'
    WHERE id = 'a1000000-0000-4000-8000-000000000010'
  $$,
  'allows a reached ordinary instance to be deferred into Upcoming'
);
SELECT is(
  (
    SELECT scheduled_date
    FROM public.tasks_recurrence_occurrences
    WHERE root_id = 'a1000000-0000-4000-8000-000000000010'
  ),
  current_date,
  'keeps the instance recurrence date immutable after deferral'
);
SELECT is(
  (
    SELECT start_date FROM public.tasks_todos
    WHERE id = 'a1000000-0000-4000-8000-000000000010'
  ),
  current_date + 1,
  'keeps the deferred instance accessible on its chosen Upcoming date'
);
SELECT is(
  (
    SELECT next_occurrence_date FROM public.tasks_recurrence_definitions
    WHERE id = (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  current_date + 1,
  'does not mistake deferred instance placement for prototype placement'
);

SELECT set_config(
  'test.edited_recurrence',
  public.tasks_edit_recurrence(
    (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid,
    2,
    'Exercise', 'calendar', 'daily', 1, current_date, 'UTC',
    'latest', 100, 'a1000000-0000-4000-8000-000000000004', '{}'::jsonb,
    'never', NULL, NULL, NULL, NULL,
    jsonb_set(
      current_setting('test.calendar_recurrence')::jsonb
        #> '{revision,prototype_snapshot}',
      '{root,title}',
      '"Prototype Exercise"'::jsonb
    ),
    'a1000000-0000-4000-8000-000000000019'
  )::text,
  false
);
SELECT is(
  current_setting('test.edited_recurrence')::jsonb ->> 'outcome',
  'accepted',
  'edits prototype content only through the recurrence workflow'
);
SELECT is(
  (
    current_setting('test.edited_recurrence')::jsonb
      #>> '{definition,current_revision}'
  )::integer,
  2,
  'creates an immutable recurrence revision for prototype edits'
);
SELECT is(
  current_setting('test.edited_recurrence')::jsonb
    #>> '{revision,prototype_snapshot,root,title}',
  'Prototype Exercise',
  'stores explicitly edited prototype content'
);

SELECT set_config(
  'test.reordered_recurrence',
  public.tasks_reorder_recurrence_projection(
    (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid,
    (
      current_setting('test.edited_recurrence')::jsonb
        #>> '{definition,record_revision}'
    )::bigint,
    'a9',
    'a1000000-0000-4000-8000-000000000090'
  )::text,
  false
);
SELECT is(
  current_setting('test.reordered_recurrence')::jsonb ->> 'outcome',
  'accepted',
  'accepts an owner-scoped recurrence projection reorder'
);
SELECT is(
  (
    SELECT upcoming_order_key FROM public.tasks_recurrence_definitions
    WHERE id = (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  'a9',
  'persists the recurrence prototype Upcoming rank'
);
SELECT is(
  public.tasks_reorder_recurrence_projection(
    (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid,
    (
      current_setting('test.edited_recurrence')::jsonb
        #>> '{definition,record_revision}'
    )::bigint,
    'b0',
    'a1000000-0000-4000-8000-000000000091'
  ) ->> 'outcome',
  'conflict',
  'rejects a recurrence projection reorder from a stale revision'
);

-- Simulate the point after the reached adopted instance has left the active
-- recurrence history, then place the virtual prototype on today's due date.
-- This exercises generation without asking the evaluator to time-travel.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
DELETE FROM public.tasks_checklist_items
WHERE task_id = 'a1000000-0000-4000-8000-000000000010';
DELETE FROM public.tasks_todos
WHERE id = 'a1000000-0000-4000-8000-000000000010';
DELETE FROM public.tasks_recurrence_occurrences
WHERE recurrence_id = (
  current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
)::uuid;
UPDATE public.tasks_recurrence_definitions
SET next_occurrence_date = current_date,
    evaluated_through_date = current_date - 1,
    record_revision = record_revision + 1,
    client_mutation_id = gen_random_uuid()
WHERE id = (
  current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
)::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true
);

SELECT set_config(
  'test.calendar_evaluation',
  public.tasks_evaluate_recurrence(
    (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid,
    current_date,
    'a1000000-0000-4000-8000-000000000020'
  )::text,
  false
);
SELECT is(
  (
    current_setting('test.calendar_evaluation')::jsonb ->> 'generated_count'
  )::integer,
  1,
  'spawns exactly one ordinary task when the prototype date arrives'
);
SELECT is(
  (
    SELECT count(*) FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  1::bigint,
  'stores only the generated instance receipt without a projection row'
);
SELECT is(
  (
    SELECT task.title
    FROM public.tasks_todos AS task
    JOIN public.tasks_recurrence_occurrences AS occurrence
      ON occurrence.root_id = task.id AND occurrence.owner_id = task.owner_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid AND occurrence.scheduled_date = current_date
  ),
  'Prototype Exercise',
  'spawns from the prototype rather than from the edited prior instance'
);
SELECT is(
  (
    SELECT task.primary_link
    FROM public.tasks_todos AS task
    JOIN public.tasks_recurrence_occurrences AS occurrence
      ON occurrence.root_id = task.id AND occurrence.owner_id = task.owner_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid AND occurrence.scheduled_date = current_date
  ),
  'https://example.test/exercise',
  'spawns the prototype Primary Link rather than the prior instance edit'
);
SELECT results_eq(
  $$
    SELECT item.title, item.completed
    FROM public.tasks_checklist_items AS item
    JOIN public.tasks_recurrence_occurrences AS occurrence
      ON occurrence.root_id = item.task_id AND occurrence.owner_id = item.owner_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid AND occurrence.scheduled_date = current_date
    ORDER BY item.order_key
  $$,
  $$VALUES ('Warm up'::text, true), ('Work out'::text, false)$$,
  'spawns prototype checklist text, order, and completion state'
);
SELECT is(
  (
    SELECT task.lifecycle || ':' || task.disposition
    FROM public.tasks_todos AS task
    JOIN public.tasks_recurrence_occurrences AS occurrence
      ON occurrence.root_id = task.id AND occurrence.owner_id = task.owner_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid AND occurrence.scheduled_date = current_date
  ),
  'open:present',
  'spawns a normal open task instance'
);
SELECT is(
  (
    SELECT task.upcoming_order_key
    FROM public.tasks_todos AS task
    JOIN public.tasks_recurrence_occurrences AS occurrence
      ON occurrence.root_id = task.id AND occurrence.owner_id = task.owner_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid AND occurrence.scheduled_date = current_date
  ),
  'a9',
  'spawns an occurrence from the prototype Upcoming rank'
);
SELECT is(
  (
    SELECT next_occurrence_date FROM public.tasks_recurrence_definitions
    WHERE id = (
      current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  current_date + 1,
  'moves the virtual prototype to the following cadence date'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, notes, destination, order_key, start_date,
  client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000021',
  'a1000000-0000-4000-8000-000000000001',
  'Future Family Event', 'Future prototype notes', 'anytime', 'a2',
  current_date + 2,
  'a1000000-0000-4000-8000-000000000022'
);
INSERT INTO public.tasks_checklist_items (
  id, owner_id, task_id, title, completed, order_key, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000023',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000021',
  'Bring a card', false, 'a0',
  'a1000000-0000-4000-8000-000000000024'
);
SELECT set_config(
  'test.future_recurrence',
  public.tasks_create_recurrence_from_task(
    'a1000000-0000-4000-8000-000000000021',
    'Future Family Event', 'calendar', 'monthly', 1, current_date + 2,
    jsonb_build_object('monthly_kind', 'day_of_month', 'month_day',
      extract(day FROM current_date + 2)::integer),
    'never', NULL, NULL, NULL, NULL,
    'a1000000-0000-4000-8000-000000000025'
  )::text,
  false
);
SELECT is(
  current_setting('test.future_recurrence')::jsonb ->> 'outcome',
  'accepted',
  'creates an unreached recurrence as a virtual prototype'
);
SELECT is(
  current_setting('test.future_recurrence')::jsonb -> 'occurrence',
  'null'::jsonb,
  'does not adopt an ordinary occurrence before the first spawn date'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_todos
   WHERE id = 'a1000000-0000-4000-8000-000000000021'),
  0::bigint,
  'removes the ordinary source task after preserving the future prototype'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_recurrence_occurrences
   WHERE recurrence_id = (
     current_setting('test.future_recurrence')::jsonb #>> '{definition,id}'
   )::uuid),
  0::bigint,
  'stores no occurrence receipt before the future spawn date'
);
SELECT is(
  (current_setting('test.future_recurrence')::jsonb
    #>> '{definition,next_occurrence_date}')::date,
  current_date + 2,
  'keeps the virtual prototype on its first future spawn date'
);
SELECT is(
  current_setting('test.future_recurrence')::jsonb
    #>> '{revision,prototype_snapshot,root,checklist,0,title}',
  'Bring a card',
  'preserves future source checklist content in the prototype snapshot'
);
SELECT throws_ok(
  format(
    'SELECT public.tasks_evaluate_recurrence(%L::uuid, current_date + 1, %L::uuid)',
    current_setting('test.future_recurrence')::jsonb #>> '{definition,id}',
    'a1000000-0000-4000-8000-000000000026'
  ),
  '22023',
  'Recurrence cannot be evaluated beyond the planning date',
  'rejects recurrence evaluation beyond the owner planning date'
);

-- A cadence date can be a Deadline whose projected Start occurs earlier. The
-- owner-local activation job must generate that work on the Start date even
-- when no client is open, then advance the prototype by cadence.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
INSERT INTO public.tasks_recurrence_definitions (
  id, owner_id, name, status, current_revision, record_revision,
  evaluated_through_date, next_occurrence_date, upcoming_order_key,
  last_mutation_channel, last_actor_type, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000060',
  'a1000000-0000-4000-8000-000000000001',
  'Manage debt, budgets', 'active', 1, 1,
  current_date - 1, current_date + 4, 'a6',
  'native', 'system', 'a1000000-0000-4000-8000-000000000061'
);
INSERT INTO public.tasks_recurrence_revisions (
  id, owner_id, recurrence_id, revision, name, rule_mode, frequency,
  interval_count, start_date, planning_timezone, missed_policy,
  catch_up_limit, target_area_id, client_mutation_id, rule_config,
  end_mode, end_after_count, end_on_date, reminder_local_time,
  deadline_offset_days, prototype_snapshot
)
SELECT
  'a1000000-0000-4000-8000-000000000062', revision.owner_id,
  'a1000000-0000-4000-8000-000000000060', 1,
  'Manage debt, budgets', 'calendar', 'monthly', 1,
  current_date + 4, revision.planning_timezone, 'all', 100,
  revision.target_area_id,
  'a1000000-0000-4000-8000-000000000063',
  jsonb_build_object(
    'monthly_kind', 'day_of_month',
    'month_day', extract(day FROM current_date + 4)::integer
  ),
  'never', NULL, NULL, '08:00'::time, 4,
  jsonb_set(
    jsonb_set(
      jsonb_set(
        revision.prototype_snapshot,
        '{root,title}',
        '"Manage debt, budgets"'::jsonb
      ),
      '{root,start_offset_days}',
      '-1'::jsonb
    ),
    '{root,deadline_offset_days}',
    '0'::jsonb
  )
FROM public.tasks_recurrence_revisions AS revision
WHERE revision.recurrence_id = (
  current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
)::uuid
  AND revision.revision = 2;

-- A second fixture mirrors historical recurrence snapshots that omitted the
-- Start offset entirely even though the accepted revision retained the rule.
INSERT INTO public.tasks_recurrence_definitions (
  id, owner_id, name, status, current_revision, record_revision,
  evaluated_through_date, next_occurrence_date, upcoming_order_key,
  last_mutation_channel, last_actor_type, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000070',
  'a1000000-0000-4000-8000-000000000001',
  'Diary', 'active', 1, 1,
  current_date - 1, current_date + 4, 'a7',
  'native', 'system', 'a1000000-0000-4000-8000-000000000071'
);
INSERT INTO public.tasks_recurrence_revisions (
  id, owner_id, recurrence_id, revision, name, rule_mode, frequency,
  interval_count, start_date, planning_timezone, missed_policy,
  catch_up_limit, target_area_id, client_mutation_id, rule_config,
  end_mode, end_after_count, end_on_date, reminder_local_time,
  deadline_offset_days, prototype_snapshot
)
SELECT
  'a1000000-0000-4000-8000-000000000072', revision.owner_id,
  'a1000000-0000-4000-8000-000000000070', 1,
  'Diary', 'calendar', 'monthly', 1,
  current_date + 4, revision.planning_timezone, 'all', 100,
  revision.target_area_id,
  'a1000000-0000-4000-8000-000000000073',
  jsonb_build_object(
    'monthly_kind', 'day_of_month',
    'month_day', extract(day FROM current_date + 4)::integer
  ),
  'never', NULL, NULL, NULL, 4,
  jsonb_set(
    jsonb_set(
      jsonb_set(
        revision.prototype_snapshot,
        '{root,title}',
        '"Diary"'::jsonb
      ),
      '{root,start_offset_days}',
      'null'::jsonb
    ),
    '{root,deadline_offset_days}',
    '0'::jsonb
  )
FROM public.tasks_recurrence_revisions AS revision
WHERE revision.recurrence_id = (
  current_setting('test.calendar_recurrence')::jsonb #>> '{definition,id}'
)::uuid
  AND revision.revision = 2;

SELECT is(
  tasks_private.recurrence_spawn_date(
    current_date + 4,
    4
  ),
  current_date,
  'computes the projected Start as the recurrence spawn date'
);

SELECT set_config(
  'test.early_start_activation',
  tasks_private.activate_due_roots(clock_timestamp(),
    'a1000000-0000-4000-8000-000000000001')::text,
  false
);
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true
);
SELECT is(
  (current_setting('test.early_start_activation')::jsonb
    ->> 'generated_recurrence_instances')::integer,
  2,
  'background activation generates both reached recurrence instances'
);
SELECT is(
  (
    SELECT occurrence.scheduled_date
    FROM public.tasks_recurrence_occurrences AS occurrence
    WHERE occurrence.recurrence_id =
      'a1000000-0000-4000-8000-000000000060'
  ),
  current_date + 4,
  'keeps the cadence date on the generated occurrence receipt'
);
SELECT is(
  (
    SELECT task.start_date
    FROM public.tasks_todos AS task
    JOIN public.tasks_recurrence_occurrences AS occurrence
      ON occurrence.root_id = task.id
     AND occurrence.owner_id = task.owner_id
    WHERE occurrence.recurrence_id =
      'a1000000-0000-4000-8000-000000000060'
  ),
  current_date,
  'ignores a stale snapshot offset when persisting the generated Start'
);
SELECT is(
  (
    SELECT task.deadline
    FROM public.tasks_todos AS task
    JOIN public.tasks_recurrence_occurrences AS occurrence
      ON occurrence.root_id = task.id
     AND occurrence.owner_id = task.owner_id
    WHERE occurrence.recurrence_id =
      'a1000000-0000-4000-8000-000000000060'
  ),
  current_date + 4,
  'preserves the cadence date as the generated task Deadline'
);
SELECT is(
  (
    SELECT task.start_date
    FROM public.tasks_todos AS task
    JOIN public.tasks_recurrence_occurrences AS occurrence
      ON occurrence.root_id = task.id
     AND occurrence.owner_id = task.owner_id
    WHERE occurrence.recurrence_id =
      'a1000000-0000-4000-8000-000000000070'
  ),
  current_date,
  'derives the generated Start when the snapshot offset is missing'
);
SELECT is(
  (
    SELECT task.deadline
    FROM public.tasks_todos AS task
    JOIN public.tasks_recurrence_occurrences AS occurrence
      ON occurrence.root_id = task.id
     AND occurrence.owner_id = task.owner_id
    WHERE occurrence.recurrence_id =
      'a1000000-0000-4000-8000-000000000070'
  ),
  current_date + 4,
  'preserves the generated Deadline when the snapshot Start is missing'
);
SELECT is(
  (
    SELECT task.today_section
    FROM public.tasks_todos AS task
    JOIN public.tasks_recurrence_occurrences AS occurrence
      ON occurrence.root_id = task.id
     AND occurrence.owner_id = task.owner_id
    WHERE occurrence.recurrence_id =
      'a1000000-0000-4000-8000-000000000060'
  ),
  'inbox',
  'places the generated task in Today Inbox'
);
SELECT is(
  (
    SELECT reminder.local_time::text
    FROM public.tasks_reminders AS reminder
    JOIN public.tasks_recurrence_occurrences AS occurrence
      ON occurrence.root_id = reminder.task_id
     AND occurrence.owner_id = reminder.owner_id
    WHERE occurrence.recurrence_id =
      'a1000000-0000-4000-8000-000000000060'
      AND reminder.status = 'active'
  ),
  '08:00:00',
  'background activation inherits the prototype reminder'
);
SELECT ok(
  (
    SELECT definition.next_occurrence_date
    FROM public.tasks_recurrence_definitions AS definition
    WHERE definition.id = 'a1000000-0000-4000-8000-000000000060'
  ) > current_date + 4,
  'advances the prototype to its next monthly cadence date'
);

RESET ROLE;
SELECT set_config(
  'test.early_start_retry',
  tasks_private.activate_due_roots(clock_timestamp(),
    'a1000000-0000-4000-8000-000000000001')::text,
  false
);
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true
);
SELECT is(
  (current_setting('test.early_start_retry')::jsonb
    ->> 'generated_recurrence_instances')::integer,
  0,
  'repeated background activation creates no duplicate instance'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_recurrence_occurrences AS occurrence
    WHERE occurrence.recurrence_id =
      'a1000000-0000-4000-8000-000000000060'
  ),
  1::bigint,
  'stores exactly one occurrence for the reached cadence event'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_recurrence_definitions AS definition
    JOIN public.tasks_recurrence_revisions AS revision
      ON revision.owner_id = definition.owner_id
     AND revision.recurrence_id = definition.id
     AND revision.revision = definition.current_revision
    WHERE definition.id = 'a1000000-0000-4000-8000-000000000060'
      AND definition.next_occurrence_date
        - COALESCE(revision.deadline_offset_days, 0) <= current_date
  ),
  0::bigint,
  'leaves no reached prototype in Upcoming after activation'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES (
  'a1000000-0000-4000-8000-000000000030',
  'a1000000-0000-4000-8000-000000000001',
  'Water Plants', 'anytime', 'a1',
  'a1000000-0000-4000-8000-000000000031'
);
SELECT set_config(
  'test.completion_recurrence',
  public.tasks_create_recurrence_from_task(
    'a1000000-0000-4000-8000-000000000030',
    'Water Plants', 'after_completion', 'daily', 2, current_date, '{}'::jsonb,
    'never', NULL, NULL, NULL, NULL,
    'a1000000-0000-4000-8000-000000000032'
  )::text,
  false
);
SELECT is(
  current_setting('test.completion_recurrence')::jsonb ->> 'outcome',
  'accepted',
  'creates an after-completion recurrence prototype'
);
SELECT is(
  (
    SELECT next_occurrence_date FROM public.tasks_recurrence_definitions
    WHERE id = (
      current_setting('test.completion_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  NULL::date,
  'keeps the prototype waiting while its instance remains open'
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET lifecycle = 'completed',
        completed_at = clock_timestamp(),
        revision = revision + 1,
        client_mutation_id = 'a1000000-0000-4000-8000-000000000033'
    WHERE id = 'a1000000-0000-4000-8000-000000000030'
  $$,
  'completion schedules the next prototype spawn date'
);
SELECT is(
  (
    SELECT next_occurrence_date FROM public.tasks_recurrence_definitions
    WHERE id = (
      current_setting('test.completion_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  current_date + 2,
  'after-completion cadence starts from the completion date'
);
SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET lifecycle = 'open',
        completed_at = NULL,
        revision = revision + 1,
        client_mutation_id = 'a1000000-0000-4000-8000-000000000034'
    WHERE id = 'a1000000-0000-4000-8000-000000000030'
  $$,
  'restoration before successor spawn returns the prototype to waiting'
);
SELECT is(
  (
    SELECT next_occurrence_date FROM public.tasks_recurrence_definitions
    WHERE id = (
      current_setting('test.completion_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  NULL::date,
  'clears the next spawn date when the watched instance is restored'
);

SELECT set_config(
  'test.export_v14', public.tasks_create_export_v14()::text, false
);
SELECT is(
  (current_setting('test.export_v14')::jsonb ->> 'schema_version')::integer,
  14,
  'exports schema version fourteen'
);
SELECT is(
  jsonb_array_length(
    current_setting('test.export_v14')::jsonb #> '{manifest,collections}'
  ),
  16,
  'exports the sixteen template-free task collections'
);
SELECT ok(
  NOT (current_setting('test.export_v14')::jsonb -> 'data' ? 'tasks_templates')
    AND NOT (
      current_setting('test.export_v14')::jsonb
        -> 'data' ? 'tasks_template_revisions'
    )
    AND NOT (
      current_setting('test.export_v14')::jsonb
        -> 'data' ? 'tasks_template_instantiations'
    ),
  'omits every Template collection from current backups'
);

SELECT set_config(
  'test.recurrence_refresh_digest',
  (
    SELECT md5(jsonb_agg(to_jsonb(revision) ORDER BY revision.id)::text)
    FROM public.tasks_recurrence_revisions AS revision
  ),
  false
);
RESET ROLE;
SELECT lives_ok(
  $$
    INSERT INTO tasks_private.recurrence_contexts (
      backend_pid, transaction_id, owner_id
    )
    SELECT pg_backend_pid(), txid_current(), owner_id
    FROM public.tasks_recurrence_revisions
    GROUP BY owner_id
    ON CONFLICT DO NOTHING;

    UPDATE public.tasks_recurrence_revisions
    SET prototype_snapshot = prototype_snapshot;

    DELETE FROM tasks_private.recurrence_contexts
    WHERE backend_pid = pg_backend_pid()
      AND transaction_id = txid_current();
  $$,
  're-emits recurrence snapshots inside the private migration context'
);
SET LOCAL ROLE authenticated;
SELECT is(
  (
    SELECT md5(jsonb_agg(to_jsonb(revision) ORDER BY revision.id)::text)
    FROM public.tasks_recurrence_revisions AS revision
  ),
  current_setting('test.recurrence_refresh_digest'),
  'preserves every recurrence revision value while re-emitting snapshots'
);

SELECT * FROM finish();
ROLLBACK;
