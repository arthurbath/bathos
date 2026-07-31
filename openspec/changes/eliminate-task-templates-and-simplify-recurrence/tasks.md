## 1. Migration Contract And Preflight

- [x] 1.1 Replace the two unapplied materialized-prototype migrations with one Supabase-created template-elimination and recurrence-prototype migration
- [x] 1.2 Add fail-closed conversion assertions for template-backed recurrence snapshots, owner boundaries, duplicate future projections, deferred reached instances, and PowerSync publication membership
- [x] 1.3 Add production-preflight queries that report exact template, recurrence, projection, preserved-instance, and deletion counts without mutating production

## 2. First-Class Recurrence Prototype Data Model

- [x] 2.1 Store validated prototype task and checklist snapshots on immutable recurrence revisions and remove template references
- [x] 2.2 Refactor recurrence creation, editing, evaluation, status, and prototype-content RPCs to use recurrence revisions directly
- [x] 2.3 Make occurrence rows represent spawned or adopted ordinary task instances only and remove template-instantiation references
- [x] 2.4 Persist authoritative next calendar spawn dates and after-completion waiting state without materializing future task rows
- [x] 2.5 Preserve completion, trash, restoration, idempotency, reminder, deadline, and owner-local timing behavior

## 3. Template Elimination

- [x] 3.1 Remove template tables, private context, functions, triggers, policies, constraints, provenance columns, and PowerSync publication entries after recurrence conversion
- [x] 3.2 Remove Template routes, navigation, views, panels, hooks, services, icon mappings, and tests and redirect the retired route to Upcoming
- [x] 3.3 Remove template collections and provenance from current portability, advance to schema 14, and add narrow legacy recurrence-snapshot conversion
- [x] 3.4 Remove template tables and fields from generated Supabase types, Tasks domain types, fixtures, and the PowerSync schema

## 4. Upcoming Prototype And Instance Presentation

- [x] 4.1 Build a recurrence-prototype view model from definitions and revisions, including next-date and waiting projections
- [x] 4.2 Render dated calendar prototypes and waiting after-completion prototypes in Upcoming without manufacturing task rows
- [x] 4.3 Keep spawned instances ordinary and fully operable in Today, Anytime, Someday, Upcoming, Done, Quick Find, widgets, and keyboard workflows
- [x] 4.4 Wire Edit Repeat and prototype-content editing to immutable recurrence revisions while retaining Go to Instance for waiting prototypes

## 5. Regression Coverage

- [x] 5.1 Add database tests for conversion, calendar advancement, deferral into Upcoming, prototype independence, after-completion terminal/restoration behavior, and idempotency
- [x] 5.2 Add application tests for Templates removal, route redirect, virtual prototype rendering, ordinary deferred instances, repeat editing, and quick-find/widget distinctions
- [x] 5.3 Run the full database suite and local database lint, application tests, TypeScript, lint, production build, Edge bundle verification, and strict OpenSpec validation

## 6. Production Rollout Preparation

- [x] 6.1 Produce an exact read-only production preflight before backup refresh, migration, publication contraction, release, or fixture mutation
- [x] 6.2 Obtain explicit approval for the exact production mutation contract
- [ ] 6.3 After approval, refresh and verify the private backup, apply migrations in order, publish matching clients, run and clean owner-scoped acceptance fixtures, and verify exactly 17 PowerSync Tasks tables plus production advisors
