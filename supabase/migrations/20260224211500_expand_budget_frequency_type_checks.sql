-- Keep DB frequency_type constraints in sync with frontend FrequencyType options.
ALTER TABLE public.budget_expenses
  DROP CONSTRAINT IF EXISTS expenses_frequency_type_check,
  DROP CONSTRAINT IF EXISTS budget_expenses_frequency_type_check;

ALTER TABLE public.budget_expenses
  ADD CONSTRAINT budget_expenses_frequency_type_check
  CHECK (
    frequency_type IN (
      'monthly',
      'twice_monthly',
      'weekly',
      'every_n_weeks',
      'every_n_months',
      'every_n_days',
      'annual',
      'k_times_annually',
      'k_times_monthly',
      'k_times_weekly'
    )
  );

ALTER TABLE public.budget_income_streams
  DROP CONSTRAINT IF EXISTS income_streams_frequency_type_check,
  DROP CONSTRAINT IF EXISTS budget_income_streams_frequency_type_check;

ALTER TABLE public.budget_income_streams
  ADD CONSTRAINT budget_income_streams_frequency_type_check
  CHECK (
    frequency_type IN (
      'monthly',
      'twice_monthly',
      'weekly',
      'every_n_weeks',
      'every_n_months',
      'every_n_days',
      'annual',
      'k_times_annually',
      'k_times_monthly',
      'k_times_weekly'
    )
  );
