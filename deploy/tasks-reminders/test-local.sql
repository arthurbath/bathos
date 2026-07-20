\set ON_ERROR_STOP on

BEGIN;

\ir extensions-enable.sql

SELECT vault.create_secret(
  repeat('local-synthetic-secret-', 2),
  'tasks_reminder_dispatch_secret',
  'Transaction-local task reminder deployment validation'
);

\ir cron-create.sql
\ir verify.sql

ROLLBACK;
