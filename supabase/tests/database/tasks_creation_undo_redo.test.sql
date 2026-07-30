BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '3a000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'creation-history@example.test',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '3a000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.tasks_todos (
  id, owner_id, title, destination, order_key, client_mutation_id
) VALUES (
  '3a000000-0000-4000-8000-000000000010',
  '3a000000-0000-4000-8000-000000000001',
  'Pasted task',
  'anytime',
  'a0',
  '3a000000-0000-4000-8000-000000000020'
);

UPDATE public.tasks_todos
SET disposition = 'deleted',
  deleted_at = '2026-07-30T23:20:00.000Z',
  deletion_root_id = id,
  revision = 2,
  client_mutation_id = '3a000000-0000-4000-8000-000000000021',
  undo_source_event_id = (
    SELECT id
    FROM public.tasks_history_events
    WHERE client_mutation_id = '3a000000-0000-4000-8000-000000000020'
  )
WHERE id = '3a000000-0000-4000-8000-000000000010';

SELECT is(
  (SELECT disposition FROM public.tasks_todos
   WHERE id = '3a000000-0000-4000-8000-000000000010'),
  'deleted',
  'undoing creation uses recoverable deletion'
);
SELECT is(
  (SELECT deletion_root_id FROM public.tasks_todos
   WHERE id = '3a000000-0000-4000-8000-000000000010'),
  '3a000000-0000-4000-8000-000000000010'::uuid,
  'undoing creation preserves a restorable root identity'
);
SELECT is(
  (SELECT transition FROM public.tasks_history_events
   WHERE client_mutation_id = '3a000000-0000-4000-8000-000000000021'),
  'undo',
  'the inverse of creation is classified as undo'
);

UPDATE public.tasks_todos
SET disposition = 'present',
  deleted_at = NULL,
  deletion_root_id = NULL,
  revision = 3,
  client_mutation_id = '3a000000-0000-4000-8000-000000000022',
  undo_source_event_id = (
    SELECT id
    FROM public.tasks_history_events
    WHERE client_mutation_id = '3a000000-0000-4000-8000-000000000020'
  )
WHERE id = '3a000000-0000-4000-8000-000000000010';

SELECT is(
  (SELECT transition FROM public.tasks_history_events
   WHERE client_mutation_id = '3a000000-0000-4000-8000-000000000022'),
  'redo',
  'restoring the creation snapshot is classified as redo'
);
SELECT is(
  (SELECT title FROM public.tasks_todos
   WHERE id = '3a000000-0000-4000-8000-000000000010'),
  'Pasted task',
  'redo restores the exact created content'
);
SELECT is(
  (SELECT disposition FROM public.tasks_todos
   WHERE id = '3a000000-0000-4000-8000-000000000010'),
  'present',
  'redo restores the created task to active lists'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_history_events
   WHERE task_id = '3a000000-0000-4000-8000-000000000010'),
  3::bigint,
  'creation, undo, and redo remain append-only history events'
);
SELECT is(
  (SELECT count(*) FROM public.tasks_todos
   WHERE id = '3a000000-0000-4000-8000-000000000010'),
  1::bigint,
  'undo and redo retain one durable task row'
);

SELECT * FROM finish();
ROLLBACK;
