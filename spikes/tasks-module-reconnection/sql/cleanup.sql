SELECT pg_drop_replication_slot(slot_name)
FROM pg_replication_slots
WHERE slot_name LIKE 'powersync_1_%'
  AND database = current_database()
  AND NOT active;

DROP PUBLICATION IF EXISTS powersync;
DROP TRIGGER IF EXISTS tasks_test_grant_module_access_on_signup ON auth.users;
DROP FUNCTION IF EXISTS public.tasks_test_grant_module_access_on_signup();
