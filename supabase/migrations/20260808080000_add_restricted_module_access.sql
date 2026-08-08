CREATE TABLE public.bathos_modules (
  module_id text PRIMARY KEY,
  display_name text NOT NULL,
  is_restricted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.bathos_module_access_grants (
  module_id text NOT NULL REFERENCES public.bathos_modules(module_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_source text NOT NULL CHECK (grant_source IN ('manual', 'admin_role')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (module_id, user_id, grant_source)
);

CREATE INDEX bathos_module_access_grants_user_module_idx
ON public.bathos_module_access_grants (user_id, module_id);

ALTER TABLE public.bathos_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bathos_module_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY bathos_modules_authenticated_select
ON public.bathos_modules FOR SELECT TO authenticated
USING (true);

CREATE POLICY bathos_module_access_grants_own_select
ON public.bathos_module_access_grants FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON public.bathos_modules TO authenticated;
GRANT SELECT ON public.bathos_module_access_grants TO authenticated;

CREATE OR REPLACE FUNCTION public.bathos_can_access_module(
  _module_id text,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL AND COALESCE((
    SELECT
      NOT module.is_restricted
      OR public.has_role(_user_id, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.bathos_module_access_grants grant_row
        WHERE grant_row.module_id = module.module_id
          AND grant_row.user_id = _user_id
      )
    FROM public.bathos_modules module
    WHERE module.module_id = _module_id
  ), false)
$$;

REVOKE ALL ON FUNCTION public.bathos_can_access_module(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bathos_can_access_module(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bathos_sync_admin_module_grants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _new_is_admin boolean := false;
  _old_is_admin boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _user_id := NEW.user_id;
    _new_is_admin := NEW.role = 'admin'::public.app_role;
  ELSIF TG_OP = 'DELETE' THEN
    _user_id := OLD.user_id;
    _old_is_admin := OLD.role = 'admin'::public.app_role;
  ELSE
    _user_id := NEW.user_id;
    _new_is_admin := NEW.role = 'admin'::public.app_role;
    _old_is_admin := OLD.role = 'admin'::public.app_role;
  END IF;

  IF _new_is_admin THEN
    INSERT INTO public.bathos_module_access_grants (
      module_id, user_id, grant_source, granted_by
    )
    SELECT module_id, _user_id, 'admin_role', _user_id
    FROM public.bathos_modules
    WHERE is_restricted
    ON CONFLICT (module_id, user_id, grant_source) DO NOTHING;
  END IF;

  IF _old_is_admin AND NOT _new_is_admin THEN
    DELETE FROM public.bathos_module_access_grants
    WHERE user_id = _user_id
      AND grant_source = 'admin_role';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bathos_user_roles_sync_module_grants
AFTER INSERT OR UPDATE OR DELETE ON public.bathos_user_roles
FOR EACH ROW EXECUTE FUNCTION public.bathos_sync_admin_module_grants();

CREATE OR REPLACE FUNCTION public.bathos_sync_restricted_module_admin_grants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_restricted THEN
    INSERT INTO public.bathos_module_access_grants (
      module_id, user_id, grant_source, granted_by
    )
    SELECT NEW.module_id, role_row.user_id, 'admin_role', NEW.updated_by
    FROM public.bathos_user_roles role_row
    WHERE role_row.role = 'admin'::public.app_role
    ON CONFLICT (module_id, user_id, grant_source) DO NOTHING;
  ELSE
    DELETE FROM public.bathos_module_access_grants
    WHERE module_id = NEW.module_id
      AND grant_source = 'admin_role';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bathos_modules_sync_admin_grants
AFTER INSERT OR UPDATE OF is_restricted ON public.bathos_modules
FOR EACH ROW EXECUTE FUNCTION public.bathos_sync_restricted_module_admin_grants();

INSERT INTO public.bathos_modules (module_id, display_name, is_restricted)
VALUES
  ('budget', 'Budget', false),
  ('drawers', 'Drawers', false),
  ('garage', 'Garage', false),
  ('snake', 'Snake', false),
  ('tasks', 'Tasks', true),
  ('wardrobe', 'Wardrobe', false)
ON CONFLICT (module_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    is_restricted = CASE
      WHEN EXCLUDED.module_id = 'tasks' THEN true
      ELSE public.bathos_modules.is_restricted
    END,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.bathos_read_current_module_access()
RETURNS TABLE (
  module_id text,
  is_restricted boolean,
  has_access boolean,
  has_explicit_access boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    module.module_id,
    module.is_restricted,
    public.bathos_can_access_module(module.module_id, auth.uid()),
    EXISTS (
      SELECT 1
      FROM public.bathos_module_access_grants grant_row
      WHERE grant_row.module_id = module.module_id
        AND grant_row.user_id = auth.uid()
        AND grant_row.grant_source = 'manual'
    )
  FROM public.bathos_modules module
  WHERE auth.uid() IS NOT NULL
  ORDER BY module.display_name
$$;

REVOKE ALL ON FUNCTION public.bathos_read_current_module_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bathos_read_current_module_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.bathos_admin_list_module_access()
RETURNS TABLE (
  module_id text,
  module_name text,
  is_restricted boolean,
  user_id uuid,
  user_email text,
  display_name text,
  is_admin boolean,
  has_explicit_access boolean,
  has_access boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access is required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    module.module_id,
    module.display_name,
    module.is_restricted,
    user_row.id,
    user_row.email::text,
    COALESCE(profile.display_name, user_row.email)::text,
    public.has_role(user_row.id, 'admin'::public.app_role),
    EXISTS (
      SELECT 1
      FROM public.bathos_module_access_grants grant_row
      WHERE grant_row.module_id = module.module_id
        AND grant_row.user_id = user_row.id
        AND grant_row.grant_source = 'manual'
    ),
    public.bathos_can_access_module(module.module_id, user_row.id)
  FROM public.bathos_modules module
  CROSS JOIN auth.users user_row
  LEFT JOIN public.bathos_profiles profile ON profile.id = user_row.id
  ORDER BY module.display_name, COALESCE(profile.display_name, user_row.email);
END;
$$;

REVOKE ALL ON FUNCTION public.bathos_admin_list_module_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bathos_admin_list_module_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.bathos_admin_set_module_restricted(
  _module_id text,
  _is_restricted boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access is required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.bathos_modules
  SET is_restricted = _is_restricted,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE module_id = _module_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown BathOS module: %', _module_id USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bathos_admin_set_module_restricted(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bathos_admin_set_module_restricted(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.bathos_admin_set_module_user_access(
  _module_id text,
  _user_id uuid,
  _has_access boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Administrator access is required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bathos_modules
    WHERE module_id = _module_id AND is_restricted
  ) THEN
    RAISE EXCEPTION 'Module is not restricted: %', _module_id USING ERRCODE = '22023';
  END IF;

  IF _has_access THEN
    INSERT INTO public.bathos_module_access_grants (
      module_id, user_id, grant_source, granted_by
    ) VALUES (
      _module_id, _user_id, 'manual', auth.uid()
    )
    ON CONFLICT (module_id, user_id, grant_source)
    DO UPDATE SET granted_by = EXCLUDED.granted_by, granted_at = now();
  ELSE
    DELETE FROM public.bathos_module_access_grants
    WHERE module_id = _module_id
      AND user_id = _user_id
      AND grant_source = 'manual';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bathos_admin_set_module_user_access(text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bathos_admin_set_module_user_access(text, uuid, boolean) TO authenticated;

-- Apply the module entitlement to every existing Tasks table policy while preserving
-- each policy's original owner/action predicate.
DO $tasks_policy_access$
DECLARE
  policy_row record;
  using_expression text;
  check_expression text;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'tasks\_%' ESCAPE '\'
  LOOP
    using_expression := CASE
      WHEN policy_row.qual IS NULL THEN NULL
      ELSE format('(%s) AND public.bathos_can_access_module(''tasks'', auth.uid())', policy_row.qual)
    END;
    check_expression := CASE
      WHEN policy_row.with_check IS NULL THEN NULL
      ELSE format('(%s) AND public.bathos_can_access_module(''tasks'', auth.uid())', policy_row.with_check)
    END;

    IF using_expression IS NOT NULL AND check_expression IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        using_expression,
        check_expression
      );
    ELSIF using_expression IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        using_expression
      );
    ELSIF check_expression IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        check_expression
      );
    END IF;
  END LOOP;
END;
$tasks_policy_access$;

DO $powersync_access_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tasks_powersync_role') THEN
    GRANT SELECT ON public.bathos_module_access_grants TO tasks_powersync_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'powersync'
        AND schemaname = 'public'
        AND tablename = 'bathos_module_access_grants'
    ) THEN
    ALTER PUBLICATION powersync ADD TABLE public.bathos_module_access_grants;
  END IF;
END;
$powersync_access_grants$;

ALTER TABLE public.bathos_module_access_grants REPLICA IDENTITY FULL;
