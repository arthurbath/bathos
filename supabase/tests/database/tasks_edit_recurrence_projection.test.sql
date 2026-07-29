BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(12);

SELECT has_function(
  'public',
  'tasks_edit_recurrence',
  ARRAY[
    'uuid', 'bigint', 'text', 'uuid', 'bigint', 'text', 'text', 'integer',
    'date', 'text', 'text', 'integer', 'uuid', 'jsonb', 'text', 'integer',
    'date', 'time without time zone', 'integer', 'uuid', 'text', 'text'
  ],
  'edits a complete recurrence revision through one RPC'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '9b000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'recurrence-edit@example.test', '', now(),
  '{}', '{}', now(), now()
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  '9b000000-0000-4000-8000-000000000010',
  '9b000000-0000-4000-8000-000000000001',
  'UTC',
  '9b000000-0000-4000-8000-000000000011'
);
INSERT INTO public.tasks_todos (
  id, owner_id, title, notes, destination, order_key, client_mutation_id
) VALUES (
  '9b000000-0000-4000-8000-000000000012',
  '9b000000-0000-4000-8000-000000000001',
  'Edited completion cadence', '', 'anytime', 'a0',
  '9b000000-0000-4000-8000-000000000013'
);

SELECT set_config(
  'test.edit_recurrence_created',
  public.tasks_create_recurrence_from_task(
    '9b000000-0000-4000-8000-000000000012',
    'Edited completion cadence',
    'after_completion',
    'weekly',
    1,
    '2026-07-29',
    '{}'::jsonb,
    'after',
    3,
    NULL,
    NULL,
    NULL,
    '9b000000-0000-4000-8000-000000000020'
  )::text,
  false
);

SELECT set_config(
  'test.edit_recurrence_result',
  public.tasks_edit_recurrence(
    (
      current_setting('test.edit_recurrence_created')::jsonb
      #>> '{definition,id}'
    )::uuid,
    (
      current_setting('test.edit_recurrence_created')::jsonb
      #>> '{definition,record_revision}'
    )::bigint,
    'Edited completion cadence',
    (
      current_setting('test.edit_recurrence_created')::jsonb
      #>> '{revision,template_id}'
    )::uuid,
    (
      current_setting('test.edit_recurrence_created')::jsonb
      #>> '{revision,template_revision}'
    )::bigint,
    'after_completion',
    'weekly',
    1,
    '2026-08-15',
    'UTC',
    'all',
    100,
    NULL,
    '{}'::jsonb,
    'after',
    3,
    NULL,
    NULL,
    NULL,
    '9b000000-0000-4000-8000-000000000021'
  )::text,
  false
);

SELECT is(
  current_setting('test.edit_recurrence_result')::jsonb ->> 'outcome',
  'accepted',
  'accepts a recurrence edit'
);
SELECT is(
  (
    current_setting('test.edit_recurrence_result')::jsonb
    #>> '{revision,revision}'
  )::integer,
  2,
  'creates a new immutable recurrence revision'
);
SELECT is(
  (
    current_setting('test.edit_recurrence_result')::jsonb
    #>> '{revision,start_date}'
  )::date,
  '2026-08-15'::date,
  'stores the edited next occurrence date'
);
SELECT is(
  (
    public.tasks_edit_recurrence(
      (
        current_setting('test.edit_recurrence_created')::jsonb
        #>> '{definition,id}'
      )::uuid,
      (
        current_setting('test.edit_recurrence_created')::jsonb
        #>> '{definition,record_revision}'
      )::bigint,
      'Edited completion cadence',
      (
        current_setting('test.edit_recurrence_created')::jsonb
        #>> '{revision,template_id}'
      )::uuid,
      (
        current_setting('test.edit_recurrence_created')::jsonb
        #>> '{revision,template_revision}'
      )::bigint,
      'after_completion', 'weekly', 1, '2026-08-15', 'UTC', 'all', 100,
      NULL, '{}'::jsonb, 'after', 3, NULL, NULL, NULL,
      '9b000000-0000-4000-8000-000000000021'
    ) ->> 'outcome'
  ),
  'already_applied',
  'retries the complete edit idempotently'
);
SELECT is(
  (
    public.tasks_edit_recurrence(
      (
        current_setting('test.edit_recurrence_created')::jsonb
        #>> '{definition,id}'
      )::uuid,
      (
        current_setting('test.edit_recurrence_created')::jsonb
        #>> '{definition,record_revision}'
      )::bigint,
      'Edited completion cadence',
      (
        current_setting('test.edit_recurrence_created')::jsonb
        #>> '{revision,template_id}'
      )::uuid,
      (
        current_setting('test.edit_recurrence_created')::jsonb
        #>> '{revision,template_revision}'
      )::bigint,
      'after_completion', 'weekly', 1, '2026-08-16', 'UTC', 'all', 100,
      NULL, '{}'::jsonb, 'after', 3, NULL, NULL, NULL,
      '9b000000-0000-4000-8000-000000000022'
    ) ->> 'outcome'
  ),
  'conflict',
  'rejects an edit based on a stale definition revision'
);

UPDATE public.tasks_todos
SET lifecycle = 'completed',
    completed_at = '2026-07-30T12:00:00Z',
    revision = revision + 1,
    client_mutation_id = '9b000000-0000-4000-8000-000000000023'
WHERE id = '9b000000-0000-4000-8000-000000000012';

