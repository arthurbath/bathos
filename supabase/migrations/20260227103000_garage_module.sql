-- Garage module schema (admin-only, user-owned)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'garage_service_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.garage_service_type AS ENUM ('replacement', 'clean_lube', 'adjustment', 'check');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'garage_service_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.garage_service_status AS ENUM ('performed', 'not_needed_yet', 'declined');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'garage_cadence_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.garage_cadence_type AS ENUM ('recurring', 'one_time', 'no_interval');
  END IF;
END
$$;

CREATE TABLE public.garage_user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  upcoming_miles_default integer NOT NULL DEFAULT 1000 CHECK (upcoming_miles_default >= 0),
  upcoming_days_default integer NOT NULL DEFAULT 60 CHECK (upcoming_days_default >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.garage_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  make text,
  model text,
  model_year integer CHECK (model_year BETWEEN 1900 AND 2200),
  in_service_date date,
  current_odometer_miles integer NOT NULL DEFAULT 0 CHECK (current_odometer_miles >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE TABLE public.garage_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL,
  name text NOT NULL,
  type public.garage_service_type NOT NULL,
  monitoring boolean NOT NULL DEFAULT false,
  cadence_type public.garage_cadence_type NOT NULL DEFAULT 'recurring',
  every_miles integer CHECK (every_miles IS NULL OR every_miles > 0),
  every_months integer CHECK (every_months IS NULL OR every_months > 0),
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id, vehicle_id),
  CONSTRAINT garage_services_vehicle_fk
    FOREIGN KEY (vehicle_id, user_id)
    REFERENCES public.garage_vehicles (id, user_id)
    ON DELETE CASCADE
);

CREATE TABLE public.garage_servicings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL,
  service_date date NOT NULL,
  odometer_miles integer NOT NULL CHECK (odometer_miles >= 0),
  shop_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id, vehicle_id),
  CONSTRAINT garage_servicings_vehicle_fk
    FOREIGN KEY (vehicle_id, user_id)
    REFERENCES public.garage_vehicles (id, user_id)
    ON DELETE CASCADE
);

CREATE TABLE public.garage_servicing_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL,
  servicing_id uuid NOT NULL,
  service_id uuid NOT NULL,
  status public.garage_service_status NOT NULL DEFAULT 'performed',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (servicing_id, service_id),
  CONSTRAINT garage_servicing_services_vehicle_fk
    FOREIGN KEY (vehicle_id, user_id)
    REFERENCES public.garage_vehicles (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT garage_servicing_services_servicing_fk
    FOREIGN KEY (servicing_id, user_id, vehicle_id)
    REFERENCES public.garage_servicings (id, user_id, vehicle_id)
    ON DELETE CASCADE,
  CONSTRAINT garage_servicing_services_service_fk
    FOREIGN KEY (service_id, user_id, vehicle_id)
    REFERENCES public.garage_services (id, user_id, vehicle_id)
    ON DELETE CASCADE
);

CREATE TABLE public.garage_servicing_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL,
  servicing_id uuid NOT NULL,
  storage_object_path text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT garage_servicing_receipts_vehicle_fk
    FOREIGN KEY (vehicle_id, user_id)
    REFERENCES public.garage_vehicles (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT garage_servicing_receipts_servicing_fk
    FOREIGN KEY (servicing_id, user_id, vehicle_id)
    REFERENCES public.garage_servicings (id, user_id, vehicle_id)
    ON DELETE CASCADE
);

CREATE INDEX garage_user_settings_user_id_idx ON public.garage_user_settings (user_id);
CREATE INDEX garage_vehicles_user_id_idx ON public.garage_vehicles (user_id);
CREATE INDEX garage_services_vehicle_idx ON public.garage_services (user_id, vehicle_id, sort_order, name);
CREATE INDEX garage_servicings_vehicle_date_idx ON public.garage_servicings (user_id, vehicle_id, service_date DESC);
CREATE INDEX garage_servicing_services_servicing_idx ON public.garage_servicing_services (servicing_id);
CREATE INDEX garage_servicing_services_service_idx ON public.garage_servicing_services (service_id);
CREATE INDEX garage_servicing_receipts_servicing_idx ON public.garage_servicing_receipts (servicing_id);

ALTER TABLE public.garage_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_servicings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_servicing_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_servicing_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own garage user settings"
ON public.garage_user_settings
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert own garage user settings"
ON public.garage_user_settings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update own garage user settings"
ON public.garage_user_settings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete own garage user settings"
ON public.garage_user_settings
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view own garage vehicles"
ON public.garage_vehicles
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert own garage vehicles"
ON public.garage_vehicles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update own garage vehicles"
ON public.garage_vehicles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete own garage vehicles"
ON public.garage_vehicles
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view own garage services"
ON public.garage_services
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert own garage services"
ON public.garage_services
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update own garage services"
ON public.garage_services
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete own garage services"
ON public.garage_services
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view own garage servicings"
ON public.garage_servicings
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert own garage servicings"
ON public.garage_servicings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update own garage servicings"
ON public.garage_servicings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete own garage servicings"
ON public.garage_servicings
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view own garage servicing services"
ON public.garage_servicing_services
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert own garage servicing services"
ON public.garage_servicing_services
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update own garage servicing services"
ON public.garage_servicing_services
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete own garage servicing services"
ON public.garage_servicing_services
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view own garage servicing receipts"
ON public.garage_servicing_receipts
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert own garage servicing receipts"
ON public.garage_servicing_receipts
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update own garage servicing receipts"
ON public.garage_servicing_receipts
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete own garage servicing receipts"
ON public.garage_servicing_receipts
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_servicings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_servicing_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_servicing_receipts TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('garage-receipts', 'garage-receipts', false)
ON CONFLICT (id) DO UPDATE SET public = excluded.public;

CREATE POLICY "Admins can upload own garage receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'garage-receipts'
  AND public.has_role(auth.uid(), 'admin')
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "Admins can view own garage receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'garage-receipts'
  AND public.has_role(auth.uid(), 'admin')
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "Admins can update own garage receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'garage-receipts'
  AND public.has_role(auth.uid(), 'admin')
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'garage-receipts'
  AND public.has_role(auth.uid(), 'admin')
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "Admins can delete own garage receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'garage-receipts'
  AND public.has_role(auth.uid(), 'admin')
  AND split_part(name, '/', 1) = auth.uid()::text
);
