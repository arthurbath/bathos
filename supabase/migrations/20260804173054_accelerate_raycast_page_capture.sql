CREATE OR REPLACE FUNCTION public.tasks_create_raycast_page_capture(
  _idempotency_key uuid,
  _title text,
  _url text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.tasks_create_mcp_task(
    _idempotency_key,
    _title,
    '',
    'anytime',
    'inbox',
    'actionable',
    'browser_capture',
    NULL,
    false,
    NULL,
    NULL,
    'webpage',
    _url,
    NULL,
    NULL,
    _url
  );
$$;

REVOKE ALL ON FUNCTION public.tasks_create_raycast_page_capture(
  uuid, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.tasks_create_raycast_page_capture(
  uuid, text, text
) TO authenticated;

COMMENT ON FUNCTION public.tasks_create_raycast_page_capture(uuid, text, text)
IS 'Creates an owner-scoped Raycast webpage task with fixed Tasks placement and provenance.';
