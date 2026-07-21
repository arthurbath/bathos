-- Replacement preparation is read-only. Keep its export and dry-run validation
-- on one statement snapshot without taking the global write lock used by the
-- separately confirmed destructive transaction.

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
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_prepare_replace_restore(jsonb)
TO authenticated;
