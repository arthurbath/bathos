BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(23);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '76000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'mail-event-export-owner-a@example.test', '', now(), '{}', '{}', now(), now()
  ),
  (
    '76000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'mail-event-export-owner-b@example.test', '', now(), '{}', '{}', now(), now()
  );

SELECT has_function(
  'public', 'tasks_create_export_v12', ARRAY[]::text[],
  'creates portable task exports with Mail source audit history'
);

SELECT has_function(
  'public', 'tasks_restore_export_current', ARRAY['jsonb', 'boolean'],
  'restores portable task exports with Mail source audit history'
);

SELECT is(
  has_function_privilege('anon', 'public.tasks_create_export_v12()', 'EXECUTE'),
  false,
  'withholds current export from anonymous callers'
);

SELECT is(
  has_function_privilege(
    'authenticated', 'public.tasks_create_export_v12()', 'EXECUTE'
  ),
  true,
  'grants current export to authenticated callers'
);

SELECT is(
  has_function_privilege(
    'authenticated', 'public.tasks_restore_export_current(jsonb,boolean)', 'EXECUTE'
  ),
  true,
  'grants current restore to authenticated callers'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '76000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT public.tasks_create_mail_capture(
  '76000000-0000-4000-8000-000000000010',
  '76000000-0000-4000-8000-000000000011',
  'Portable retirement history', '', NULL, 'a0', NULL,
  'Work', 'INBOX', 'mail-event-export@example.test',
  'message://%3Cmail-event-export%40example.test%3E',
  'Archive', 'Export test', NULL
);

SELECT public.tasks_begin_mail_retirement(
  '76000000-0000-4000-8000-000000000011', 1,
  '76000000-0000-4000-8000-000000000020'
);
SELECT public.tasks_resolve_mail_retirement(
  '76000000-0000-4000-8000-000000000011', 2,
  '76000000-0000-4000-8000-000000000021',
  'failed', 'mail_move_timeout'
);
SELECT public.tasks_begin_mail_retirement(
  '76000000-0000-4000-8000-000000000011', 3,
  '76000000-0000-4000-8000-000000000022'
);
SELECT public.tasks_resolve_mail_retirement(
  '76000000-0000-4000-8000-000000000011', 4,
  '76000000-0000-4000-8000-000000000023',
  'retired', NULL
);

CREATE TEMP TABLE captured_mail_event_export AS
SELECT public.tasks_create_export_v12() AS envelope;

SELECT is(
  (SELECT envelope ->> 'schema_version' FROM captured_mail_event_export),
  '12',
  'advances the portable task schema for Mail source audit events'
);

