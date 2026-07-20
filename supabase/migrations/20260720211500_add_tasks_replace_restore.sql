-- Guarded current-schema replacement restore with a verified pre-restore backup.

CREATE TABLE tasks_private.replace_restore_receipts (
  request_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (request_id, owner_id)
);

REVOKE ALL ON TABLE tasks_private.replace_restore_receipts
FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE tasks_private.replace_restore_receipts TO service_role;

CREATE OR REPLACE FUNCTION tasks_private.export_v10_digest(_envelope jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT encode(
    extensions.digest(
      convert_to((_envelope - 'created_at')::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

REVOKE ALL ON FUNCTION tasks_private.export_v10_digest(jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION tasks_private.lock_replace_restore_scope()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  LOCK TABLE
    public.tasks_areas,
    public.tasks_projects,
    public.tasks_headings,
    public.tasks_todos,
    public.tasks_checklist_items,
    public.tasks_history_events,
    public.tasks_hierarchy_operations,
    public.tasks_hierarchy_history_events,
    public.tasks_user_settings,
    public.tasks_mail_sources,
    public.tasks_mail_source_events,
    public.tasks_templates,
    public.tasks_template_revisions,
    public.tasks_template_instantiations,
    public.tasks_recurrence_definitions,
    public.tasks_recurrence_revisions,
    public.tasks_recurrence_occurrences,
    public.tasks_recurrence_evaluations,
    public.tasks_recurrence_status_events,
    public.tasks_reminders,
    public.tasks_reminder_occurrences,
    public.tasks_reminder_deliveries,
    public.tasks_reminder_claims,
    tasks_private.permanent_deletion_receipts,
    tasks_private.replace_restore_receipts
  IN SHARE ROW EXCLUSIVE MODE;
END;
$$;

REVOKE ALL ON FUNCTION tasks_private.lock_replace_restore_scope()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_prepare_replace_restore(
  _envelope jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner_id uuid := auth.uid();
  _backup jsonb;
  _restore_preview jsonb;
BEGIN
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to prepare task replacement'
      USING ERRCODE = '42501';
  END IF;
  PERFORM tasks_private.validate_export_v10(_envelope);
  PERFORM tasks_private.lock_replace_restore_scope();
  PERFORM pg_advisory_xact_lock(hashtextextended('tasks-replace-restore:' || _owner_id::text, 0));

  _backup := public.tasks_create_export_v10();
  PERFORM tasks_private.validate_export_v10(_backup);
  _restore_preview := public.tasks_restore_export_v10(_envelope, true);

  RETURN jsonb_build_object(
    'schema_version', 10,
    'backup', _backup,
    'backup_digest', tasks_private.export_v10_digest(_backup),
    'current_counts', _backup #> '{manifest,counts}',
    'incoming_counts', _envelope #> '{manifest,counts}',
    'restore_preview', _restore_preview
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_prepare_replace_restore(jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_prepare_replace_restore(jsonb)
TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_replace_restore_v10(
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
  _current_backup jsonb;
  _current_digest text;
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
  IF _expected_backup_digest IS NULL
    OR _expected_backup_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'The pre-restore backup digest is invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM tasks_private.validate_export_v10(_envelope);
  _target_digest := tasks_private.export_v10_digest(_envelope);
  _request_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'backup_digest', _expected_backup_digest,
          'target_digest', _target_digest
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

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
  PERFORM pg_advisory_xact_lock(hashtextextended('tasks-replace-restore:' || _owner_id::text, 0));

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

  _current_backup := public.tasks_create_export_v10();
  PERFORM tasks_private.validate_export_v10(_current_backup);
  _current_digest := tasks_private.export_v10_digest(_current_backup);
  IF _current_digest IS DISTINCT FROM _expected_backup_digest THEN
    RAISE EXCEPTION 'The pre-restore backup is stale'
      USING ERRCODE = '40001';
  END IF;

  SET CONSTRAINTS ALL DEFERRED;

  DELETE FROM public.tasks_reminder_deliveries WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminder_claims WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminder_occurrences WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_reminders WHERE owner_id = _owner_id;

  DELETE FROM public.tasks_recurrence_status_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_evaluations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_occurrences WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_revisions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_recurrence_definitions WHERE owner_id = _owner_id;

  DELETE FROM public.tasks_template_instantiations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_template_revisions WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_templates WHERE owner_id = _owner_id;

  DELETE FROM public.tasks_mail_source_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_mail_sources WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_history_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_hierarchy_history_events WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_hierarchy_operations WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_checklist_items WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_todos WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_headings WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_projects WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_areas WHERE owner_id = _owner_id;
  DELETE FROM public.tasks_user_settings WHERE owner_id = _owner_id;
  DELETE FROM tasks_private.permanent_deletion_receipts WHERE owner_id = _owner_id;

  _restore_report := public.tasks_restore_export_v10(_envelope, false);
  IF COALESCE((_restore_report ->> 'applied')::boolean, false) IS NOT TRUE
    AND COALESCE(_restore_report ->> 'code', '') <> 'already_applied' THEN
    RAISE EXCEPTION 'Task replacement restore was rejected'
      USING ERRCODE = '40001', DETAIL = _restore_report::text;
  END IF;

  _result := jsonb_build_object(
    'outcome', 'accepted',
    'schema_version', 10,
    'request_id', _request_id,
    'backup_digest', _expected_backup_digest,
    'target_digest', _target_digest,
    'removed_counts', _current_backup #> '{manifest,counts}',
    'restore_report', _restore_report
  );

  INSERT INTO tasks_private.replace_restore_receipts (
    request_id, owner_id, request_digest, result
  ) VALUES (
    _request_id, _owner_id, _request_digest, _result
  );

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_replace_restore_v10(
  jsonb, text, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_replace_restore_v10(
  jsonb, text, uuid, text
) TO authenticated;
