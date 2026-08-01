# Tasks Planning Surfaces Release

Date: 2026-08-01

## Outcome

The `stabilize-tasks-planning-surfaces` change is released. Upcoming order is authoritative across ordinary tasks, recurrence prototypes, midnight activation, and widget projections. The Calendar, Quick Find, open-task, installed scrolling, history-navigation, and PowerSync refinements are in production.

## Production Evidence

- Private pre-release backup: `/Users/Art/Library/Application Support/garden.bath.bathos/tasks-production-backups/2026-08-01T015048-0700-pre-stabilize-tasks-planning-surfaces.sql`
- Backup mode: `600`
- Backup size: `9,188,353` bytes
- Backup SHA-256: `acd9eb77dbeb9012b8dbf96239e64f80aa161b45e140fd6db3403c064914afc8`
- Applied migration: `20260801065755_add_tasks_upcoming_order.sql`
- Local and production migration ledgers match.
- Tasks row counts were preserved: 189 to-dos, 60 recurrence definitions, 72 recurrence revisions, 956 history events, and 294 checklist items.
- Rank validation passed with zero task mismatches and zero invalid recurrence ranks.
- The two affected user-trigger sets were re-enabled after the guarded backfill.
- PowerSync is `ready` with exactly 17 approved Tasks tables.
- The latest three Tasks activation cron runs succeeded.
- Production database lint reported no errors. Remaining advisor warnings predate this change or describe intentional authenticated, owner-scoped SECURITY DEFINER entry points.
- Owner-scoped production topology acceptance passed all six scenarios and cleaned up its fixtures.

The reached-deadline behavior was clarified during implementation. A to-do with no explicit Start receives a materialized Today Inbox Start when its deadline reaches the owner's planning date. The migration uses a private system-only activation setting for that transition while preserving the normal user-edit exclusivity rules.

## Application and Native Evidence

- Database validation: 29 files and 687 tests passed.
- Application validation: 162 files, 1,303 tests passed, 15 skipped.
- Tasks TypeScript, ESLint, production build, and strict OpenSpec validation passed.
- Lovable deployment `ca016026-12e2-43cc-b212-3a1acffab7f0` is published and up to date.
- Production rendered QA confirmed the refined Quick Find, exact-title result priority, Upcoming recurrence prototypes interleaved with ordinary tasks, and the absence of the retired Templates surface.
- Production Tasks asset: `TasksIndex-CiWGdYn-.js`, SHA-256 `21a6bef357f75342263c1f2d8c056987d6a64de919d0bf11328f2d68ca5d97d0`.
- Signed Release macOS and iOS builds passed strict code-signature verification.
- The macOS app was installed at `/Applications/Tasks.app`, registered, and launched. Its app and widget have one active installed registration.
- The Release iOS app was installed on Art's Phone as `garden.bath.tasks`, version `1.0` build `1`.
- macOS native tests passed 24 of 24.
- The iOS native scrolling policy is covered by a device-targeted test that requires vertical bounce, disables horizontal bounce, enables directional locking, and removes automatic content-inset adjustment. Physical tactile acceptance remains the final confirmation for native scroll feel.
- The Xcode 27 iOS test target compiled after updating its renamed UIKit accessor. The subsequent physical-device test launch was interrupted by Xcode's `CoreDeviceService` failing to initialize, after the build phase and independently of application code. The previously verified signed Release installation remains on the phone.

## Decisions and Limitations

- Safari owns some installed-PWA navigation gestures. The web release applies horizontal overscroll containment as a best effort, while the native WKWebViews disable history swipe navigation directly.
- Existing Supabase advisor notices were not broadened into unrelated remediation work. No new production blocker was identified.
- PowerSync was verified at exactly 17 active Tasks tables. Retired Template tables are not present in the active sync rules.
- Xcode's CoreDevice service requires recovery outside this release before another physical-device XCTest run. This did not prevent the signed Release build and installation completed earlier in the rollout.
