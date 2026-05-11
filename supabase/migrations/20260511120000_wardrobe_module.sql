-- Wardrobe module schema (admin-only, user-owned)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'wardrobe_category' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.wardrobe_category AS ENUM ('tops', 'bottoms', 'footwear', 'outerwear', 'underwear', 'accessories');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'wardrobe_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.wardrobe_status AS ENUM (
      'active',
      'needs_modulation',
      'endangered',
      'seeking_replacement',
      'pending_removal',
      'costume',
      'removed'
    );
  END IF;
END
$$;

CREATE TABLE public.wardrobe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  category public.wardrobe_category,
  brand text,
  model text,
  color text,
  size text,
  link_url text,
  status public.wardrobe_status,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wardrobe_items_link_url_valid CHECK (
    link_url IS NULL
    OR (
      link_url ~* '^https?://'
      AND link_url !~ '[[:space:]<>"''`{}|\\^]'
      AND link_url !~ '[[:cntrl:]]'
    )
  )
);

CREATE INDEX wardrobe_items_user_id_idx ON public.wardrobe_items (user_id, created_at);
CREATE INDEX wardrobe_items_user_category_idx ON public.wardrobe_items (user_id, category);
CREATE INDEX wardrobe_items_user_brand_idx ON public.wardrobe_items (user_id, lower(btrim(brand)));
CREATE INDEX wardrobe_items_user_status_idx ON public.wardrobe_items (user_id, status);

ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own wardrobe items"
ON public.wardrobe_items
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert own wardrobe items"
ON public.wardrobe_items
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update own wardrobe items"
ON public.wardrobe_items
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete own wardrobe items"
ON public.wardrobe_items
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wardrobe_items TO authenticated;
