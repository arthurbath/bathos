## Why

Upcoming currently treats every task carrying recurrence lineage as the recurrence definition's protected schedule projection. That conflates the permanent recurrence prototype with ordinary spawned task instances, preventing reached instances from behaving like normal editable tasks and leaving after-completion restoration behavior inconsistent.

## What Changes

- Distinguish the one future recurrence prototype from ordinary task instances by the occurrence's authoritative scheduled date rather than by recurrence lineage alone.
- Keep one future calendar prototype visible in Upcoming while reached occurrences behave as normal tasks everywhere they are eligible to appear.
- Keep after-completion prototypes in the Repeating Tasks waiting section while their latest instance remains open, then place the prototype in its next dated Upcoming bucket after that instance is completed or trashed.
- Return an after-completion prototype to waiting when its latest completed or trashed instance is restored before the successor is spawned.
- Apply prototype-only controls consistently in Upcoming, Quick Find, and native widget projections without withholding normal task controls from recurrence instances.
- Preserve deterministic occurrence identity, immutable recurrence history, and the existing PowerSync Tasks table allowlist.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine recurrence generation, waiting, restoration, Upcoming presentation, Quick Find, and widget behavior so recurrence prototypes and spawned instances have distinct semantics.

## Impact

- **Supabase:** Recurrence evaluation and after-completion lifecycle triggers, plus a forward-only migration and focused database tests.
- **Tasks web module:** Recurrence projection derivation, Upcoming row behavior, waiting rows, selection eligibility, drag behavior, and Quick Find routing.
- **Native widgets:** Upcoming rows distinguish only genuine future recurrence prototypes from ordinary spawned instances.
- **Synchronization:** No new table is introduced, so the approved PowerSync Tasks table count remains unchanged.
