DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'garage_cadence_type'
      AND n.nspname = 'public'
  ) AND EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'garage_cadence_type'
      AND n.nspname = 'public'
      AND e.enumlabel = 'one_time'
  ) THEN
    CREATE TYPE public.garage_cadence_type_new AS ENUM ('recurring', 'no_interval');

    ALTER TABLE public.garage_services
      ALTER COLUMN cadence_type DROP DEFAULT;

    ALTER TABLE public.garage_services
      ALTER COLUMN cadence_type TYPE public.garage_cadence_type_new
      USING (
        CASE
          WHEN cadence_type::text = 'one_time' THEN 'recurring'
          ELSE cadence_type::text
        END
      )::public.garage_cadence_type_new;

    DROP TYPE public.garage_cadence_type;
    ALTER TYPE public.garage_cadence_type_new RENAME TO garage_cadence_type;

    ALTER TABLE public.garage_services
      ALTER COLUMN cadence_type SET DEFAULT 'recurring'::public.garage_cadence_type;
  END IF;
END
$$;
