-- Native snapshot validation correctly rejects titleless tasks. Legacy retired
-- rows can nevertheless contain an empty title, and including even one of
-- those rows invalidates the complete five-list payload. Omit malformed
-- candidates at both projection entry points while leaving native validation
-- strict. Replace only the known fragments and abort on schema drift.

DO $migration$
DECLARE
  _definition text;
  _updated text;
  _ordinary_filter text := $old$
    WHERE task.owner_id = _owner_id
      AND task.recurrence_superseded_at IS NULL$old$;
  _valid_ordinary_filter text := $new$
    WHERE task.owner_id = _owner_id
      AND task.recurrence_superseded_at IS NULL
      AND btrim(task.title) <> ''$new$;
  _prototype_filter text := $old$
    WHERE definition.owner_id = _owner_id
      AND definition.status = 'active'$old$;
  _valid_prototype_filter text := $new$
    WHERE definition.owner_id = _owner_id
      AND definition.status = 'active'
      AND btrim(COALESCE(
        revision.prototype_snapshot #>> '{root,title}',
        ''
      )) <> ''$new$;
BEGIN
  SELECT pg_get_functiondef(
    'tasks_private.build_widget_list_projection_without_row_context(uuid,text,date,boolean,text)'
      ::regprocedure
  ) INTO _definition;

  IF (
    char_length(_definition)
    - char_length(replace(_definition, _ordinary_filter, ''))
  ) <> char_length(_ordinary_filter) THEN
    RAISE EXCEPTION 'Unexpected base widget projection candidate definition';
  END IF;

  _updated := replace(
    _definition,
    _ordinary_filter,
    _valid_ordinary_filter
  );

  EXECUTE _updated;

  SELECT pg_get_functiondef(
    'tasks_private.build_widget_list_projection(uuid,text,date,boolean,text)'
      ::regprocedure
  ) INTO _definition;

  IF (
    char_length(_definition)
    - char_length(replace(_definition, _ordinary_filter, ''))
  ) <> char_length(_ordinary_filter)
    OR (
      char_length(_definition)
      - char_length(replace(_definition, _prototype_filter, ''))
    ) <> char_length(_prototype_filter) THEN
    RAISE EXCEPTION 'Unexpected Upcoming widget projection candidate definition';
  END IF;

  _updated := replace(
    _definition,
    _ordinary_filter,
    _valid_ordinary_filter
  );
  _updated := replace(
    _updated,
    _prototype_filter,
    _valid_prototype_filter
  );

  EXECUTE _updated;
END
$migration$;
