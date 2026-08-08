BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(31);

SELECT has_column(
  'public', 'tasks_recurrence_revisions', 'date_basis',
  'stores the immutable recurrence date basis'
);
SELECT has_column(
  'public', 'tasks_recurrence_revisions', 'deadline_after_start_days',
  'stores the canonical Deadline offset from Start'
);
SELECT has_function(
  'public', 'tasks_create_recurrence_from_task_v2',
  ARRAY[
    'uuid', 'text', 'text', 'integer', 'date', 'text', 'jsonb', 'text',
    'integer', 'date', 'time without time zone', 'integer', 'uuid', 'text', 'text'
  ],
  'exposes versioned Start-based recurrence creation'
);
SELECT has_function(
  'public', 'tasks_edit_recurrence_v2',
  ARRAY[
    'uuid', 'bigint', 'text', 'text', 'integer', 'date', 'text', 'text',
    'text', 'integer', 'uuid', 'jsonb', 'text', 'integer', 'date',
    'time without time zone', 'integer', 'jsonb', 'uuid', 'text', 'text'
  ],
  'exposes versioned recurrence editing'
);

SELECT is(
  tasks_private.recurrence_positioned_date(2028, 2, '31', 'day'),
  '2028-02-29'::date,
  'clamps numbered Day rules to the end of a short month'
);
SELECT is(
  tasks_private.recurrence_positioned_date(2027, 3, '23', 'weekday'),
  '2027-03-31'::date,
  'supports the maximum possible Weekday ordinal'
);
SELECT is(
  tasks_private.recurrence_positioned_date(2026, 8, '10', 'weekend_day'),
  '2026-08-30'::date,
  'supports the maximum possible Weekend Day ordinal'
);
SELECT is(
  tasks_private.recurrence_positioned_date(2026, 2, '10', 'weekend_day'),
  NULL::date,
  'skips a month when the requested Weekend Day ordinal does not exist'
);
SELECT is(
  tasks_private.recurrence_positioned_date(2026, 2, '5', 'monday'),
  NULL::date,
  'skips a month when the requested named weekday ordinal does not exist'
);
SELECT is(
  tasks_private.recurrence_positioned_date(2026, 2, 'last', 'monday'),
  '2026-02-23'::date,
  'resolves Last for a named weekday'
);
SELECT ok(
  tasks_private.recurrence_rule_config_v2_is_valid(
    'yearly', '{"version":2,"months":[2,5],"position":2,"day_type":"sunday"}'
  ),
  'accepts a canonical multi-month yearly rule'
);
SELECT ok(
  NOT tasks_private.recurrence_rule_config_v2_is_valid(
    'yearly', '{"version":2,"months":[],"position":2,"day_type":"sunday"}'
  ),
  'rejects a yearly rule without selected months'
);
SELECT ok(
  NOT tasks_private.recurrence_rule_config_v2_is_valid(
    'monthly', '{"version":2,"position":6,"day_type":"monday"}'
  ),
  'rejects ordinals above a named weekday maximum'
);

SELECT is(
  (
    WITH cases(position, day_type) AS (
      VALUES
        ('31', 'day'), ('last', 'day'), ('23', 'weekday'),
        ('10', 'weekend_day'), ('5', 'monday'), ('last', 'sunday')
    ), valueset AS (
      SELECT year_value, month_value, position, day_type,
        tasks_private.recurrence_positioned_date(
          year_value, month_value, position, day_type
        ) AS occurrence_date
      FROM generate_series(2000, 2399) AS year_value
      CROSS JOIN generate_series(1, 12) AS month_value
      CROSS JOIN cases
    )
    SELECT encode(extensions.digest(convert_to(string_agg(
      year_value::text || ':' || month_value::text || ':' || position || ':'
        || day_type || ':' || COALESCE(occurrence_date::text, 'null'),
      E'\n' ORDER BY year_value, month_value, day_type, position
    ), 'UTF8'), 'sha256'), 'hex')
    FROM valueset
  ),
  'f8f516ff1e42d37dd7c56c21b370013cf7dd245689e58a26d9f4a109fb0e2131',
  'matches the TypeScript positioned-date evaluator across 400 Gregorian years'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  'ab000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'basis@example.test', '', now(),
  '{}', '{}', now(), now()
);

INSERT INTO public.bathos_module_access_grants (
  module_id, user_id, grant_source, granted_by
)
SELECT 'tasks', id, 'manual', NULL
FROM auth.users
WHERE email LIKE '%@example.test'
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', 'ab000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_user_settings (
  id, owner_id, planning_timezone, client_mutation_id
) VALUES (
  'ab000000-0000-4000-8000-000000000002',
  'ab000000-0000-4000-8000-000000000001',
  'UTC',
  'ab000000-0000-4000-8000-000000000003'
);

