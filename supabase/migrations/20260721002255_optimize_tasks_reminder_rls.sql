-- Cache the authenticated owner lookup once per statement for reminder reads.

ALTER POLICY tasks_reminders_owner_select
ON public.tasks_reminders
USING (owner_id = (SELECT auth.uid()));

ALTER POLICY tasks_reminder_occurrences_owner_select
ON public.tasks_reminder_occurrences
USING (owner_id = (SELECT auth.uid()));

ALTER POLICY tasks_delivery_targets_owner_select
ON public.tasks_delivery_targets
USING (owner_id = (SELECT auth.uid()));

ALTER POLICY tasks_reminder_deliveries_owner_select
ON public.tasks_reminder_deliveries
USING (owner_id = (SELECT auth.uid()));

ALTER POLICY tasks_reminder_claims_owner_select
ON public.tasks_reminder_claims
USING (owner_id = (SELECT auth.uid()));
