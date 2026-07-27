# Tasks Project Removal Release

**Date:** 2026 Jul 26
**Category:** Product / Production / Trust
**Status:** Accepted

## Outcome

BathOS Tasks is project-free in production. Tasks may belong directly to one Area or remain unassigned, and checklist items remain subordinate to tasks. The application, database, synchronization topology, MCP surface, portable schema, documentation, and rendered UI no longer expose Projects as an active concept.

The one confirmed disposable test Project and its one Project-only history record were deleted after a fresh private backup and exact zero-dependency preflight. Every non-Project production record count was preserved. The first migration attempt stopped transactionally on its deferred foreign-key guard and changed no production data. The corrected migration and its operation-group preservation follow-up then applied successfully.

## Production Evidence

- The private predeployment backup is `2026-07-26T221608-0700-pre-remove-task-projects.sql`. It is 3,926,882 bytes, mode `0600`, has a PostgreSQL completion marker, contains all expected public and private Tasks data sections, and has SHA-256 digest `a02a4f7f3221377fdbbbb23c179f92c4d6a3fced1697450562599ffc7b501b8e`.
- Migrations `20260726210709_add_tasks_history_operation_groups.sql`, `20260726225926_remove_task_projects.sql`, and `20260726230700_preserve_tasks_history_operation_groups.sql` are recorded in production in order.
- `tasks_projects`, Project history persistence, and active Project columns are absent. The current schema-13 export is Project-free, while supported schema 3 through 12 imports retain explicit legacy normalization.
- The `tasks_powersync_role` retains only its approved login, replication, and RLS-bypass attributes. It has exact read access to the 20 approved Tasks tables, with no missing approved grants or extra explicit public-table grants.
- PowerSync Cloud Sync Streams version `cbe2` is active and healthy with exactly 20 Tasks tables and a connected client.
- The MCP Edge Function is active at version 14 with the project-free source bundle and its existing custom authentication boundary.
- Lovable published the matching web release from commit `43a4c3c`. The deployed Tasks bundle contains current operation-group synchronization and only the intentional legacy-import Project adapters.
- The activation, reminder-dispatch, and Done-retention jobs remain active once per minute. Their latest production runs succeeded. Reminder delivery reports ready, and the three most recent dispatcher runs succeeded.

## Acceptance

The cleanup-backed production topology passed all five gates:

1. Cross-client convergence, owner isolation, restart, and cleanup
2. Deep undo and redo through a fresh PowerSync projection
3. Durable quick filter and reached-Start Inbox activation
4. Unified Start, explicit Primary Link clearing, and fresh projection
5. Done retention, purge, and fresh removal

The acceptance cleanup left zero synthetic authentication users, tasks, Mail sources, history rows, or fixture residue. A separate offline run passed task persistence, restart, and queued mutation behavior against the disposable 20-table PowerSync harness, which was then removed.

Authenticated local rendering confirmed the project-free Today and Anytime views on desktop and mobile, no Project navigation, no horizontal overflow at the mobile viewport, and replacement navigation from the retired `/tasks/projects` route to `/tasks/anytime`.

## Release Correction

Acceptance exposed two synchronization defects before closeout. The client upload parser did not admit `last_operation_id`, and the project-free task-history trigger did not persist the accepted operation identifier. Commit `43a4c3c` and migration `20260726230700_preserve_tasks_history_operation_groups.sql` corrected both. Focused live undo and redo then passed, followed by the complete five-gate production topology.

## Advisor Review

The Supabase security advisor reports existing informational private-table RLS notices and expected authenticated SECURITY DEFINER RPC notices. The performance advisor reports existing unindexed-foreign-key and unused-index opportunities. Neither advisor reports a remaining Project table, Project column, Project synchronization grant, or Project-removal regression.

Relevant general remediation references:

- [RLS policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Authenticated SECURITY DEFINER functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)

## Validation

- 648 database assertions passed.
- 962 application tests passed, with 13 intentional opt-in cases skipped.
- Tasks TypeScript checking, ESLint, the production build, strict OpenSpec validation, Edge bundle verification, production topology, focused production undo and redo, and offline workflow acceptance passed.
- Production migration, schema, PowerSync, cron, reminder, MCP, web-bundle, cleanup, and rendered-route parity passed.
