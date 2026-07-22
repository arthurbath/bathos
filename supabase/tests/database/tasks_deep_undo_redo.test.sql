BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(10);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '35000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'deep-history@example.test',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '35000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES (
  '35000000-0000-4000-8000-000000000010',
  '35000000-0000-4000-8000-000000000001',
  'Original',
  'anytime',
  'a0',
  '35000000-0000-4000-8000-000000000020'
);

UPDATE public.tasks_todos
SET title = 'Edited', revision = 2,
  client_mutation_id = '35000000-0000-4000-8000-000000000021'
WHERE id = '35000000-0000-4000-8000-000000000010';

UPDATE public.tasks_todos
SET title = 'Original', revision = 3,
  client_mutation_id = '35000000-0000-4000-8000-000000000022',
  undo_source_event_id = (
    SELECT id FROM public.tasks_history_events
    WHERE client_mutation_id = '35000000-0000-4000-8000-000000000021'
  )
WHERE id = '35000000-0000-4000-8000-000000000010';

SELECT is(
  (SELECT transition FROM public.tasks_history_events
   WHERE client_mutation_id = '35000000-0000-4000-8000-000000000022'),
  'undo',
  'classifies the exact after-to-before traversal as undo'
);

UPDATE public.tasks_todos
SET title = 'Edited', revision = 4,
  client_mutation_id = '35000000-0000-4000-8000-000000000023',
  undo_source_event_id = (
    SELECT id FROM public.tasks_history_events
    WHERE client_mutation_id = '35000000-0000-4000-8000-000000000021'
  )
WHERE id = '35000000-0000-4000-8000-000000000010';

SELECT is(
  (SELECT transition FROM public.tasks_history_events
   WHERE client_mutation_id = '35000000-0000-4000-8000-000000000023'),
  'redo',
  'classifies the exact before-to-after traversal as redo'
);
SELECT is(
  (SELECT title FROM public.tasks_todos
   WHERE id = '35000000-0000-4000-8000-000000000010'),
  'Edited',
  'reapplies the source after-state'
);

UPDATE public.tasks_todos
SET title = 'Original', revision = 5,
  client_mutation_id = '35000000-0000-4000-8000-000000000024',
  undo_source_event_id = (
    SELECT id FROM public.tasks_history_events
    WHERE client_mutation_id = '35000000-0000-4000-8000-000000000021'
  )
WHERE id = '35000000-0000-4000-8000-000000000010';

SELECT is(
  (SELECT transition FROM public.tasks_history_events
   WHERE client_mutation_id = '35000000-0000-4000-8000-000000000024'),
  'undo',
  'allows the same source event to be traversed again safely'
);

UPDATE public.tasks_todos
SET notes = 'New forward change', revision = 6,
  client_mutation_id = '35000000-0000-4000-8000-000000000025'
WHERE id = '35000000-0000-4000-8000-000000000010';

SELECT is(
  (SELECT undo_source_event_id FROM public.tasks_todos
   WHERE id = '35000000-0000-4000-8000-000000000010'),
  NULL::uuid,
  'clears stale inverse metadata for an ordinary forward change'
);
SELECT is(
  (SELECT transition FROM public.tasks_history_events
   WHERE client_mutation_id = '35000000-0000-4000-8000-000000000025'),
  'update',
  'records the ordinary change as a forward update'
);

SELECT throws_ok(
  $$
    UPDATE public.tasks_todos
    SET title = 'Edited', notes = '', revision = 7,
      client_mutation_id = '35000000-0000-4000-8000-000000000026',
      undo_source_event_id = (
        SELECT id FROM public.tasks_history_events
        WHERE client_mutation_id = '35000000-0000-4000-8000-000000000021'
      )
    WHERE id = '35000000-0000-4000-8000-000000000010'
  $$,
  '23514',
  'The requested task history traversal is no longer safe',
  'rejects traversal after an intervening forward state change'
);
SELECT is(
  (SELECT revision FROM public.tasks_todos
   WHERE id = '35000000-0000-4000-8000-000000000010'),
  6::bigint,
  'does not advance the task after rejected traversal'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_history_events
   WHERE client_mutation_id = '35000000-0000-4000-8000-000000000026'),
  0::bigint,
  'does not append history for rejected traversal'
);

SELECT ok(
  (SELECT count(*) >= 4 FROM public.tasks_history_events
   WHERE task_id = '35000000-0000-4000-8000-000000000010'),
  'retains the append-only forward and inverse event chain'
);

SELECT * FROM finish();
ROLLBACK;
