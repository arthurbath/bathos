
-- Fix: All policies are RESTRICTIVE which blocks access. Recreate as PERMISSIVE.
-- Also re-grant table permissions.

-- Drop all existing policies
DROP POLICY IF EXISTS "Authenticated users can create households" ON public.households;
DROP POLICY IF EXISTS "Members can view their household" ON public.households;
DROP POLICY IF EXISTS "Authenticated users can join households" ON public.household_members;
DROP POLICY IF EXISTS "Members can view household members" ON public.household_members;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Members can view categories" ON public.categories;
DROP POLICY IF EXISTS "Members can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Members can update categories" ON public.categories;
DROP POLICY IF EXISTS "Members can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Members can view incomes" ON public.income_streams;
DROP POLICY IF EXISTS "Members can insert incomes" ON public.income_streams;
DROP POLICY IF EXISTS "Members can update incomes" ON public.income_streams;
DROP POLICY IF EXISTS "Members can delete incomes" ON public.income_streams;
DROP POLICY IF EXISTS "Members can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Members can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Members can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Members can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Members can view restore points" ON public.restore_points;
DROP POLICY IF EXISTS "Members can insert restore points" ON public.restore_points;
DROP POLICY IF EXISTS "Members can delete restore points" ON public.restore_points;

-- Recreate ALL as PERMISSIVE

-- households
CREATE POLICY "Authenticated users can create households" ON public.households
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Members can view their household" ON public.households
  FOR SELECT TO authenticated USING (public.is_household_member(auth.uid(), id));

-- household_members
CREATE POLICY "Users can join households" ON public.household_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can view household members" ON public.household_members
  FOR SELECT TO authenticated USING (public.is_household_member(auth.uid(), household_id));

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- categories
CREATE POLICY "Members can view categories" ON public.categories
  FOR SELECT TO authenticated USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can insert categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can update categories" ON public.categories
  FOR UPDATE TO authenticated USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can delete categories" ON public.categories
  FOR DELETE TO authenticated USING (public.is_household_member(auth.uid(), household_id));

-- income_streams
CREATE POLICY "Members can view incomes" ON public.income_streams
  FOR SELECT TO authenticated USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can insert incomes" ON public.income_streams
  FOR INSERT TO authenticated WITH CHECK (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can update incomes" ON public.income_streams
  FOR UPDATE TO authenticated USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can delete incomes" ON public.income_streams
  FOR DELETE TO authenticated USING (public.is_household_member(auth.uid(), household_id));

-- expenses
CREATE POLICY "Members can view expenses" ON public.expenses
  FOR SELECT TO authenticated USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can insert expenses" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can update expenses" ON public.expenses
  FOR UPDATE TO authenticated USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can delete expenses" ON public.expenses
  FOR DELETE TO authenticated USING (public.is_household_member(auth.uid(), household_id));

-- restore_points
CREATE POLICY "Members can view restore points" ON public.restore_points
  FOR SELECT TO authenticated USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can insert restore points" ON public.restore_points
  FOR INSERT TO authenticated WITH CHECK (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can delete restore points" ON public.restore_points
  FOR DELETE TO authenticated USING (public.is_household_member(auth.uid(), household_id));

-- Grant table permissions explicitly
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.households TO authenticated;
GRANT ALL ON public.household_members TO authenticated;
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.income_streams TO authenticated;
GRANT ALL ON public.expenses TO authenticated;
GRANT ALL ON public.restore_points TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.households TO anon;
