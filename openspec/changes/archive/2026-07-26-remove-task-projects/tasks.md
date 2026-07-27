## 1. Contract And Baseline

- [x] 1.1 Archive completed overlapping Tasks changes and validate the durable OpenSpec baseline
- [x] 1.2 Confirm production contains only the disposable test Project and no dependent task, reminder, template, recurrence, or operation records
- [x] 1.3 Add project-free regression coverage for the domain, routes, portability, MCP, synchronization, and production topology

## 2. Database And Portable Data

- [x] 2.1 Generate and implement the fail-closed Supabase migration that deletes the disposable Project and removes active Project schema
- [x] 2.2 Rewrite current Tasks SQL functions, constraints, triggers, grants, and generated types for task-only roots and direct Area assignment
- [x] 2.3 Upgrade Tasks exports to schema 13 and normalize supported schema 3 through 12 Project-contained tasks without recreating Projects
- [x] 2.4 Preserve all non-Project task, Area, checklist, source, reminder, recurrence, history, and recovery data through migration tests

## 3. Application Domain And Synchronization

- [x] 3.1 Remove Project entities and relationships from Tasks domain types, repositories, mutations, hooks, history, clipboard, templates, recurrence, and reminders
- [x] 3.2 Simplify organization, sorting, drag-and-drop, list projection, and task metadata to direct optional Area assignment
- [x] 3.3 Remove `tasks_projects` and Project columns from the PowerSync schema and upload connector
- [x] 3.4 Normalize PowerSync topology tooling and assertions from 21 to exactly 20 approved Tasks tables

## 4. Application Surfaces

- [x] 4.1 Remove Project navigation, index, detail, cards, forms, search results, commands, and iconography
- [x] 4.2 Replace Organization controls with Area-only controls and update all affected UI language
- [x] 4.3 Redirect legacy `/tasks/projects` routes to Anytime without rendering Project UI
- [x] 4.4 Verify rendered desktop and mobile Tasks views, interactions, and offline behavior after Project removal

## 5. MCP And Automation

- [x] 5.1 Remove Project schemas, resources, mutations, planning roots, and fields from the source MCP registry
- [x] 5.2 Regenerate and validate the deployed MCP Edge Function bundle without Project operations
- [x] 5.3 Verify Mail capture, task reminders, recurrence, and owner-scoped MCP task creation remain healthy

## 6. Documentation And Local Validation

- [x] 6.1 Update current human, agent, topology, and iconography documentation to describe Areas, tasks, and checklist items without Projects
- [x] 6.2 Sweep active source, specs, tests, and generated artifacts for unsupported Project references while preserving immutable historical migrations and explicit legacy import adapters
- [x] 6.3 Run focused and full tests, lint, build, strict OpenSpec validation, Supabase database tests, and database lint

## 7. Production Rollout

- [x] 7.1 Refresh and verify the private production backup and repeat the exact Project dependency preflight immediately before mutation
- [x] 7.2 Apply the approved migration and prove every non-Project production record count is preserved
- [x] 7.3 Normalize the PowerSync publication, grants, and Sync Streams to exactly 20 approved Tasks tables
- [x] 7.4 Deploy the project-free MCP Edge Function and matching BathOS Tasks web release
- [x] 7.5 Run and clean up an owner-scoped production acceptance fixture and verify PowerSync, cron, advisors, reminders, Mail capture, and production parity

## 8. Closeout

- [x] 8.1 Sync the completed delta specs into durable specifications and archive the OpenSpec change
- [x] 8.2 Commit and push `main`, then prove a clean synchronized repository and final cross-system parity
