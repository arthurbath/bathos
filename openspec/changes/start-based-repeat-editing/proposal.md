## Why

The repeat editor currently exposes Deadline-anchored implementation details and fragmented monthly and yearly patterns, making recurrence creation harder to understand and leaving the client and database without an explicit distinction between Start-based and Deadline-based schedules. The redesign must let users describe whether generated tasks have deadlines and, when they do, choose the meaningful Start or Deadline cadence anchor while preserving every existing production cadence, especially birthdays and holidays whose meaningful date is the Deadline.

## What Changes

- Redesign the Tasks repeat modal around a static task Summary, a phrasal repeat-type Select and schedule controls, a Tasks Have Deadlines toggle, sentence-style basis and date entry that reads `Starts on` or `Due on`, balanced content padding, and a simplified control order.
- Restrict the anchor date picker to dates that satisfy the configured calendar cadence while allowing any legal date for after-completion repeats.
- Consolidate monthly and yearly schedules into ordinal plus day-type rules, add multi-month yearly schedules, singularize interval units, and define clamping and missing-ordinal behavior.
- Add immutable recurrence-revision date basis and canonical version-2 rule configuration while retaining legacy reads and cached-client compatibility.
- Add versioned recurrence create/edit RPCs and update preview, activation, reminders, projection, synchronization, export/restore, and generated types for both Start- and Deadline-based schedules.
- Backfill existing deadline-bearing revisions as Deadline-based and non-deadline revisions as Start-based without changing historical dates, occurrences, logical keys, generated tasks, or projected pairs.
- Guard production birthday and holiday definitions with an explicit private manifest and migration assertions that preserve their Deadline basis and controlling Deadline sequences.
- Standardize shared Dialog and AlertDialog geometry so an edge-to-edge modal has square, borderless edges and an inset modal retains rounded bordered corners.
- Disable repeat reminders when the user commits an empty or unparseable reminder-time value.

## Capabilities

### New Capabilities

- `responsive-modal-geometry`: Shared edge-to-edge versus inset modal corner behavior across BathOS.

### Modified Capabilities

- `personal-tasks-module`: Repeat editing, recurrence rule semantics, dual date bases, compatibility APIs, projections, activation, synchronization, portability, and production-preserving migration behavior.

## Impact

- Shared UI primitives: `src/components/ui/dialog.tsx` and `src/components/ui/alert-dialog.tsx`.
- Tasks UI and domain: repeat dialog, recurrence date evaluation, recurrence services, hooks, prototype editing, types, generated database types, and tests.
- Supabase: recurrence revision schema, authoritative evaluator and lifecycle functions, versioned RPCs, export/restore compatibility, pgTAP coverage, and production migration/readback tooling.
- PowerSync: synchronized recurrence revision columns and schema mappings.
- Production rollout: private backup and owner-scoped pre/post manifests, database-first deployment, drift assertions, web publication, and post-release monitoring.