SELECT is(
  (SELECT jsonb_array_length(envelope #> '{data,tasks_mail_source_events}')
   FROM captured_mail_event_export),
  4,
  'exports every accepted Mail retirement transition'
);

SELECT is(
  (SELECT jsonb_path_exists(
    envelope,
    '$.data.tasks_mail_source_events[*].owner_id'
  ) FROM captured_mail_event_export),
  false,
  'removes owner identifiers from exported Mail source events'
);

SELECT is(
  (SELECT jsonb_path_query_first(
    envelope,
    '$.data.tasks_mail_source_events[*] ? (@.transition == "retirement_failed").error_code'
  ) #>> '{}'
  FROM captured_mail_event_export),
  'mail_move_timeout',
  'preserves a failed retirement after a later successful retry'
);

SELECT is(
  (SELECT (
    public.tasks_restore_export_current(envelope, true)
      #>> '{tasks_mail_source_events,matches}'
  )::integer FROM captured_mail_event_export),
  4,
  'previews existing audit events as idempotent matches'
);

SET LOCAL ROLE postgres;
CREATE TEMP TABLE missing_event_field_export AS
WITH changed AS (
  SELECT jsonb_agg(
    CASE WHEN ordinal = 1 THEN event - 'error_code' ELSE event END
    ORDER BY ordinal
  ) AS events
  FROM captured_mail_event_export,
  jsonb_array_elements(envelope #> '{data,tasks_mail_source_events}')
    WITH ORDINALITY AS item(event, ordinal)
)
SELECT jsonb_set(
  jsonb_set(
    envelope,
    '{data,tasks_mail_source_events}',
    changed.events
  ),
  '{manifest,checksums,tasks_mail_source_events}',
  to_jsonb(tasks_private.export_checksum(changed.events))
) AS envelope
FROM captured_mail_event_export, changed;
GRANT SELECT ON missing_event_field_export TO authenticated;

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    SELECT public.tasks_restore_export_current(envelope, true)
    FROM missing_event_field_export
  $$,
  '22023', NULL,
  'rejects audit events with missing required fields even when checksums match'
);

SET LOCAL ROLE postgres;
CREATE TEMP TABLE broken_event_chain_export AS
WITH changed AS (
  SELECT jsonb_agg(
    CASE WHEN ordinal = 2
      THEN jsonb_set(event, '{base_revision}', '99'::jsonb)
      ELSE event
    END
    ORDER BY ordinal
  ) AS events
  FROM captured_mail_event_export,
  jsonb_array_elements(envelope #> '{data,tasks_mail_source_events}')
    WITH ORDINALITY AS item(event, ordinal)
)
SELECT jsonb_set(
  jsonb_set(
    envelope,
    '{data,tasks_mail_source_events}',
    changed.events
  ),
  '{manifest,checksums,tasks_mail_source_events}',
  to_jsonb(tasks_private.export_checksum(changed.events))
) AS envelope
FROM captured_mail_event_export, changed;
GRANT SELECT ON broken_event_chain_export TO authenticated;

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    SELECT public.tasks_restore_export_current(envelope, true)
    FROM broken_event_chain_export
  $$,
  '22023', NULL,
  'rejects a discontinuous Mail retirement audit chain'
);

SET LOCAL ROLE postgres;
CREATE TEMP TABLE mismatched_source_state_export AS
WITH changed AS (
  SELECT jsonb_agg(
    jsonb_set(source, '{revision}', '4'::jsonb)
    ORDER BY source ->> 'task_id'
  ) AS sources
  FROM captured_mail_event_export,
  jsonb_array_elements(envelope #> '{data,tasks_mail_sources}') AS item(source)
)
SELECT jsonb_set(
  jsonb_set(
    envelope,
    '{data,tasks_mail_sources}',
    changed.sources
  ),
  '{manifest,checksums,tasks_mail_sources}',
  to_jsonb(tasks_private.export_checksum(changed.sources))
) AS envelope
FROM captured_mail_event_export, changed;
GRANT SELECT ON mismatched_source_state_export TO authenticated;

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    SELECT public.tasks_restore_export_current(envelope, true)
    FROM mismatched_source_state_export
  $$,
  '22023', NULL,
  'rejects Mail source state that does not match its latest audit event'
);

SET LOCAL ROLE postgres;
DELETE FROM auth.users
WHERE id = '76000000-0000-4000-8000-000000000001';
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '76000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  (public.tasks_restore_export_current(
    (SELECT envelope FROM captured_mail_event_export), true
  ) #>> '{tasks_mail_sources,inserts}')::integer,
  1,
  'previews the deleted Mail source as a new insert for another owner'
);

SELECT is(
  (public.tasks_restore_export_current(
    (SELECT envelope FROM captured_mail_event_export), true
  ) #>> '{tasks_mail_source_events,inserts}')::integer,
  4,
  'previews the complete deleted audit chain as new inserts'
);

SELECT lives_ok(
  $$
    SELECT public.tasks_restore_export_current(
      (SELECT envelope FROM captured_mail_event_export), false
    );
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED
  $$,
  'restores Mail source state and immutable audit history atomically'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_mail_source_events),
  4::bigint,
  'restores each audit event exactly once'
);

SELECT is(
  (SELECT array_agg(transition ORDER BY base_revision)
   FROM public.tasks_mail_source_events),
  ARRAY['retirement_started', 'retirement_failed', 'retirement_started', 'retired']::text[],
  'preserves the ordered retirement transition history'
);

SELECT is(
  (SELECT lifecycle || ':' || revision::text
   FROM public.tasks_mail_sources
   WHERE task_id = '76000000-0000-4000-8000-000000000011'),
  'retired:5',
  'restores current Mail source state at the audit chain tip'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_mail_source_events
   WHERE owner_id = '76000000-0000-4000-8000-000000000002'),
  4::bigint,
  'rebinds restored audit events to the restoring owner'
);

SELECT is(
  (public.tasks_restore_export_current(
    (SELECT envelope FROM captured_mail_event_export), true
  ) #>> '{tasks_mail_source_events,matches}')::integer,
  4,
  'reports restored audit events as idempotent matches'
);

SET LOCAL ROLE postgres;
UPDATE public.tasks_mail_source_events
SET occurred_at = occurred_at + interval '1 second'
WHERE task_id = '76000000-0000-4000-8000-000000000011'
  AND base_revision = 1;

SET LOCAL ROLE authenticated;
SELECT is(
  public.tasks_restore_export_current(
    (SELECT envelope FROM captured_mail_event_export), false
  ) ->> 'code',
  'restore_conflict',
  'rejects conflicting audit history before partially merging it'
);

SELECT is(
  (SELECT jsonb_array_length(
    public.tasks_create_export_v12() #> '{data,tasks_mail_source_events}'
  )),
  4,
  're-exports the restored audit history for its new owner'
);

SELECT * FROM finish();
ROLLBACK;
