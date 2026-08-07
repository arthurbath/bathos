## 1. Evidence and Contract

- [x] 1.1 Capture current production receipt volume, empty-result ratio, table size, RPC definition, and PowerSync publication membership without mutating production.
- [x] 1.2 Specify write-free empty claims, 24-hour nonempty receipt retention, and the server-only receipt boundary.

## 2. Database Behavior

- [x] 2.1 Create a Supabase migration that makes empty legacy and v2 reminder claims write-free while preserving surface-scoped delivery and nonempty request idempotency.
- [x] 2.2 Add a private service-role-only 24-hour receipt purge function, optional hourly pg_cron scheduling, and one-time cleanup.
- [x] 2.3 Contract the PowerSync publication and replication-role grant from 17 to 16 tables without dropping the server receipt table.
- [x] 2.4 Extend pgTAP coverage for empty checks, target write suppression, nonempty exact retry, incompatible reuse, and deterministic receipt retention.

## 3. PowerSync Client and Deployment Topology

- [x] 3.1 Remove claim receipts from the local PowerSync schema and update the schema contract test.
- [x] 3.2 Remove claim receipts from owner-stream, publication, database-role, and verification deployment manifests.
- [x] 3.3 Add a production deployment and rollback preflight for database migration, PowerSync rule deployment, and independent readback.

## 4. Verification and Release Gate

- [x] 4.1 Run focused Tasks reminder, PowerSync schema, and database tests.
- [x] 4.2 Run lint, build, full Vitest, OpenSpec validation, Supabase database tests, database lint, and advisors.
- [x] 4.3 Perform a fresh production preflight and obtain explicit approval before applying the migration or changing the hosted PowerSync topology.
- [ ] 4.4 After approval, apply the migration and PowerSync topology, then verify retained receipts, cron health, role privileges, publication membership, reminder behavior, and synchronized client health.
