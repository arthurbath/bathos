-- Preserve the existing scalar preference values for cached clients while
-- adding the two non-empty actionability combinations that the multi-select
-- cannot otherwise represent.

ALTER TABLE public.bathos_user_settings
DROP CONSTRAINT bathos_user_settings_tasks_quick_filter_valid;

ALTER TABLE public.bathos_user_settings
ADD CONSTRAINT bathos_user_settings_tasks_quick_filter_valid
CHECK (
  tasks_quick_filter IN (
    'all',
    'actionable',
    'non_actionable',
    'actionable_waiting',
    'actionable_rechecking',
    'rechecking',
    'waiting'
  )
);

CREATE OR REPLACE FUNCTION tasks_private.task_matches_quick_filter(
  _quick_filter text,
  _actionability text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE _quick_filter
    WHEN 'all' THEN true
    WHEN 'actionable' THEN _actionability = 'actionable'
    WHEN 'non_actionable' THEN _actionability IN ('waiting', 'rechecking')
    WHEN 'actionable_waiting' THEN _actionability IN ('actionable', 'waiting')
    WHEN 'actionable_rechecking' THEN _actionability IN ('actionable', 'rechecking')
    WHEN 'rechecking' THEN _actionability = 'rechecking'
    WHEN 'waiting' THEN _actionability = 'waiting'
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION tasks_private.task_matches_quick_filter(text, text)
FROM PUBLIC, anon, authenticated, service_role;

-- The widget projection functions predate the shared predicate. Replace only
-- their guarded filter clauses and abort if the expected deployed definitions
-- have drifted, keeping the remainder of their bounded ordering logic intact.
DO $migration$
DECLARE
  _definition text;
  _updated text;
  _ordinary_filter text := $old$
      AND (
        _quick_filter = 'all'
        OR (_quick_filter = 'actionable' AND task.actionability = 'actionable')
        OR (_quick_filter = 'non_actionable' AND task.actionability <> 'actionable')
        OR (_quick_filter = 'rechecking' AND task.actionability = 'rechecking')
        OR (_quick_filter = 'waiting' AND task.actionability = 'waiting')
      )$old$;
  _ordinary_replacement text := $new$
      AND tasks_private.task_matches_quick_filter(
        _quick_filter,
        task.actionability
      )$new$;
  _prototype_filter text := $old$
      AND (
        _quick_filter = 'all'
        OR (
          _quick_filter = 'actionable'
          AND COALESCE(
            revision.prototype_snapshot #>> '{root,actionability}',
            'actionable'
          ) = 'actionable'
        )
        OR (
          _quick_filter = 'non_actionable'
          AND COALESCE(
            revision.prototype_snapshot #>> '{root,actionability}',
            'actionable'
          ) <> 'actionable'
        )
        OR (
          _quick_filter IN ('rechecking', 'waiting')
          AND revision.prototype_snapshot #>> '{root,actionability}' = _quick_filter
        )
      )$old$;
  _prototype_replacement text := $new$
      AND tasks_private.task_matches_quick_filter(
        _quick_filter,
        COALESCE(
          revision.prototype_snapshot #>> '{root,actionability}',
          'actionable'
        )
      )$new$;
  _supported_filter_list text := $old$
      'all',
      'actionable',
      'non_actionable',
      'rechecking',
      'waiting'
    )$old$;
  _expanded_filter_list text := $new$
      'all',
      'actionable',
      'non_actionable',
      'actionable_waiting',
      'actionable_rechecking',
      'rechecking',
      'waiting'
    )$new$;
BEGIN
  SELECT pg_get_functiondef(
    'tasks_private.build_widget_list_projection_without_row_context(uuid,text,date,boolean,text)'
      ::regprocedure
  ) INTO _definition;
  _updated := replace(_definition, _ordinary_filter, _ordinary_replacement);
  IF _updated = _definition THEN
    RAISE EXCEPTION 'Unexpected widget projection filter definition';
  END IF;
  EXECUTE _updated;

  SELECT pg_get_functiondef(
    'tasks_private.build_widget_list_projection(uuid,text,date,boolean,text)'::regprocedure
  ) INTO _definition;
  _updated := replace(_definition, _ordinary_filter, _ordinary_replacement);
  _updated := replace(_updated, _prototype_filter, _prototype_replacement);
  IF _updated = _definition
    OR position(_ordinary_filter IN _updated) > 0
    OR position(_prototype_filter IN _updated) > 0 THEN
    RAISE EXCEPTION 'Unexpected upcoming widget projection filter definition';
  END IF;
  EXECUTE _updated;

  SELECT pg_get_functiondef(
    'public.tasks_read_widget_snapshot(text)'::regprocedure
  ) INTO _definition;
  _updated := replace(
    _definition,
    _supported_filter_list,
    _expanded_filter_list
  );
  IF _updated = _definition THEN
    RAISE EXCEPTION 'Unexpected widget snapshot filter sanitizer definition';
  END IF;
  EXECUTE _updated;
END
$migration$;
