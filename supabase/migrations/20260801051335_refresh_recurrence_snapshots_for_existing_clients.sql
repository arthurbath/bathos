-- Re-emit recurrence revision rows after the first-class prototype snapshot
-- became part of the synchronized client schema. Existing PowerSync databases
-- may otherwise retain NULL for a column populated before those clients knew
-- about it. The update is deliberately value-preserving and fail-closed.

DO $refresh_recurrence_snapshots$
DECLARE
  _before_count bigint;
  _after_count bigint;
  _updated_count bigint;
  _before_digest text;
  _after_digest text;
BEGIN
  SELECT count(*), md5(COALESCE(
    jsonb_agg(to_jsonb(revision) ORDER BY revision.id)::text,
    '[]'
  ))
  INTO _before_count, _before_digest
  FROM public.tasks_recurrence_revisions AS revision;

  IF EXISTS (
    SELECT 1
    FROM public.tasks_recurrence_revisions AS revision
    WHERE revision.prototype_snapshot IS NULL
      OR jsonb_typeof(revision.prototype_snapshot) <> 'object'
      OR revision.prototype_snapshot ->> 'version' <> '2'
      OR revision.prototype_snapshot ->> 'kind' <> 'todo'
      OR jsonb_typeof(revision.prototype_snapshot -> 'root') <> 'object'
  ) THEN
    RAISE EXCEPTION 'A recurrence prototype snapshot failed refresh preflight'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO tasks_private.recurrence_contexts (
    backend_pid, transaction_id, owner_id
  )
  SELECT pg_backend_pid(), txid_current(), owners.owner_id
  FROM (
    SELECT DISTINCT owner_id
    FROM public.tasks_recurrence_revisions
  ) AS owners
  ON CONFLICT DO NOTHING;

  UPDATE public.tasks_recurrence_revisions
  SET prototype_snapshot = prototype_snapshot;

  GET DIAGNOSTICS _updated_count = ROW_COUNT;

  DELETE FROM tasks_private.recurrence_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current();

  SELECT count(*), md5(COALESCE(
    jsonb_agg(to_jsonb(revision) ORDER BY revision.id)::text,
    '[]'
  ))
  INTO _after_count, _after_digest
  FROM public.tasks_recurrence_revisions AS revision;

  IF _updated_count <> _before_count
    OR _after_count <> _before_count
    OR _after_digest IS DISTINCT FROM _before_digest THEN
    RAISE EXCEPTION 'Recurrence snapshot refresh changed stored recurrence data'
      USING ERRCODE = '23514';
  END IF;
END
$refresh_recurrence_snapshots$;
