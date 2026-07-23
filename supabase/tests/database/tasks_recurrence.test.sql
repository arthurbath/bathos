BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(51);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '96000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'recurrence-a@example.test', '', now(),
    '{}', '{}', now(), now()
  ),
  (
    '96000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'recurrence-b@example.test', '', now(),
    '{}', '{}', now(), now()
  );

SELECT has_table(
  'public', 'tasks_recurrence_definitions',
  'stores owner-scoped recurrence definitions'
);
SELECT has_table(
  'public', 'tasks_recurrence_revisions',
  'stores immutable recurrence revisions'
);
SELECT has_table(
  'public', 'tasks_recurrence_occurrences',
  'stores generated logical occurrences'
);
SELECT has_table(
  'public', 'tasks_recurrence_evaluations',
  'stores idempotent evaluation receipts'
);
SELECT has_table(
  'public', 'tasks_recurrence_status_events',
  'stores immutable recurrence status receipts'
);
SELECT has_column(
  'public', 'tasks_todos', 'recurrence_occurrence_id',
  'stores to-do recurrence provenance'
);
SELECT has_column(
  'public', 'tasks_projects', 'recurrence_logical_key',
  'stores project recurrence provenance'
);
SELECT has_function(
  'public', 'tasks_save_recurrence',
  ARRAY[
    'uuid', 'bigint', 'text', 'uuid', 'bigint', 'text', 'text', 'integer',
    'date', 'text', 'text', 'integer', 'uuid', 'uuid', 'text', 'text'
  ],
  'creates and revises recurrence through one guarded function'
);
SELECT has_function(
  'public', 'tasks_evaluate_recurrence',
  ARRAY['uuid', 'date', 'uuid', 'text', 'text'],
  'evaluates recurrence authoritatively'
);
SELECT has_function(
  'public', 'tasks_set_recurrence_status',
  ARRAY['uuid', 'bigint', 'text', 'uuid', 'text', 'text'],
  'changes recurrence status explicitly'
);
SELECT has_function(
  'public', 'tasks_create_export_v12', ARRAY[]::text[],
  'exports recurrence definitions and provenance'
);
SELECT has_function(
  'public', 'tasks_restore_export_current', ARRAY['jsonb', 'boolean'],
  'restores recurrence definitions and provenance'
);
SELECT has_index(
  'public', 'tasks_recurrence_occurrences',
  'tasks_recurrence_occurrences_logical_event_key',
  'enforces one row for each deterministic logical event'
);
SELECT is(
  tasks_private.add_recurrence_interval('2024-02-29', 'yearly', 1, 1),
  '2025-02-28'::date,
  'yearly recurrence clamps leap-day schedules safely'
);
SELECT is(
  tasks_private.first_recurrence_step_after(
    '2024-01-31', 'monthly', 1, '2024-02-29'
  ),
  2,
  'recurrence cursor advances past a clamped month-end occurrence'
);
SELECT is(
  tasks_private.first_recurrence_step_after(
    '1900-01-01', 'daily', 1, '2026-07-21'
  ),
  ('2026-07-21'::date - '1900-01-01'::date) + 1,
  'recurrence cursor derives a distant daily step without interval scanning'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '96000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  '96000000-0000-4000-8000-000000000010',
  '96000000-0000-4000-8000-000000000001',
  'UTC',
  '96000000-0000-4000-8000-000000000011'
);
INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES (
  '96000000-0000-4000-8000-000000000012',
  '96000000-0000-4000-8000-000000000001',
  'Recurring source', 'anytime', 'a0',
  '96000000-0000-4000-8000-000000000013'
);
SELECT set_config(
  'test.recurrence_template',
  public.tasks_capture_template(
    NULL,
    'todo',
    '96000000-0000-4000-8000-000000000012',
    'Recurring source',
    '2026-01-01',
    '96000000-0000-4000-8000-000000000014'
  )::text,
  false
);

