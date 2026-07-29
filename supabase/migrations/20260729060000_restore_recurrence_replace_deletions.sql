-- Keep schema-13 replacement restore compatible with immutable derived rows.

CREATE OR REPLACE FUNCTION tasks_private.reject_template_immutable_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND (
      (SELECT auth.uid()) IS NULL
      OR tasks_private.in_restore_context(OLD.owner_id)
    ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Template revisions and instantiations are immutable'
    USING ERRCODE = '23514';
END
$$;

CREATE OR REPLACE FUNCTION tasks_private.reject_recurrence_immutable_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND EXISTS (
      SELECT 1
      FROM tasks_private.recurrence_contexts AS context
      WHERE context.backend_pid = pg_backend_pid()
        AND context.transaction_id = txid_current()
        AND context.owner_id = OLD.owner_id
    ) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE'
    AND (
      (SELECT auth.uid()) IS NULL
      OR tasks_private.in_restore_context(OLD.owner_id)
    ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Recurrence revisions, occurrences, and evaluations are immutable'
    USING ERRCODE = '23514';
END
$$;

CREATE OR REPLACE FUNCTION public.tasks_replace_restore_v13(
  _envelope jsonb,
  _expected_backup_digest text,
  _request_id uuid,
  _confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _target_digest text;
  _request_digest text;
  _receipt tasks_private.replace_restore_receipts;
  _backup jsonb;
  _backup_digest text;
  _restore_report jsonb;
  _result jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to replace task data'
      USING ERRCODE = '42501';
  END IF;
  IF _confirmation IS DISTINCT FROM 'REPLACE TASK DATA' THEN
    RAISE EXCEPTION 'Task replacement requires explicit confirmation'
      USING ERRCODE = '22023';
  END IF;
  IF _request_id IS NULL
    OR _expected_backup_digest IS NULL
    OR _expected_backup_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'The pre-restore backup input is invalid'
      USING ERRCODE = '22023';
  END IF;
  PERFORM tasks_private.validate_export_v13(_envelope);
  _target_digest := tasks_private.export_checksum(_envelope);
  _request_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'backup_digest', _expected_backup_digest,
    'target_digest', _target_digest
  )::text, 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO _receipt
  FROM tasks_private.replace_restore_receipts AS receipt
  WHERE receipt.request_id = _request_id
    AND receipt.owner_id = _owner_id;
  IF FOUND THEN
    IF _receipt.request_digest IS DISTINCT FROM _request_digest THEN
      RAISE EXCEPTION 'Task replacement request identifier was reused with different input'
        USING ERRCODE = '22023';
    END IF;
    RETURN _receipt.result;
  END IF;

  PERFORM tasks_private.lock_replace_restore_scope();
  PERFORM pg_advisory_xact_lock(
    hashtextextended('tasks-replace-restore:' || _owner_id::text, 0)
  );
  _backup := public.tasks_create_export_v13();
  _backup_digest := tasks_private.export_checksum(_backup - 'created_at');
  IF _backup_digest IS DISTINCT FROM _expected_backup_digest THEN
    RAISE EXCEPTION 'The pre-restore backup is stale' USING ERRCODE = '40001';
  END IF;

  SET CONSTRAINTS ALL DEFERRED;
  INSERT INTO tasks_private.restore_contexts (
    backend_pid, transaction_id, owner_id
  ) VALUES (
    pg_backend_pid(), txid_current(), _owner_id
  );

  DELETE FROM public.tasks_reminder_deliveries WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminder_claims WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminder_occurrences WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminders WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_mail_source_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_mail_sources WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_history_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_hierarchy_history_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_hierarchy_operations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_checklist_items WHERE owner_id = _owner_id;
  -- Materialized tasks own the outbound provenance references, so remove them
  -- before deleting the immutable recurrence and template records.
  DELETE FROM public.tasks_todos WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_status_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_evaluations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_occurrences WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_revisions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_definitions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_template_instantiations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_template_revisions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_templates WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_areas WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_user_settings WHERE owner_id = _owner_id;
  DELETE FROM tasks_private.permanent_deletion_receipts WHERE owner_id = _owner_id;
  DELETE FROM tasks_private.purged_creation_receipts WHERE owner_id = _owner_id;

  DELETE FROM tasks_private.restore_contexts
  WHERE backend_pid = pg_backend_pid()
    AND transaction_id = txid_current()
    AND owner_id = _owner_id;

  _restore_report := public.tasks_restore_export_v13(_envelope, false);
  IF COALESCE((_restore_report ->> 'applied')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Task replacement restore was rejected'
      USING ERRCODE = '40001', DETAIL = _restore_report::text;
  END IF;
  _result := jsonb_build_object(
    'outcome', 'accepted',
    'schema_version', 13,
    'request_id', _request_id,
    'backup_digest', _expected_backup_digest,
    'target_digest', _target_digest,
    'removed_counts', _backup #> '{manifest,counts}',
    'restore_report', _restore_report
  );
  INSERT INTO tasks_private.replace_restore_receipts (
    request_id, owner_id, request_digest, result
  ) VALUES (_request_id, _owner_id, _request_digest, _result);
  RETURN _result;
END
$$;

REVOKE ALL ON FUNCTION public.tasks_replace_restore_v13(
  jsonb, text, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tasks_replace_restore_v13(
  jsonb, text, uuid, text
) TO authenticated;
