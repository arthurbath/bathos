## 1. Database Contract

- [x] 1.1 Add database tests for the five day-horizon values, independent future horizons, Today Inbox fallback, and unchanged owner/RLS boundaries
- [x] 1.2 Create a Supabase migration that adds Inbox, removes future-date coupling, updates indexes and defaults, and replaces affected task, project, template, recurrence, export, restore, and service functions
- [x] 1.3 Regenerate Supabase TypeScript types and verify the local PowerSync schema remains compatible with the approved 22-table publication

## 2. Domain and Local Data

- [x] 2.1 Extend task and project horizon types, visibility, resolved-section ordering, markers, and planning-order scopes to Inbox, Now, Next, and Later
- [x] 2.2 Update repository validation and planning mutations so future start dates preserve horizons, due `none` work resolves to Inbox, and Someday remains date-and-horizon free
- [x] 2.3 Update template, recurrence, export, restore, history, fixtures, and preservation tests to round-trip future horizons

## 3. Service and Integration Contracts

- [x] 3.1 Update MCP create, read, move, schedule, reorder, project, hierarchy, and Mail tools to validate and preserve independent horizons and default capture to Inbox
- [x] 3.2 Rebuild and verify the MCP Edge Function bundle from canonical source
- [x] 3.3 Update Raycast and Inbox Manager companion contracts and tests so unspecified captures delegate to or resolve as Today Inbox without changing Mail classification policy

## 4. Tasks Interface

- [x] 4.1 Render Today in Inbox, Now, Next, and Later order with accessible Lucide section and row markers
- [x] 4.2 Present Day Horizon beside Start Date in the task editor and When surface with complete keyboard operation and independent save behavior
- [x] 4.3 Update temporal and bulk actions, project planning, labels, and future-date behavior to retain the selected horizon
- [x] 4.4 Add focused React and domain tests for four-section grouping, due fallback, future retention, editing, planning actions, and optimistic visibility

## 5. Validation and Release

- [x] 5.1 Run focused and full unit tests, database tests, lint, Tasks typecheck, production build, strict OpenSpec validation, and Edge bundle verification
- [x] 5.2 Create a verified private production backup, apply the approved migration and MCP deployment, and verify migrations, functions, cron, RLS, PowerSync, and content-free data counts
- [x] 5.3 Run synthetic production acceptance for future horizon retention, owner-local Today Inbox activation, cross-client PowerSync convergence, and cleanup
- [x] 5.4 Sync durable specs, archive the completed change, update user and readiness documentation, commit, push main, and prove a clean synchronized repository state
