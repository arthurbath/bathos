-- The native snapshot wire contract exposes only `mail` and `link`. Native
-- presentation derives Jira and Obsidian iconography from the approved href.
-- A prior server helper leaked presentation-specific `jira` and `obsidian`
-- values into the wire `kind`, causing strict native decoding to reject the
-- complete snapshot whenever either link type appeared in a projected list.

DO $migration$
DECLARE
  _definition text;
BEGIN
  SELECT pg_get_functiondef(
    'tasks_private.widget_primary_link(text)'::regprocedure
  ) INTO _definition;

  IF position(
    $expected$WHEN href ~* '^(jira:|https?://[^/]*atlassian\.)' THEN 'jira'$expected$
    IN _definition
  ) = 0
    OR position(
      $expected$WHEN href ~* '^obsidian:' THEN 'obsidian'$expected$
      IN _definition
    ) = 0 THEN
    RAISE EXCEPTION 'Unexpected native widget Primary Link serializer';
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION tasks_private.widget_primary_link(_value text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH normalized AS (
    SELECT CASE
      WHEN NULLIF(btrim(_value), '') IS NULL THEN NULL
      WHEN btrim(_value) ~* '^(https?|message|jira|obsidian):' THEN btrim(_value)
      WHEN btrim(_value) ~* '^[a-z][a-z0-9+.-]*:' THEN NULL
      ELSE 'https://' || btrim(_value)
    END AS href
  )
  SELECT CASE
    WHEN href IS NULL OR char_length(href) > 8000 THEN NULL
    ELSE jsonb_build_object(
      'href', href,
      'kind', CASE
        WHEN href ~* '^message:' THEN 'mail'
        ELSE 'link'
      END
    )
  END
  FROM normalized
$$;

REVOKE ALL ON FUNCTION tasks_private.widget_primary_link(text)
FROM PUBLIC, anon, authenticated, service_role;
