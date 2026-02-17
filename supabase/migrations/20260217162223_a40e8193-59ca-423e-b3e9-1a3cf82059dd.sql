
-- ============================================================
-- BathOS Platform Migration
-- 1. Rename existing tables with budget_ prefix
-- 2. Rename profiles to bathos_profiles
-- 3. Update functions and RLS policies
-- 4. Create bathos_user_roles and bathos_user_settings
-- ============================================================

-- Step 1: Rename all tables
ALTER TABLE public.profiles RENAME TO bathos_profiles;
ALTER TABLE public.households RENAME TO budget_households;
ALTER TABLE public.household_members RENAME TO budget_household_members;
ALTER TABLE public.income_streams RENAME TO budget_income_streams;
ALTER TABLE public.expenses RENAME TO budget_expenses;
ALTER TABLE public.categories RENAME TO budget_categories;
ALTER TABLE public.linked_accounts RENAME TO budget_linked_accounts;
ALTER TABLE public.budgets RENAME TO budget_budgets;
ALTER TABLE public.restore_points RENAME TO budget_restore_points;

-- Step 2: Update is_household_member function to reference renamed table
CREATE OR REPLACE FUNCTION public.is_household_member(_user_id uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.budget_household_members
    WHERE user_id = _user_id AND household_id = _household_id
  )
$$;

-- Step 3: Update handle_new_user trigger function to reference renamed table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.bathos_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

-- Step 4: Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Step 5: Create bathos_user_roles table
CREATE TABLE public.bathos_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.bathos_user_roles ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.bathos_user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- No insert/update/delete for regular users - managed by admin/server only
-- Grant read access
GRANT SELECT ON public.bathos_user_roles TO authenticated;

-- Step 6: Create has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bathos_user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 7: Create bathos_user_settings table
CREATE TABLE public.bathos_user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  theme text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bathos_user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
ON public.bathos_user_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
ON public.bathos_user_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
ON public.bathos_user_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.bathos_user_settings TO authenticated;

-- Step 8: Insert admin role for arthurbath@icloud.com
INSERT INTO public.bathos_user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'arthurbath@icloud.com'
ON CONFLICT (user_id, role) DO NOTHING;
