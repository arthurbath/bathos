-- Native Swift UUID encoding may use uppercase hexadecimal characters.
-- UUID text is case-insensitive, so the Quick Entry authority must accept
-- either representation while retaining the exact UUID shape constraint.
DO $migration$
DECLARE
  _function regprocedure :=
    'public.tasks_create_from_native_quick_entry(text,jsonb)'::regprocedure;
  _definition text;
  _lowercase_pattern constant text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  _case_insensitive_pattern constant text :=
    '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-5][0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$';
BEGIN
  SELECT pg_get_functiondef(_function)
  INTO STRICT _definition;

  IF position(_case_insensitive_pattern IN _definition) > 0 THEN
    RETURN;
  END IF;

  IF position(_lowercase_pattern IN _definition) = 0 THEN
    RAISE EXCEPTION
      'Native Quick Entry authority drifted before checklist UUID compatibility migration';
  END IF;

  _definition := replace(
    _definition,
    _lowercase_pattern,
    _case_insensitive_pattern
  );
  EXECUTE _definition;
END
$migration$;

COMMENT ON FUNCTION public.tasks_create_from_native_quick_entry(text, jsonb) IS
  'Creates one complete native Quick Entry task atomically and idempotently; accepts canonical UUID text regardless of hexadecimal letter casing.';