SELECT lives_ok(
  $$
    SELECT set_config(
      'test.latest_recurrence',
      public.tasks_save_recurrence(
        NULL, NULL, 'Daily latest',
        (current_setting('test.recurrence_template')::jsonb #>> '{template,id}')::uuid,
        1, 'calendar', 'daily', 1, '2026-01-01', 'UTC', 'latest', 50,
        NULL, '96000000-0000-4000-8000-000000000015'
      )::text,
      false
    )
  $$,
  'creates a calendar recurrence definition'
);
SELECT is(
  current_setting('test.latest_recurrence')::jsonb #>> '{revision,rule_mode}',
  'calendar',
  'stores calendar mode explicitly'
);
SELECT lives_ok(
  $$
    SELECT set_config(
      'test.latest_evaluation',
      public.tasks_evaluate_recurrence(
        (current_setting('test.latest_recurrence')::jsonb #>> '{definition,id}')::uuid,
        '2026-01-04', '96000000-0000-4000-8000-000000000016'
      )::text,
      false
    )
  $$,
  'evaluates missed calendar events transactionally'
);
SELECT is(
  (
    current_setting('test.latest_evaluation')::jsonb
      ->> 'generated_count'
  )::integer,
  1,
  'latest policy creates only the newest missed event'
);
SELECT is(
  (
    SELECT scheduled_date
    FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.latest_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  '2026-01-04'::date,
  'latest policy anchors generated work to the selected logical date'
);
SELECT is(
  (
    SELECT recurrence_logical_key
    FROM public.tasks_todos
    WHERE recurrence_definition_id = (
      current_setting('test.latest_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  'calendar:2026-01-04',
  'generated root stores deterministic recurrence provenance'
);
SELECT is(
  (
    public.tasks_evaluate_recurrence(
      (current_setting('test.latest_recurrence')::jsonb #>> '{definition,id}')::uuid,
      '2026-01-04', '96000000-0000-4000-8000-000000000016'
    ) ->> 'outcome'
  ),
  'already_applied',
  'returns the stored evaluation result for an exact retry'
);
SELECT is(
  (
    SELECT count(*) FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.latest_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  1::bigint,
  'does not duplicate an occurrence on retry'
);

SELECT set_config(
  'test.all_recurrence',
  public.tasks_save_recurrence(
    NULL, NULL, 'Weekly all',
    (current_setting('test.recurrence_template')::jsonb #>> '{template,id}')::uuid,
    1, 'calendar', 'weekly', 1, '2026-01-01', 'UTC', 'all', 10,
    NULL, '96000000-0000-4000-8000-000000000017'
  )::text,
  false
);
SELECT is(
  (
    public.tasks_evaluate_recurrence(
      (current_setting('test.all_recurrence')::jsonb #>> '{definition,id}')::uuid,
      '2026-01-22', '96000000-0000-4000-8000-000000000018'
    ) ->> 'generated_count'
  )::integer,
  4,
  'all policy creates every missed weekly event within the safety limit'
);
SELECT lives_ok(
  $$
    SELECT set_config(
      'test.unsafe_recurrence',
      public.tasks_save_recurrence(
        NULL, NULL, 'Unsafe all',
        (current_setting('test.recurrence_template')::jsonb #>> '{template,id}')::uuid,
        1, 'calendar', 'daily', 1, '2026-01-01', 'UTC', 'all', 2,
        NULL, '96000000-0000-4000-8000-000000000020'
      )::text,
      false
    )
  $$,
  'accepts a bounded all-policy definition'
);
SELECT throws_ok(
  format(
    $$
      SELECT public.tasks_evaluate_recurrence(
        %L::uuid, '2026-01-04', '96000000-0000-4000-8000-000000000021'
      )
    $$,
    current_setting('test.unsafe_recurrence')::jsonb #>> '{definition,id}'
  ),
  '54000',
  'Recurrence catch-up exceeds its safety limit',
  'rejects unbounded all-policy catch-up before creating partial work'
);

SELECT set_config(
  'test.skip_recurrence',
  public.tasks_save_recurrence(
    NULL, NULL, 'Daily skip',
    (current_setting('test.recurrence_template')::jsonb #>> '{template,id}')::uuid,
    1, 'calendar', 'daily', 1, '2026-01-01', 'UTC', 'skip', 50,
    NULL, '96000000-0000-4000-8000-000000000022'
  )::text,
  false
);
SELECT is(
  (
    public.tasks_evaluate_recurrence(
      (current_setting('test.skip_recurrence')::jsonb #>> '{definition,id}')::uuid,
      '2026-01-03', '96000000-0000-4000-8000-000000000023'
    ) ->> 'generated_count'
  )::integer,
  1,
  'skip policy still creates an event due exactly on the evaluation date'
);
SELECT set_config(
  'test.paused_recurrence',
  public.tasks_set_recurrence_status(
    (current_setting('test.skip_recurrence')::jsonb #>> '{definition,id}')::uuid,
    2, 'paused', '96000000-0000-4000-8000-000000000024'
  )::text,
  false
);
SELECT is(
  (
    public.tasks_evaluate_recurrence(
      (current_setting('test.skip_recurrence')::jsonb #>> '{definition,id}')::uuid,
      '2026-01-04', '96000000-0000-4000-8000-000000000025'
    ) ->> 'generated_count'
  )::integer,
  0,
  'paused recurrence generates no future work'
);
SELECT is(
  (
    public.tasks_set_recurrence_status(
      (current_setting('test.skip_recurrence')::jsonb #>> '{definition,id}')::uuid,
      3, 'active', '96000000-0000-4000-8000-000000000026'
    ) #>> '{definition,status}'
  ),
  'active',
  'resumes a paused recurrence explicitly'
);
SELECT is(
  (
    public.tasks_evaluate_recurrence(
      (current_setting('test.skip_recurrence')::jsonb #>> '{definition,id}')::uuid,
      '2026-01-04', '96000000-0000-4000-8000-000000000035'
    ) ->> 'generated_count'
  )::integer,
  1,
  'resumed recurrence catches up from its preserved evaluation cursor'
);
SELECT is(
  (
    public.tasks_set_recurrence_status(
      (current_setting('test.skip_recurrence')::jsonb #>> '{definition,id}')::uuid,
      3, 'active', '96000000-0000-4000-8000-000000000026'
    ) ->> 'outcome'
  ),
  'already_applied',
  'status retry remains provable after a later evaluation'
);

SELECT set_config(
  'test.revised_recurrence',
  public.tasks_save_recurrence(
    (current_setting('test.latest_recurrence')::jsonb #>> '{definition,id}')::uuid,
    2, 'Monthly latest',
    (current_setting('test.recurrence_template')::jsonb #>> '{template,id}')::uuid,
    1, 'calendar', 'monthly', 1, '2026-01-31', 'UTC', 'latest', 50,
    NULL, '96000000-0000-4000-8000-000000000027'
  )::text,
  false
);
SELECT is(
  (
    current_setting('test.revised_recurrence')::jsonb
      #>> '{definition,current_revision}'
  )::integer,
  2,
  'editing recurrence creates a new immutable revision'
);
SELECT is(
  (
    SELECT frequency FROM public.tasks_recurrence_revisions
    WHERE recurrence_id = (
      current_setting('test.revised_recurrence')::jsonb #>> '{definition,id}'
    )::uuid AND revision = 1
  ),
  'daily',
  'editing recurrence leaves its prior revision unchanged'
);
SELECT is(
  (
    public.tasks_evaluate_recurrence(
      (current_setting('test.revised_recurrence')::jsonb #>> '{definition,id}')::uuid,
      '2026-03-31', '96000000-0000-4000-8000-000000000028'
    ) ->> 'generated_count'
  )::integer,
  1,
  'revised rule generates only future ungenerated work'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.revised_recurrence')::jsonb #>> '{definition,id}'
    )::uuid AND recurrence_revision = 2 AND scheduled_date = '2026-03-31'
  ),
  'monthly arithmetic preserves the original month day after February'
);

SELECT set_config(
  'test.after_recurrence',
  public.tasks_save_recurrence(
    NULL, NULL, 'After completion',
    (current_setting('test.recurrence_template')::jsonb #>> '{template,id}')::uuid,
    1, 'after_completion', 'daily', 1, '2026-01-01', 'UTC', 'latest', 50,
    NULL, '96000000-0000-4000-8000-000000000029'
  )::text,
  false
);
SELECT set_config(
  'test.after_evaluation',
  public.tasks_evaluate_recurrence(
    (current_setting('test.after_recurrence')::jsonb #>> '{definition,id}')::uuid,
    '2026-01-01', '96000000-0000-4000-8000-000000000030'
  )::text,
  false
);
UPDATE public.tasks_todos
SET lifecycle = 'completed', completed_at = '2026-01-03 12:00:00+00',
    revision = revision + 1,
    client_mutation_id = '96000000-0000-4000-8000-000000000031'
WHERE id = (
  SELECT root_id FROM public.tasks_recurrence_occurrences
  WHERE recurrence_id = (
    current_setting('test.after_recurrence')::jsonb #>> '{definition,id}'
  )::uuid AND predecessor_occurrence_id IS NULL
);
SELECT is(
  (
    SELECT count(*) FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.after_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  2::bigint,
  'authoritative completion creates exactly one next occurrence'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.after_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
      AND logical_key LIKE 'after:%'
      AND scheduled_date = '2026-01-04'
  ),
  'after-completion occurrence derives its date from the completion date'
);
UPDATE public.tasks_todos
SET lifecycle = 'canceled', canceled_at = '2026-01-05 12:00:00+00',
    revision = revision + 1,
    client_mutation_id = '96000000-0000-4000-8000-000000000032'
WHERE id = (
  SELECT root_id FROM public.tasks_recurrence_occurrences
  WHERE recurrence_id = (
    current_setting('test.after_recurrence')::jsonb #>> '{definition,id}'
  )::uuid AND predecessor_occurrence_id IS NOT NULL
);
SELECT is(
  (
    SELECT count(*) FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.after_recurrence')::jsonb #>> '{definition,id}'
    )::uuid
  ),
  2::bigint,
  'cancellation does not advance after-completion recurrence'
);

SELECT throws_ok(
  format(
    $$
      UPDATE public.tasks_todos
      SET recurrence_definition_id = %L::uuid,
          recurrence_revision = 1,
          recurrence_occurrence_id = %L::uuid,
          recurrence_logical_key = 'spoofed',
          revision = revision + 1,
          client_mutation_id = '96000000-0000-4000-8000-000000000033'
      WHERE id = '96000000-0000-4000-8000-000000000012'
    $$,
    current_setting('test.after_recurrence')::jsonb #>> '{definition,id}',
    current_setting('test.after_evaluation')::jsonb #>> '{occurrence_ids,0}'
  ),
  '42501',
  'Recurrence provenance can be assigned only by generation or restore',
  'rejects client-spoofed recurrence provenance'
);
SELECT throws_ok(
  format(
    $$
      SELECT public.tasks_archive_template(
        %L::uuid, 1, '96000000-0000-4000-8000-000000000034'
      )
    $$,
    current_setting('test.recurrence_template')::jsonb #>> '{template,id}'
  ),
  '23514',
  'Archive linked recurrence definitions before archiving this template',
  'protects the immutable template snapshot used by live recurrence'
);

SELECT lives_ok(
  $$
    SELECT set_config(
      'test.recurrence_export',
      public.tasks_create_export_v12()::text,
      false
    )
  $$,
  'creates a recurrence-aware portable export'
);
SELECT is(
  (
    current_setting('test.recurrence_export')::jsonb
      ->> 'schema_version'
  )::integer,
  12,
  'uses the current task export schema'
);
SELECT ok(
  jsonb_array_length(
    current_setting('test.recurrence_export')::jsonb
      #> '{data,tasks_recurrence_occurrences}'
  ) > 0,
  'exports generated recurrence occurrences'
);
SELECT throws_ok(
  $$
    SELECT public.tasks_restore_export_current(
      jsonb_set(
        current_setting('test.recurrence_export')::jsonb,
        '{manifest,checksums,tasks_recurrence_definitions}',
        to_jsonb(repeat('0', 64))
      ),
      true
    )
  $$,
  '22023',
  'Task export v12 collection tasks_recurrence_definitions is invalid',
  'rejects a recurrence collection with a mismatched checksum'
);

SELECT set_config(
  'request.jwt.claim.sub', '96000000-0000-4000-8000-000000000002', true
);
SELECT is(
  (SELECT count(*) FROM public.tasks_recurrence_definitions),
  0::bigint,
  'RLS hides another owner recurrence definitions'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_recurrence_occurrences),
  0::bigint,
  'RLS hides another owner recurrence occurrences'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
DELETE FROM auth.users
WHERE id = '96000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '96000000-0000-4000-8000-000000000002', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT ok(
  (
    public.tasks_restore_export_current(
      current_setting('test.recurrence_export')::jsonb, true
    ) #>> '{tasks_recurrence_definitions,inserts}'
  )::integer > 0,
  'previews recurrence definitions as owner-rebound inserts'
);
SELECT lives_ok(
  $$
    SELECT set_config(
      'test.recurrence_restore',
      public.tasks_restore_export_current(
        current_setting('test.recurrence_export')::jsonb, false
      )::text,
      false
    )
  $$,
  'restores the complete recurrence graph for another owner'
);
SELECT is(
  (
    current_setting('test.recurrence_restore')::jsonb
      ->> 'applied'
  )::boolean,
  true,
  'reports an applied recurrence merge restore'
);
SELECT ok(
  (SELECT count(*) FROM public.tasks_recurrence_occurrences) > 0,
  'rebinds restored recurrence occurrences to the authenticated owner'
);

SELECT * FROM finish();
ROLLBACK;
