-- A bounded widget projection must select the genuinely next Upcoming rows.
-- The previous implementation collapsed dates beyond seven days into broad
-- month/year keys before applying Upcoming rank, which allowed a later task
-- with an earlier rank to displace a nearer task from the widget's leading ten.
-- Replace only the known ordering fragment and abort on schema drift.

DO $migration$
DECLARE
  _definition text;
  _updated text;
  _bucket_order text := $old$
          CASE
            WHEN candidate.upcoming_date <= _planning_date + 7
              THEN candidate.upcoming_date
            WHEN candidate.upcoming_date
              <= (_planning_date + interval '12 months')::date
              THEN date_trunc('month', candidate.upcoming_date)::date
            ELSE date_trunc('year', candidate.upcoming_date)::date
          END,
          candidate.upcoming_order_key COLLATE "C",
          candidate.id$old$;
  _controlling_date_order text := $new$
          candidate.upcoming_date,
          candidate.upcoming_order_key COLLATE "C",
          candidate.id$new$;
BEGIN
  SELECT pg_get_functiondef(
    'tasks_private.build_widget_list_projection(uuid,text,date,boolean,text)'
      ::regprocedure
  ) INTO _definition;

  _updated := replace(
    _definition,
    _bucket_order,
    _controlling_date_order
  );

  IF _updated = _definition
    OR position(_bucket_order IN _updated) > 0 THEN
    RAISE EXCEPTION 'Unexpected Upcoming widget projection ordering definition';
  END IF;

  EXECUTE _updated;
END
$migration$;
