\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT vault.create_secret(
  repeat('local-synthetic-secret-', 2),
  'tasks_reminder_dispatch_secret',
  'Transaction-local task reminder deployment validation'
);

\ir cron-create.sql
\ir verify.sql

ROLLBACK;
