
-- Fix: change restrictive policies to permissive for households INSERT
DROP POLICY "Authenticated users can create households" ON public.households;
CREATE POLICY "Authenticated users can create households"
  ON public.households FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Also fix households SELECT
DROP POLICY "Members can view their household" ON public.households;
CREATE POLICY "Members can view their household"
  ON public.households FOR SELECT
  TO authenticated
  USING (is_household_member(auth.uid(), id));

-- Fix household_members INSERT
DROP POLICY "Authenticated users can join households" ON public.household_members;
CREATE POLICY "Authenticated users can join households"
  ON public.household_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Fix household_members SELECT
DROP POLICY "Members can view household members" ON public.household_members;
CREATE POLICY "Members can view household members"
  ON public.household_members FOR SELECT
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));

-- Fix profiles policies
DROP POLICY "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Fix categories policies
DROP POLICY "Members can delete categories" ON public.categories;
CREATE POLICY "Members can delete categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));

DROP POLICY "Members can insert categories" ON public.categories;
CREATE POLICY "Members can insert categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (is_household_member(auth.uid(), household_id));

DROP POLICY "Members can update categories" ON public.categories;
CREATE POLICY "Members can update categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));

DROP POLICY "Members can view categories" ON public.categories;
CREATE POLICY "Members can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));

-- Fix expenses policies
DROP POLICY "Members can delete expenses" ON public.expenses;
CREATE POLICY "Members can delete expenses"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));

DROP POLICY "Members can insert expenses" ON public.expenses;
CREATE POLICY "Members can insert expenses"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (is_household_member(auth.uid(), household_id));

DROP POLICY "Members can update expenses" ON public.expenses;
CREATE POLICY "Members can update expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));

DROP POLICY "Members can view expenses" ON public.expenses;
CREATE POLICY "Members can view expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));

-- Fix income_streams policies
DROP POLICY "Members can delete incomes" ON public.income_streams;
CREATE POLICY "Members can delete incomes"
  ON public.income_streams FOR DELETE
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));

DROP POLICY "Members can insert incomes" ON public.income_streams;
CREATE POLICY "Members can insert incomes"
  ON public.income_streams FOR INSERT
  TO authenticated
  WITH CHECK (is_household_member(auth.uid(), household_id));

DROP POLICY "Members can update incomes" ON public.income_streams;
CREATE POLICY "Members can update incomes"
  ON public.income_streams FOR UPDATE
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));

DROP POLICY "Members can view incomes" ON public.income_streams;
CREATE POLICY "Members can view incomes"
  ON public.income_streams FOR SELECT
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));

-- Fix restore_points policies
DROP POLICY "Members can delete restore points" ON public.restore_points;
CREATE POLICY "Members can delete restore points"
  ON public.restore_points FOR DELETE
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));

DROP POLICY "Members can insert restore points" ON public.restore_points;
CREATE POLICY "Members can insert restore points"
  ON public.restore_points FOR INSERT
  TO authenticated
  WITH CHECK (is_household_member(auth.uid(), household_id));

DROP POLICY "Members can view restore points" ON public.restore_points;
CREATE POLICY "Members can view restore points"
  ON public.restore_points FOR SELECT
  TO authenticated
  USING (is_household_member(auth.uid(), household_id));
