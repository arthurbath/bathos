-- Let schema-thirteen validation project adopted recurrence occurrences into
-- Canonicalized to the production migration ledger version.
-- the legacy schema-twelve graph without requiring a real template
-- instantiation for work that was intentionally adopted in place.
--
-- This changes validation only. The schema-thirteen export and restore retain
-- the adopted occurrence with a null template_instantiation_id.

CREATE OR REPLACE FUNCTION tasks_private.export_v13_as_v12_for_validation(
  _envelope jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  _collection text;
  _records jsonb;
  _adopted_instances jsonb;
  _data jsonb := '{}'::jsonb;
  _counts jsonb := '{}'::jsonb;
  _checksums jsonb := jsonb_build_object('algorithm', 'sha256');
  _collections constant text[] := ARRAY[
    'tasks_areas', 'tasks_projects', 'tasks_todos', 'tasks_checklist_items',
    'tasks_history_events', 'tasks_hierarchy_operations',
    'tasks_hierarchy_history_events', 'tasks_user_settings',
    'tasks_mail_sources', 'tasks_mail_source_events',
    'tasks_templates', 'tasks_template_revisions',
    'tasks_template_instantiations', 'tasks_recurrence_definitions',
    'tasks_recurrence_revisions', 'tasks_recurrence_occurrences',
    'tasks_recurrence_evaluations', 'tasks_recurrence_status_events',
    'tasks_reminders', 'tasks_reminder_occurrences'
  ];
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', 'adopted-validation:' || (occurrence.value ->> 'id'),
        'template_id', revision.value ->> 'template_id',
        'template_revision', revision.value -> 'template_revision',
        'anchor_date', occurrence.value -> 'scheduled_date',
        'entry_channel', 'import',
        'actor_type', 'import',
        'target_area_id', 'null'::jsonb,
        'root_type', occurrence.value ->> 'root_type',
        'root_id', occurrence.value ->> 'root_id',
        'result', jsonb_build_object(
          'root_type', occurrence.value ->> 'root_type',
          'root_id', occurrence.value ->> 'root_id'
        ),
        'client_mutation_id', occurrence.value -> 'client_mutation_id',
        'created_at', occurrence.value -> 'generated_at'
      )
      ORDER BY occurrence.value ->> 'id'
    ),
    '[]'::jsonb
  )
  INTO _adopted_instances
  FROM jsonb_array_elements(
    COALESCE(
      _envelope #> '{data,tasks_recurrence_occurrences}',
      '[]'::jsonb
    )
  ) AS occurrence(value)
  JOIN jsonb_array_elements(
    COALESCE(
      _envelope #> '{data,tasks_recurrence_revisions}',
      '[]'::jsonb
    )
  ) AS revision(value)
    ON revision.value ->> 'recurrence_id'
      = occurrence.value ->> 'recurrence_id'
   AND revision.value ->> 'revision'
      = occurrence.value ->> 'recurrence_revision'
  WHERE occurrence.value ->> 'origin' = 'adopted'
    OR occurrence.value ->> 'template_instantiation_id' IS NULL;

  FOREACH _collection IN ARRAY _collections LOOP
    IF _collection = 'tasks_projects' THEN
      _records := '[]'::jsonb;
    ELSIF _collection = 'tasks_todos' THEN
      SELECT COALESCE(
        jsonb_agg(
          record || jsonb_build_object('project_id', NULL)
          ORDER BY record ->> 'id'
        ),
        '[]'::jsonb
      )
      INTO _records
      FROM jsonb_array_elements(
        COALESCE(_envelope #> '{data,tasks_todos}', '[]'::jsonb)
      ) AS record;
    ELSIF _collection = 'tasks_reminders' THEN
      SELECT COALESCE(
        jsonb_agg(
          record || jsonb_build_object('project_id', NULL)
          ORDER BY record ->> 'id'
        ),
        '[]'::jsonb
      )
      INTO _records
      FROM jsonb_array_elements(
        COALESCE(_envelope #> '{data,tasks_reminders}', '[]'::jsonb)
      ) AS record;
    ELSIF _collection = 'tasks_template_instantiations' THEN
      SELECT COALESCE(
        jsonb_agg(record ORDER BY record ->> 'id'),
        '[]'::jsonb
      )
      INTO _records
      FROM (
        SELECT value AS record
        FROM jsonb_array_elements(
          COALESCE(
            _envelope #> '{data,tasks_template_instantiations}',
            '[]'::jsonb
          )
        )
        UNION ALL
        SELECT value AS record
        FROM jsonb_array_elements(_adopted_instances)
      ) AS instances;
    ELSIF _collection = 'tasks_recurrence_occurrences' THEN
      SELECT COALESCE(
        jsonb_agg(
          CASE
            WHEN record ->> 'origin' = 'adopted'
              OR record ->> 'template_instantiation_id' IS NULL
            THEN record || jsonb_build_object(
              'template_instantiation_id',
              'adopted-validation:' || (record ->> 'id')
            )
            ELSE record
          END
          ORDER BY record ->> 'id'
        ),
        '[]'::jsonb
      )
      INTO _records
      FROM jsonb_array_elements(
        COALESCE(
          _envelope #> '{data,tasks_recurrence_occurrences}',
          '[]'::jsonb
        )
      ) AS record;
    ELSE
      _records := COALESCE(
        _envelope #> ARRAY['data', _collection],
        '[]'::jsonb
      );
    END IF;
    _data := _data || jsonb_build_object(_collection, _records);
    _counts := _counts
      || jsonb_build_object(_collection, jsonb_array_length(_records));
    _checksums := _checksums || jsonb_build_object(
      _collection, tasks_private.export_checksum(_records)
    );
  END LOOP;
  RETURN jsonb_build_object(
    'format', 'garden.bath.tasks.export',
    'schema_version', 12,
    'created_at', _envelope -> 'created_at',
    'manifest', jsonb_build_object(
      'collections', to_jsonb(_collections),
      'counts', _counts,
      'checksums', _checksums
    ),
    'data', _data
  );
END
$$;

REVOKE ALL ON FUNCTION tasks_private.export_v13_as_v12_for_validation(jsonb)
FROM PUBLIC, anon, authenticated;