INSERT INTO public.tasks_todos (
  id, owner_id, title, notes, actionability, destination, order_key,
  start_date, today_section, client_mutation_id
) VALUES
  (
    'ab000000-0000-4000-8000-000000000010',
    'ab000000-0000-4000-8000-000000000001',
    'Start-based Exercise', '', 'actionable', 'anytime', 'a0',
    NULL, 'inbox',
    'ab000000-0000-4000-8000-000000000011'
  ),
  (
    'ab000000-0000-4000-8000-000000000020',
    'ab000000-0000-4000-8000-000000000001',
    'Deadline-pinned Birthday', '', 'actionable', 'anytime', 'a1',
    NULL, 'inbox',
    'ab000000-0000-4000-8000-000000000021'
  );

SELECT set_config(
  'test.start_basis',
  public.tasks_create_recurrence_from_task_v2(
    'ab000000-0000-4000-8000-000000000010',
    'calendar', 'daily', 1, current_date, 'start',
    '{"version":2}'::jsonb, 'never', NULL, NULL, '09:00'::time, 6,
    'ab000000-0000-4000-8000-000000000012'
  )::text,
  false
);

SELECT is(
  current_setting('test.start_basis')::jsonb #>> '{revision,date_basis}',
  'start',
  'creates a Start-based revision'
);
SELECT is(
  (current_setting('test.start_basis')::jsonb
    #>> '{revision,deadline_after_start_days}')::integer,
  6,
  'stores Days After Start on a Start-based revision'
);
SELECT is(
  current_setting('test.start_basis')::jsonb
    #>> '{revision,deadline_offset_days}',
  NULL::text,
  'does not expose a legacy Deadline anchor offset for Start-based revisions'
);
SELECT is(
  current_setting('test.start_basis')::jsonb #>> '{revision,name}',
  'Start-based Exercise',
  'derives the recurrence name from the task Summary'
);
SELECT ok(
  current_setting('test.start_basis')::jsonb #>> '{occurrence,logical_key}'
    LIKE 'calendar-v2-start:%',
  'uses the versioned Start-based logical-key namespace'
);
SELECT is(
  public.tasks_create_recurrence_from_task_v2(
    'ab000000-0000-4000-8000-000000000010',
    'calendar', 'daily', 1, current_date, 'start',
    '{"version":2}'::jsonb, 'never', NULL, NULL, '09:00'::time, 6,
    'ab000000-0000-4000-8000-000000000012'
  ) ->> 'outcome',
  'already_applied',
  'replays Start-based creation idempotently with the same mutation identity'
);

RESET ROLE;
DO $$
DECLARE
  definition_row public.tasks_recurrence_definitions;
  revision_row public.tasks_recurrence_revisions;
BEGIN
  SELECT definition.* INTO definition_row
  FROM public.tasks_recurrence_definitions AS definition
  WHERE definition.id = (
    current_setting('test.start_basis')::jsonb #>> '{definition,id}'
  )::uuid;
  SELECT revision.* INTO revision_row
  FROM public.tasks_recurrence_revisions AS revision
  WHERE revision.recurrence_id = definition_row.id AND revision.revision = 1;
  PERFORM tasks_private.instantiate_recurrence_occurrence(
    definition_row.owner_id,
    definition_row,
    revision_row,
    current_date + 1,
    'calendar:' || (current_date + 1)::text,
    NULL,
    'web',
    'system'
  );
END
$$;
SET LOCAL ROLE authenticated;
SELECT is(
  (
    SELECT task.start_date
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_todos AS task
      ON task.owner_id = occurrence.owner_id AND task.id = occurrence.root_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.start_basis')::jsonb #>> '{definition,id}'
    )::uuid AND occurrence.origin = 'generated'
    ORDER BY occurrence.scheduled_date DESC LIMIT 1
  ),
  current_date + 1,
  'generates a Start-based instance on its anchor date'
);
SELECT is(
  (
    SELECT task.deadline
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_todos AS task
      ON task.owner_id = occurrence.owner_id AND task.id = occurrence.root_id
    WHERE occurrence.recurrence_id = (
      current_setting('test.start_basis')::jsonb #>> '{definition,id}'
    )::uuid AND occurrence.origin = 'generated'
    ORDER BY occurrence.scheduled_date DESC LIMIT 1
  ),
  current_date + 7,
  'derives a generated Deadline after Start'
);
SELECT is(
  (
    SELECT reminder.local_date
    FROM public.tasks_recurrence_occurrences AS occurrence
    JOIN public.tasks_reminders AS reminder
      ON reminder.owner_id = occurrence.owner_id
      AND reminder.task_id = occurrence.root_id
      AND reminder.status = 'active'
    WHERE occurrence.recurrence_id = (
      current_setting('test.start_basis')::jsonb #>> '{definition,id}'
    )::uuid AND occurrence.origin = 'generated'
    ORDER BY occurrence.scheduled_date DESC LIMIT 1
  ),
  current_date + 1,
  'schedules a generated reminder from the derived Start date'
);

