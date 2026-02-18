
-- Add terms_version_accepted column to bathos_profiles
ALTER TABLE public.bathos_profiles 
ADD COLUMN terms_version_accepted text DEFAULT NULL;

COMMENT ON COLUMN public.bathos_profiles.terms_version_accepted IS 'Semantic version of TOS/PP the user last agreed to';

-- Create bathos_terms_versions table
CREATE TABLE public.bathos_terms_versions (
  version text PRIMARY KEY,
  change_description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bathos_terms_versions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read terms versions
CREATE POLICY "Authenticated users can view terms versions"
ON public.bathos_terms_versions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Also allow anon to read (for /terms page before sign-up)
CREATE POLICY "Anonymous users can view terms versions"
ON public.bathos_terms_versions
FOR SELECT
USING (true);

-- Seed initial version
INSERT INTO public.bathos_terms_versions (version, change_description, created_at) VALUES
  ('1.0.0', 'Initial Terms of Service and Privacy Policy for BathOS.', now());

-- Update handle_new_user to store terms_version_accepted from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  terms_version text;
BEGIN
  -- Get terms version from user metadata if available, default to latest
  terms_version := COALESCE(
    NEW.raw_user_meta_data->>'terms_version_accepted',
    (SELECT version FROM public.bathos_terms_versions ORDER BY 
      split_part(version, '.', 1)::int DESC,
      split_part(version, '.', 2)::int DESC,
      split_part(version, '.', 3)::int DESC
    LIMIT 1)
  );

  INSERT INTO public.bathos_profiles (id, display_name, terms_version_accepted)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    terms_version
  );
  RETURN NEW;
END;
$function$;