SELECT is(
  (
    SELECT scheduled_date
    FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.edit_recurrence_created')::jsonb
      #>> '{definition,id}'
    )::uuid
      AND origin = 'generated'
    ORDER BY generated_at DESC
    LIMIT 1
  ),
  '2026-08-15'::date,
  'uses the edited next occurrence for an older-revision outstanding instance'
);

UPDATE public.tasks_todos
SET lifecycle = 'completed',
    completed_at = '2026-09-01T12:00:00Z',
    revision = revision + 1,
    client_mutation_id = '9b000000-0000-4000-8000-000000000024'
WHERE id = (
  SELECT root_id
  FROM public.tasks_recurrence_occurrences
  WHERE recurrence_id = (
    current_setting('test.edit_recurrence_created')::jsonb
    #>> '{definition,id}'
  )::uuid
    AND origin = 'generated'
  ORDER BY generated_at DESC
  LIMIT 1
);

SELECT is(
  (
    SELECT scheduled_date
    FROM public.tasks_recurrence_occurrences
    WHERE recurrence_id = (
      current_setting('test.edit_recurrence_created')::jsonb
      #>> '{definition,id}'
    )::uuid
      AND origin = 'generated'
    ORDER BY generated_at DESC
    LIMIT 1
  ),
  '2026-09-08'::date,
  'returns to interval-from-completion scheduling after the override is used'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, notes, destination, order_key, start_date,
  client_mutation_id
) VALUES (
  '9b000000-0000-4000-8000-000000000030',
  '9b000000-0000-4000-8000-000000000001',
  'Edited calendar cadence', '', 'anytime', 'b0', '2026-08-01',
  '9b000000-0000-4000-8000-000000000031'
);

SELECT set_config(
  'test.calendar_recurrence_created',
  public.tasks_create_recurrence_from_task(
    '9b000000-0000-4000-8000-000000000030',
    'Edited calendar cadence',
    'calendar',
    'monthly',
    1,
    '2026-08-01',
    '{"monthly_kind":"day_of_month","month_day":1}'::jsonb,
    'never',
    NULL,
    NULL,
    NULL,
    NULL,
    '9b000000-0000-4000-8000-000000000032'
  )::text,
  false
);

SELECT public.tasks_evaluate_recurrence(
  (
    current_setting('test.calendar_recurrence_created')::jsonb
    #>> '{definition,id}'
  )::uuid,
  '2026-10-31',
  '9b000000-0000-4000-8000-000000000033'
);

SELECT set_config(
  'test.calendar_recurrence_edited',
  public.tasks_edit_recurrence(
    (
      current_setting('test.calendar_recurrence_created')::jsonb
      #>> '{definition,id}'
    )::uuid,
    (
      SELECT record_revision
      FROM public.tasks_recurrence_definitions
      WHERE id = (
        current_setting('test.calendar_recurrence_created')::jsonb
        #>> '{definition,id}'
      )::uuid
    ),
    'Edited calendar cadence',
    (
      current_setting('test.calendar_recurrence_created')::jsonb
      #>> '{revision,template_id}'
    )::uuid,
    (
      current_setting('test.calendar_recurrence_created')::jsonb
      #>> '{revision,template_revision}'
    )::bigint,
    'calendar',
    'monthly',
    1,
    '2026-08-15',
    'UTC',
    'all',
    100,
    NULL,
    '{"monthly_kind":"day_of_month","month_day":15}'::jsonb,
    'never',
    NULL,
    NULL,
    NULL,
    NULL,
    '9b000000-0000-4000-8000-000000000034'
  )::text,
  false
);

SELECT is(
  (
    current_setting('test.calendar_recurrence_edited')::jsonb
    #>> '{definition,evaluated_through_date}'
  )::date,
  current_date,
  'resets calendar evaluation to the owner-local planning date'
);
SELECT ok(
  (
    SELECT count(*) > 0
    FROM public.tasks_todos
    WHERE recurrence_definition_id = (
      current_setting('test.calendar_recurrence_created')::jsonb
      #>> '{definition,id}'
    )::uuid
      AND recurrence_revision = 1
      AND recurrence_superseded_at IS NOT NULL
  ),
  'supersedes materialized future projections from the prior revision'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_todos
    WHERE recurrence_definition_id = (
      current_setting('test.calendar_recurrence_created')::jsonb
      #>> '{definition,id}'
    )::uuid
      AND recurrence_revision = 1
      AND recurrence_superseded_at IS NULL
      AND lifecycle = 'open'
      AND disposition = 'present'
  ),
  0::bigint,
  'leaves no active future projection from the prior revision'
);

SELECT public.tasks_evaluate_recurrence(
  (
    current_setting('test.calendar_recurrence_created')::jsonb
    #>> '{definition,id}'
  )::uuid,
  '2026-10-31',
  '9b000000-0000-4000-8000-000000000035'
);

SELECT is(
  (
    SELECT min(occurrence.scheduled_date)
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_todos AS task
      ON task.id = occurrence.root_id
     AND task.owner_id = occurrence.owner_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.calendar_recurrence_created')::jsonb
      #>> '{definition,id}'
    )::uuid
      AND occurrence.recurrence_revision = 2
      AND task.recurrence_superseded_at IS NULL
  ),
  '2026-08-15'::date,
  'materializes the edited calendar cadence as the active projection'
);

SELECT * FROM finish();
ROLLBACK;
