BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(43);

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '31000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'history-owner-a@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '32000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'history-owner-b@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

INSERT INTO public.tasks_todos (
  id,
  owner_id,
  title,
  destination,
  order_key,
  client_mutation_id
)
VALUES (
  '32000000-0000-4000-8000-000000000010',
  '32000000-0000-4000-8000-000000000002',
  'Other owner history',
  'inbox',
  'a0',
  '32000000-0000-4000-8000-000000000020'
);

SELECT has_table('public', 'tasks_history_events', 'creates the task history table');
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tasks_history_events'::regclass),
  true,
  'enables RLS for task history'
);
SELECT has_trigger(
  'public',
  'tasks_todos',
  'tasks_todos_append_history',
  'appends task history from the authoritative row boundary'
);
SELECT has_index(
  'public',
  'tasks_history_events',
  'tasks_history_events_owner_occurred_idx',
  'indexes owner history in reverse chronological order'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT lives_ok(
  $$
    INSERT INTO public.tasks_todos (
      id,
      owner_id,
      title,
      destination,
      order_key,
      entry_channel,
      client_mutation_id,
      last_mutation_channel,
      last_actor_type
    )
    VALUES (
      '31000000-0000-4000-8000-000000000010',
      '31000000-0000-4000-8000-000000000001',
      'Synthetic history task',
      'today',
      'a0',
      'web',
      '31000000-0000-4000-8000-000000000020',
      'web',
      'user'
    )
  $$,
  'creates an owned task through the history trigger'
);

SELECT is(
  (SELECT count(*) FROM public.tasks_history_events),
  1::bigint,
  'shows only the signed-in owner history'
);
SELECT is(
  (
    SELECT transition
    FROM public.tasks_history_events
    WHERE task_id = '31000000-0000-4000-8000-000000000010'
  ),
  'create',
  'records task creation explicitly'
);
SELECT is(
  (
    SELECT base_revision
    FROM public.tasks_history_events
    WHERE task_id = '31000000-0000-4000-8000-000000000010'
  ),
  0::bigint,
  'starts creation history at revision zero'
);
SELECT is(
  (
    SELECT result_revision
    FROM public.tasks_history_events
    WHERE task_id = '31000000-0000-4000-8000-000000000010'
  ),
  1::bigint,
  'records the created task revision'
);
SELECT is(
  (
    SELECT before_state
    FROM public.tasks_history_events
    WHERE task_id = '31000000-0000-4000-8000-000000000010'
  ),
  NULL::jsonb,
  'does not invent a state before creation'
);
SELECT is(
  (
    SELECT after_state ->> 'title'
    FROM public.tasks_history_events
    WHERE task_id = '31000000-0000-4000-8000-000000000010'
  ),
  'Synthetic history task',
  'stores owner-visible state needed for audit and undo'
);
SELECT is(
  (
    SELECT actor_type
    FROM public.tasks_history_events
    WHERE task_id = '31000000-0000-4000-8000-000000000010'
  ),
  'user',
  'records the mutation actor type'
);
SELECT is(
  (
    SELECT mutation_channel
    FROM public.tasks_history_events
    WHERE task_id = '31000000-0000-4000-8000-000000000010'
  ),
  'web',
  'records the mutation channel separately from source identity'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_history_events
    WHERE owner_id = '32000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'does not reveal another owner history'
);

SELECT throws_ok(
  $$
    INSERT INTO public.tasks_history_events (
      owner_id,
      task_id,
      client_mutation_id,
      actor_type,
      mutation_channel,
      affected_ids,
      base_revision,
      result_revision,
      transition,
      occurred_at,
      after_state
    )
    VALUES (
      '31000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000010',
      '31000000-0000-4000-8000-000000000021',
      'user',
      'web',
      ARRAY['31000000-0000-4000-8000-000000000010'::uuid],
      0,
      1,
      'create',
      now(),
      '{}'::jsonb
    )
  $$,
  '42501',
  NULL,
  'prevents clients from forging accepted history'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      lifecycle = 'completed',
      completed_at = '2026-07-20T04:00:00.000Z',
      revision = 2,
      client_mutation_id = '31000000-0000-4000-8000-000000000022',
      last_mutation_channel = 'web',
      last_actor_type = 'user'
    WHERE id = '31000000-0000-4000-8000-000000000010'
      AND revision = 1
  $$,
  'atomically completes a task and appends its event'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_history_events),
  2::bigint,
  'appends exactly one completion event'
);
SELECT is(
  (
    SELECT transition
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000022'
  ),
  'complete',
  'records the completion transition'
);
SELECT is(
  (
    SELECT before_state ->> 'lifecycle'
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000022'
  ),
  'open',
  'retains the state before completion'
);
SELECT is(
  (
    SELECT after_state ->> 'lifecycle'
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000022'
  ),
  'completed',
  'retains the state after completion'
);
SELECT is(
  (
    SELECT affected_ids
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000022'
  ),
  ARRAY['31000000-0000-4000-8000-000000000010'::uuid],
  'returns the affected stable identifiers without task content'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET
      notes = 'Mutation identifier reuse must fail',
      revision = 3,
      client_mutation_id = '31000000-0000-4000-8000-000000000020',
      last_mutation_channel = 'web'
    WHERE id = '31000000-0000-4000-8000-000000000010'
  $$,
  '23505',
  NULL,
  'rejects reuse of a historical client mutation identifier'
);
SELECT is(
  (
    SELECT revision
    FROM public.tasks_todos
    WHERE id = '31000000-0000-4000-8000-000000000010'
  ),
  2::bigint,
  'rolls back the task update when history append fails'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_history_events
    SET code = 'forged'
    WHERE task_id = '31000000-0000-4000-8000-000000000010'
  $$,
  '42501',
  NULL,
  'prevents authenticated history updates'
);
SELECT throws_ok(
  $$
    DELETE FROM public.tasks_history_events
    WHERE task_id = '31000000-0000-4000-8000-000000000010'
  $$,
  '42501',
  NULL,
  'prevents authenticated history deletion'
);
SELECT is(
  has_schema_privilege('authenticated', 'tasks_private', 'USAGE'),
  false,
  'keeps the snapshot helper outside the client API surface'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      disposition = 'deleted',
      deleted_at = '2026-07-20T04:05:00.000Z',
      revision = 3,
      client_mutation_id = '31000000-0000-4000-8000-000000000023',
      last_mutation_channel = 'web'
    WHERE id = '31000000-0000-4000-8000-000000000010'
      AND revision = 2
  $$,
  'records recoverable deletion atomically'
);
SELECT is(
  (
    SELECT transition
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000023'
  ),
  'delete',
  'records recoverable deletion explicitly'
);
SELECT is(
  (
    SELECT before_state ->> 'disposition'
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000023'
  ),
  'present',
  'retains the pre-deletion disposition'
);
SELECT is(
  (
    SELECT after_state ->> 'disposition'
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000023'
  ),
  'deleted',
  'retains the deleted disposition'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      disposition = 'present',
      deleted_at = NULL,
      revision = 4,
      client_mutation_id = '31000000-0000-4000-8000-000000000024',
      last_mutation_channel = 'web'
    WHERE id = '31000000-0000-4000-8000-000000000010'
      AND revision = 3
  $$,
  'records restoration atomically'
);
SELECT is(
  (
    SELECT transition
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000024'
  ),
  'restore',
  'records restoration explicitly'
);
SELECT is(
  (
    SELECT after_state ->> 'disposition'
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000024'
  ),
  'present',
  'retains the restored disposition'
);

