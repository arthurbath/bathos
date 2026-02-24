-- Delete specific test users and all related records
DO $$
DECLARE
  target_email text;
  target_user_id uuid;
  budget_membership record;
  drawers_membership record;
  member_count integer;
BEGIN
  FOREACH target_email IN ARRAY ARRAY[
    'arthurbath+test@icloud.com',
    'arthurbath+test2@icloud.com'
  ]
  LOOP
    target_user_id := NULL;

    SELECT u.id
    INTO target_user_id
    FROM auth.users u
    WHERE lower(u.email) = lower(target_email)
    LIMIT 1;

    IF target_user_id IS NULL THEN
      RAISE NOTICE 'User % not found. Skipping.', target_email;
      CONTINUE;
    END IF;

    -- Budget module cleanup:
    -- if user is sole member of a household, delete the household (cascades module data);
    -- otherwise only remove their membership.
    FOR budget_membership IN
      SELECT household_id
      FROM public.budget_household_members
      WHERE user_id = target_user_id
    LOOP
      SELECT count(*)
      INTO member_count
      FROM public.budget_household_members
      WHERE household_id = budget_membership.household_id;

      IF member_count = 1 THEN
        DELETE FROM public.budget_households
        WHERE id = budget_membership.household_id;
      ELSE
        DELETE FROM public.budget_household_members
        WHERE household_id = budget_membership.household_id
          AND user_id = target_user_id;
      END IF;
    END LOOP;

    -- Drawers module cleanup using the same sole-member rule.
    FOR drawers_membership IN
      SELECT household_id
      FROM public.drawers_household_members
      WHERE user_id = target_user_id
    LOOP
      SELECT count(*)
      INTO member_count
      FROM public.drawers_household_members
      WHERE household_id = drawers_membership.household_id;

      IF member_count = 1 THEN
        DELETE FROM public.drawers_households
        WHERE id = drawers_membership.household_id;
      ELSE
        DELETE FROM public.drawers_household_members
        WHERE household_id = drawers_membership.household_id
          AND user_id = target_user_id;
      END IF;
    END LOOP;

    -- Non-FK table cleanup.
    DELETE FROM public.bathos_feedback
    WHERE user_id = target_user_id;

    -- FK-backed data in bathos_profiles, bathos_user_roles, bathos_user_settings,
    -- and membership tables is removed via ON DELETE CASCADE.
    DELETE FROM auth.users
    WHERE id = target_user_id;

    RAISE NOTICE 'Deleted user % (id: %).', target_email, target_user_id;
  END LOOP;
END
$$;
