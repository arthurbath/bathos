## 1. Contract and migration fixtures

- [x] 1.1 Add focused failing domain, repository, component, MCP, and pgTAP coverage for horizon and reminder scheduling, overdue work, three-state actionability, heading-free hierarchy, and source-visible note links
- [x] 1.2 Add schema-11 export, legacy template, and heading-child fixtures that prove preservation through schema-12 replacement and merge restore
- [x] 1.3 Record content-free production preflight queries and the private backup/rollback procedure without reading or logging task content

## 2. Database and portability

- [x] 2.1 Generate the Supabase migration with the CLI and make to-do/project horizons nullable, Next-defaulted for future scheduling, independently retained for active work, and free of the `none` sentinel
- [x] 2.2 Remove start-before-deadline checks from tables, mutation functions, templates, recurrence, bulk planning, and restore validation
- [x] 2.3 Add `rechecking` to database constraints, history, templates, filters, and schema-12 export/restore normalization
- [x] 2.4 Rebind reminders to parent start dates, cancel them when dates clear, and expose reminder time without an independent reminder date
- [x] 2.5 Flatten heading children into their projects, remove heading rows/references/functions, and preserve legacy schema/template restore compatibility
- [x] 2.6 Run the complete local database reset, pgTAP suite, advisors, export/restore round trips, and migration lint

## 3. Application domain and synchronization

- [x] 3.1 Update Tasks types, fixtures, state derivation, history, search, planning, recurrence, templates, and repositories for nullable horizons, Rechecking, overdue work, and no headings
- [x] 3.2 Remove heading views, forms, commands, hooks, routes, deletion paths, and user-facing labels while preserving the Area → Project → To-do model
- [x] 3.3 Remove `tasks_headings` from the PowerSync schema, Sync Streams, publication, grants, preflight, fixtures, and topology verifier as one exact 21-table set
- [x] 3.4 Regenerate and verify Supabase client types without introducing secrets or unrelated schema drift

## 4. Editors, notes, and interactions

- [x] 4.1 Show Day Horizon and Reminder Time under the original start-dependent model, default new dates to Next, and clear dependent values when the date clears; task 7.5 replaces this presentation with the final future-only model
- [x] 4.2 Permit start dates later than deadlines across single-item, project, bulk, template, recurrence, and restore interfaces
- [x] 4.3 Add Actionable, Waiting, and Rechecking presentation, editing, filtering, search, and accessible descriptions
- [x] 4.4 Replace semantic-only notes preview with source-visible Markdown styling and safe actionable HTTP(S), `message://`, and other non-executable alphanumeric scheme links
- [x] 4.5 Update keyboard commands, movement surfaces, capture defaults, narrow-mobile layout, and focused interaction tests for the heading-free scheduling model
- [x] 4.6 Collapse notes editing and preview into one directly editable live-styled source surface with the approved Markdown subset, fixed-width indicators, bullet continuation, safe links, and caret-preserving tests
- [x] 4.7 Replace single-character commands with capture-phase modifier shortcuts, direct numbered navigation, open-next and open-previous traversal, deterministic title focus, deferred open-task completion, and close-without-focus behavior
- [x] 4.8 Replace explicit to-do Save and Cancel with serialized debounced autosave, immediate structured-field persistence, close-time flushing, ordinary undoable history, and no saving indicator
- [x] 4.9 Animate inline editor expansion and collapse, smoothly reveal opened rows, and close through the autosave path on outside pointer interaction while preserving editor-owned overlays

## 5. MCP and integration contracts

- [x] 5.1 Remove heading MCP read/create/update/reorder/transition tools and fields while retaining area, project, to-do, and checklist ownership and idempotency boundaries
- [x] 5.2 Enforce future-only scheduling, independent horizons, Start-Date-anchored reminders, overdue scheduling, and `rechecking` across create, move, schedule, template, recurrence, Mail, and project MCP tools
- [x] 5.3 Rebuild and test the MCP Edge Function and update external Raycast and Inbox Manager contract fixtures where the repository owns them

## 6. Documentation, acceptance, and release

- [ ] 6.1 Update the Tasks guide, README, deployment documentation, topology evidence, and readiness report without retaining headings or obsolete reminder/date semantics
- [x] 6.2 Run focused tests, the full Vitest suite, Tasks typecheck, lint, production build, strict OpenSpec validation, database tests, and Git whitespace checks
- [x] 6.3 Verify desktop and mobile rendered behavior, custom-scheme activation, keyboard traversal, console health, and an existing installed PWA shell
- [x] 6.4 Obtain explicit approval for the production migration, 21-table PowerSync normalization, MCP deployment, reminder-job compatibility, and matching web release
- [ ] 6.5 Apply the approved release, run and clean up synthetic production fixtures, prove personal-content preservation and fresh synchronization, then sync and archive the change
- [ ] 6.6 Commit and push main, then prove the worktree, remote history, production assets, database, PowerSync, reminder runtime, and OpenSpec state are clean and synchronized

## 7. Future-only deferral and compact editing

- [x] 7.1 Add failing domain, repository, component, MCP, portability, synchronization, and pgTAP coverage for future-only Start Dates, activation, active day horizons, Primary Link, relative dates, pinned editing, clickable notes, and title-targeted traversal scrolling
- [x] 7.2 Replace the start-dependent horizon invariant across PostgreSQL, local repositories, templates, recurrence, restore, history, MCP, capture defaults, and derived views with future-only deferral plus retained active horizons
- [x] 7.3 Add idempotent local and server due-date activation, preserve same-day reminder delivery, and configure and verify the once-per-minute activation job
- [x] 7.4 Add synchronized, portable, undoable `primary_link` persistence, initialize it in Mail capture, and expose it through narrow MCP create and update contracts without changing audited source identity
- [x] 7.5 Implement compact responsive editor rows, future-date selection, editable Primary Link, explicit safe note-link activation, link-driven row icons, relative date labels, focused-title scrolling, and open-row projection retention
- [x] 7.6 Run the complete local database, focused Tasks, full Vitest, Tasks typecheck, lint, build, strict OpenSpec, portability, topology, reminder, offline, and rendered-browser validation matrix
