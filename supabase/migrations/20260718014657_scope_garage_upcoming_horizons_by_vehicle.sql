-- Scope Garage upcoming-service horizons to each vehicle.

BEGIN;

ALTER TABLE public.garage_vehicles
  ADD COLUMN upcoming_miles integer NOT NULL DEFAULT 1000
    CHECK (upcoming_miles >= 0),
  ADD COLUMN upcoming_days integer NOT NULL DEFAULT 60
    CHECK (upcoming_days >= 0);

UPDATE public.garage_vehicles AS vehicle
SET
  upcoming_miles = settings.upcoming_miles_default,
  upcoming_days = settings.upcoming_days_default
FROM public.garage_user_settings AS settings
WHERE settings.user_id = vehicle.user_id;

DROP TABLE public.garage_user_settings;

COMMIT;
