-- Native badge presentation must represent the complete Today list, not the
-- subset currently visible through the user's widget quick filter. Preserve
-- the filtered list projection for widget rows while publishing one dedicated
-- unfiltered Today count in the existing schema-version-2 snapshot.

DO $migration$
DECLARE
  _definition text;
  _updated text;
  _anchor text := $old$
    'planningDate', _planning_date,
    'lists', jsonb_build_array($old$;
  _replacement text := $new$
    'planningDate', _planning_date,
    'todayTotalCount', (
      tasks_private.build_widget_list_projection(
        _credential.owner_id,
        'today',
        _planning_date,
        _automatic_list_sorting,
        'all'
      ) ->> 'totalCount'
    )::integer,
    'lists', jsonb_build_array($new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.tasks_read_widget_snapshot(text)'::regprocedure
  ) INTO _definition;

  IF (
    char_length(_definition)
    - char_length(replace(_definition, _anchor, ''))
  ) <> char_length(_anchor) THEN
    RAISE EXCEPTION 'Unexpected native widget snapshot response definition';
  END IF;

  _updated := replace(_definition, _anchor, _replacement);
  EXECUTE _updated;
END
$migration$;