SELECT lives_ok(
  $$
    UPDATE public.tasks_todos
    SET
      disposition = 'deleted',
      deleted_at = '2026-07-20T04:05:00.000Z',
      revision = 5,
      client_mutation_id = '31000000-0000-4000-8000-000000000025',
      last_mutation_channel = 'web',
      last_actor_type = 'user',
      undo_source_event_id = (
        SELECT id
        FROM public.tasks_history_events
        WHERE client_mutation_id = '31000000-0000-4000-8000-000000000024'
      )
    WHERE id = '31000000-0000-4000-8000-000000000010'
      AND revision = 4
  $$,
  'applies a safe inverse mutation from the current history event'
);
SELECT is(
  (
    SELECT transition
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000025'
  ),
  'undo',
  'records inverse mutation as undo'
);
SELECT is(
  (
    SELECT disposition
    FROM public.tasks_todos
    WHERE id = '31000000-0000-4000-8000-000000000010'
  ),
  'deleted',
  'restores the prior task state through undo'
);
SELECT is(
  (
    SELECT before_state ->> 'disposition'
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000025'
  ),
  'present',
  'records the state before undo'
);
SELECT is(
  (
    SELECT after_state ->> 'disposition'
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000025'
  ),
  'deleted',
  'records the state after undo'
);
SELECT is(
  (
    SELECT undo_source_event_id
    FROM public.tasks_todos
    WHERE id = '31000000-0000-4000-8000-000000000010'
  ),
  (
    SELECT id
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000024'
  ),
  'retains the source event for the accepted undo receipt'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET
      disposition = 'present',
      deleted_at = NULL,
      revision = 6,
      client_mutation_id = '31000000-0000-4000-8000-000000000026',
      undo_source_event_id = (
        SELECT id
        FROM public.tasks_history_events
        WHERE client_mutation_id = '31000000-0000-4000-8000-000000000023'
      )
    WHERE id = '31000000-0000-4000-8000-000000000010'
      AND revision = 5
  $$,
  '23514',
  'The requested undo is no longer safe',
  'rejects undo after the source revision is no longer current'
);
SELECT is(
  (
    SELECT revision
    FROM public.tasks_todos
    WHERE id = '31000000-0000-4000-8000-000000000010'
  ),
  5::bigint,
  'leaves current task state untouched after unsafe undo'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.tasks_history_events
    WHERE client_mutation_id = '31000000-0000-4000-8000-000000000026'
  ),
  0::bigint,
  'does not append history for rejected undo'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET
      notes = 'Invalid metadata',
      revision = 6,
      client_mutation_id = '31000000-0000-4000-8000-000000000027',
      last_actor_type = 'intruder'
    WHERE id = '31000000-0000-4000-8000-000000000010'
  $$,
  '23514',
  NULL,
  'rejects unsupported history actor types'
);

SELECT * FROM finish();
ROLLBACK;
