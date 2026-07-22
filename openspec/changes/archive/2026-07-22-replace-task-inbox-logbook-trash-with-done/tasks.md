## 1. Domain and Migration

- [x] 1.1 Replace task destinations and Today sections in shared types, local schema, repository assertions, fixtures, and planning helpers
- [x] 1.2 Add the Supabase normalization migration for legacy Inbox, Today, daytime, and evening records across to-dos and projects
- [x] 1.3 Add owner-local Done retention and idempotent purge SQL with a once-per-minute pg_cron job
- [x] 1.4 Update export, restore, history normalization, recurrence, templates, Mail capture, and generated Supabase types for the new values
- [x] 1.5 Add database tests for migration preservation, placement constraints, exact local-midnight expiry, dependency cleanup, safety receipts, and retry behavior

## 2. Local-First Views and Mutations

- [x] 2.1 Make Today a Now, Next, and Later projection of available Anytime records while keeping all Today records visible in Anytime
- [x] 2.2 Replace Logbook and Trash queries with one reverse-terminal-time Done projection for to-dos and hierarchy roots
- [x] 2.3 Default web and service captures to Anytime Later and remove Inbox planning actions and fallback placement
- [x] 2.4 Preserve revision, optimistic visibility, reordering, reminders, recurrence, typed source, hierarchy, undo, and synchronization behavior under the new model
- [x] 2.5 Add focused domain, repository, hook, convergence, recurrence, backup, and recovery tests

## 3. Tasks Interface

- [x] 3.1 Replace navigation, routes, headings, search, shortcuts, keyboard help, and empty states with Today, Upcoming, Anytime, Someday, Done, and Config
- [x] 3.2 Render Today as Now, Next, and Later sections with section-scoped planning and reordering actions
- [x] 3.3 Show compact accessible Now, Next, or Later Lucide markers on matching Anytime rows
- [x] 3.4 Combine recoverable deleted and reopenable terminal work into the Done interface and remove separate permanent-deletion ceremony from routine UI
- [x] 3.5 Add replacement redirects for `/tasks/inbox`, `/tasks/logbook`, and `/tasks/trash`
- [x] 3.6 Update component, route, scroll, keyboard, link, focus, accessibility, and responsive navigation tests

## 4. Automation Surfaces

- [x] 4.1 Update MCP read, create, move, schedule, reorder, lifecycle, Mail, project, template, and recurrence tools and regenerate the Edge Function bundle
- [x] 4.2 Update MCP tests and durable MCP specification coverage for current view and planning vocabulary
- [x] 4.3 Update Raycast capture commands, descriptions, tests, and documentation to default to Anytime Later
- [x] 4.4 Update Inbox Manager's BathOS handoff contract and tests without changing Mail classification or mailbox policy

## 5. Documentation and Validation

- [x] 5.1 Update README, Tasks Guide, module documentation, production provisioning notes, and evaluations for the new GTD and 30-day recovery boundary
- [x] 5.2 Run formatting checks, unit and integration tests, local Supabase database tests, lint, build, generated-bundle verification, and strict OpenSpec validation
- [x] 5.3 Verify desktop and mobile Today, Anytime, Done, More, search, keyboard, restore, and redirect behavior in the browser with saved evidence
- [x] 5.4 Verify local offline creation, Today membership, completion, reconnection, and PowerSync convergence without duplicate or resurrected records

## 6. Production and Closeout

- [x] 6.1 Review the destructive production migration boundary, preserve a pre-deployment export, and apply the approved migration and MCP deployment
- [x] 6.2 Deploy and verify approved Raycast and Inbox Manager runtime changes, then reconcile one synthetic sourced task through Today Later and Anytime
- [x] 6.3 Prove one synthetic Done record survives the full retention window simulation and purges at the exact owner-local boundary with a fresh PowerSync projection
- [x] 6.4 Sync durable specifications, archive the OpenSpec change, commit and push main, and prove clean cross-system synchronization
