-- Add is_test_user flag to profiles for QA/testing account segmentation
ALTER TABLE public.bathos_profiles
ADD COLUMN is_test_user boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bathos_profiles.is_test_user IS
'Marks QA/testing accounts. Defaults to false; art+*@bath.garden signup variants are true.';

-- Backfill existing users:
-- only qa1 and qa2 should be true, all other current users false
UPDATE public.bathos_profiles p
SET is_test_user = CASE
  WHEN lower(u.email) IN ('art+qa1@bath.garden', 'art+qa2@bath.garden') THEN true
  ELSE false
END
FROM auth.users u
WHERE u.id = p.id;

-- Update signup trigger so future users get the right default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  terms_version text;
  is_test_user_flag boolean;
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

  -- art+<anything>@bath.garden accounts are considered test users
  is_test_user_flag := lower(COALESCE(NEW.email, '')) LIKE 'art+_%@bath.garden';

  INSERT INTO public.bathos_profiles (id, display_name, terms_version_accepted, is_test_user)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    terms_version,
    is_test_user_flag
  );
  RETURN NEW;
END;
$function$;
