
-- Profiles table for user display names
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Households table
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Household',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- Household members (links users to households with partner label)
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_label TEXT NOT NULL CHECK (partner_label IN ('X', 'Y')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(household_id, user_id),
  UNIQUE(household_id, partner_label)
);
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Security definer function: check if user is member of household
CREATE OR REPLACE FUNCTION public.is_household_member(_user_id UUID, _household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE user_id = _user_id AND household_id = _household_id
  )
$$;

-- Household RLS: members can view their households
CREATE POLICY "Members can view their household" ON public.households FOR SELECT USING (
  public.is_household_member(auth.uid(), id)
);
CREATE POLICY "Authenticated users can create households" ON public.households FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Household members RLS
CREATE POLICY "Members can view household members" ON public.household_members FOR SELECT USING (
  public.is_household_member(auth.uid(), household_id)
);
CREATE POLICY "Authenticated users can join households" ON public.household_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view categories" ON public.categories FOR SELECT USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can insert categories" ON public.categories FOR INSERT WITH CHECK (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can update categories" ON public.categories FOR UPDATE USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can delete categories" ON public.categories FOR DELETE USING (public.is_household_member(auth.uid(), household_id));

-- Income streams table
CREATE TABLE public.income_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  partner_label TEXT NOT NULL CHECK (partner_label IN ('X', 'Y')),
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  frequency_type TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency_type IN ('monthly', 'twice_monthly', 'weekly', 'every_n_weeks', 'annual', 'k_times_annually')),
  frequency_param INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.income_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view incomes" ON public.income_streams FOR SELECT USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can insert incomes" ON public.income_streams FOR INSERT WITH CHECK (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can update incomes" ON public.income_streams FOR UPDATE USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can delete incomes" ON public.income_streams FOR DELETE USING (public.is_household_member(auth.uid(), household_id));

-- Expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  frequency_type TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency_type IN ('monthly', 'twice_monthly', 'weekly', 'every_n_weeks', 'annual', 'k_times_annually')),
  frequency_param INTEGER,
  payer TEXT NOT NULL DEFAULT 'X' CHECK (payer IN ('X', 'Y')),
  benefit_x INTEGER NOT NULL DEFAULT 50 CHECK (benefit_x >= 0 AND benefit_x <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view expenses" ON public.expenses FOR SELECT USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can insert expenses" ON public.expenses FOR INSERT WITH CHECK (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can update expenses" ON public.expenses FOR UPDATE USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can delete expenses" ON public.expenses FOR DELETE USING (public.is_household_member(auth.uid(), household_id));

-- Restore points table
CREATE TABLE public.restore_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB NOT NULL DEFAULT '{}'
);
ALTER TABLE public.restore_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view restore points" ON public.restore_points FOR SELECT USING (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can insert restore points" ON public.restore_points FOR INSERT WITH CHECK (public.is_household_member(auth.uid(), household_id));
CREATE POLICY "Members can delete restore points" ON public.restore_points FOR DELETE USING (public.is_household_member(auth.uid(), household_id));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