SELECT set_config(
  'test.deadline_basis',
  public.tasks_create_recurrence_from_task_v2(
    'ab000000-0000-4000-8000-000000000020',
    'calendar', 'yearly', 1, current_date, 'deadline',
    jsonb_build_object(
      'version', 2, 'months', jsonb_build_array(extract(month FROM current_date)::integer),
      'position', extract(day FROM current_date)::integer, 'day_type', 'day'
    ),
    'never', NULL, NULL, NULL, 14,
    'ab000000-0000-4000-8000-000000000022'
  )::text,
  false
);
SELECT is(
  current_setting('test.deadline_basis')::jsonb #>> '{revision,date_basis}',
  'deadline',
  'creates an explicitly Deadline-pinned revision'
);
SELECT is(
  (current_setting('test.deadline_basis')::jsonb
    #>> '{revision,start_date}')::date,
  current_date + 14,
  'stores the meaningful Deadline as the Deadline-basis cadence anchor'
);
SELECT is(
  (current_setting('test.deadline_basis')::jsonb
    #>> '{revision,deadline_after_start_days}')::integer,
  14,
  'preserves the Deadline lead time canonically'
);

SELECT set_config('test.basis_export', public.tasks_create_export_v14()::text, false);
SELECT is(
  (
    SELECT exported_revision ->> 'date_basis'
    FROM jsonb_array_elements(
      current_setting('test.basis_export')::jsonb
        #> '{data,tasks_recurrence_revisions}'
    ) AS exported(exported_revision)
    WHERE exported_revision ->> 'recurrence_id'
      = current_setting('test.start_basis')::jsonb #>> '{definition,id}'
  ),
  'start',
  'exports the immutable recurrence date basis'
);
SELECT is(
  (
    SELECT (exported_revision ->> 'deadline_after_start_days')::integer
    FROM jsonb_array_elements(
      current_setting('test.basis_export')::jsonb
        #> '{data,tasks_recurrence_revisions}'
    ) AS exported(exported_revision)
    WHERE exported_revision ->> 'recurrence_id'
      = current_setting('test.start_basis')::jsonb #>> '{definition,id}'
  ),
  6,
  'exports the canonical Deadline offset from Start'
);
SELECT lives_ok(
  format(
    'SELECT public.tasks_restore_export_current(%L::jsonb, true)',
    current_setting('test.basis_export')
  ),
  'accepts a dual-basis export through the current restore path'
);

SELECT set_config('garden.bath.tasks_recurrence_v2', 'off', true);

RESET ROLE;
SELECT throws_ok(
  format(
    'UPDATE public.tasks_recurrence_revisions
     SET date_basis = ''deadline''
     WHERE id = %L::uuid',
    current_setting('test.start_basis')::jsonb #>> '{revision,id}'
  ),
  '22023',
  'Recurrence date basis is immutable within a revision',
  'prevents changing the date basis inside an existing revision'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub', 'ab000000-0000-4000-8000-000000000001', true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('garden.bath.tasks_recurrence_v2', 'off', true);
SELECT throws_ok(
  format(
    $sql$
      SELECT public.tasks_edit_recurrence(
        %L::uuid,
        (SELECT record_revision FROM public.tasks_recurrence_definitions
          WHERE id = %L::uuid),
        'Cached Client Edit', 'calendar', 'daily', 1, current_date,
        'UTC', 'latest', 100, NULL, '{"version":2}'::jsonb,
        'never', NULL, NULL, NULL, NULL,
        (SELECT prototype_snapshot FROM public.tasks_recurrence_revisions
          WHERE recurrence_id = %L::uuid AND revision = 1),
        %L::uuid
      )
    $sql$,
    current_setting('test.start_basis')::jsonb #>> '{definition,id}',
    current_setting('test.start_basis')::jsonb #>> '{definition,id}',
    current_setting('test.start_basis')::jsonb #>> '{definition,id}',
    'ab000000-0000-4000-8000-000000000014'
  ),
  '55000',
  'Refresh Tasks before editing this repeat',
  'rejects a cached legacy client editing a version-2 Start-based revision'
);

SELECT * FROM finish();
ROLLBACK;
