## Context

Tasks stores a calendar recurrence's `next_occurrence_date` as its cadence date. For a recurrence with a Deadline and an early Start, the cadence date is the Deadline while the projected Upcoming bucket is the earlier Start date. The current evaluator compares the cadence date directly with the owner's planning date. It therefore leaves a prototype in a current-day Upcoming bucket until the later Deadline arrives.

Foreground code previously compensated by requesting evaluation through the cadence date. A later safety repair correctly prohibited evaluation beyond the owner's planning date, exposing the underlying server-model mismatch. The minute cron currently calls ordinary Start and Deadline activation but does not evaluate recurrence definitions, so a recurrence can also remain stale until a client opens Tasks.

## Goals / Non-Goals

**Goals:**

- Give recurrence evaluation one authoritative spawn-date calculation.
- Spawn calendar work when its projected Start reaches the owner's planning date, while retaining the cadence date as the generated Deadline.
- Run due recurrence generation from the existing owner-local activation job so midnight behavior does not depend on an open client.
- Keep authenticated evaluation bounded by the current planning date and idempotent under retries.
- Repair already-due production recurrence definitions without duplicating occurrences.

**Non-Goals:**

- Redesign recurrence editing, recurrence rules, or after-completion behavior.
- Change the meaning of ordinary task Start or Deadline fields.
- Add a second scheduler or a client-side future-evaluation exception.

## Decisions

### Treat cadence date and spawn date as separate server concepts

For a calendar revision with an early-Start Deadline offset, the spawn date is `cadence date - deadline_offset_days`. Otherwise the spawn date is the cadence date. The durable recurrence cursor continues storing the cadence date because cadence advancement and the generated Deadline derive from it.

This preserves existing recurrence rules and avoids rewriting definitions to store a different semantic value.

### Share one owner-parameterized evaluator between authenticated RPC and activation

The recurrence-generation body will live in a private owner-parameterized function. The authenticated RPC will validate `auth.uid()`, resolve the owner planning date, reject a future `through_date`, and delegate to the private evaluator. The activation function will call the same evaluator with the owner and current planning date.

This avoids a second recurrence implementation in cron and keeps the same occurrence uniqueness boundary, catch-up policy, cursor advancement, and evaluation receipt behavior.

### Evaluate recurrence before ordinary reached-date activation

For each owner, the activation transaction will evaluate active definitions whose computed spawn date has reached the planning date before processing ordinary reached Starts and Deadlines. A generated reached instance will persist its projected Start, receive Today Inbox placement, and retain its cadence-derived Deadline. The definition advances in the same transaction, so synchronized clients cannot observe a current-day prototype without its generated instance after activation commits.

The existing minute cron remains the scheduler. No new cron job or secret is introduced.

### Remove client future-date compensation

The web hook will request evaluation only through the owner's planning date. Due determination uses the shared spawn-date rule. This keeps foreground catch-up safe while background activation remains authoritative.

### Repair due definitions through the same activation path

The migration will install the corrected functions and invoke owner-local activation once. Existing logical-key uniqueness and row locking make the repair idempotent. Guarded preflight and postflight queries will prove that due prototypes advanced and generated at most one ordinary instance per logical event.

## Risks / Trade-offs

- **Risk: Cron and foreground evaluation race.** -> Both paths lock the recurrence definition and enforce a unique logical key, so the second transaction returns or observes the existing occurrence.
- **Risk: A large missed range creates many instances.** -> Existing missed policies and catch-up limits remain authoritative.
- **Risk: Current-day Start plus Today placement violates ordinary mutation rules.** -> The existing system-activation context is used only inside the authoritative activation transaction.
- **Risk: Migration-time activation changes production rows.** -> Refresh the private backup, record exact due-definition preflight, apply the migration once, and verify occurrence and definition deltas before acceptance cleanup.

## Migration Plan

1. Refresh and verify the private production Tasks backup.
2. Record active definitions whose computed spawn date is on or before each owner's planning date, including their existing occurrences and cursor state.
3. Apply the migration that adds the shared spawn-date helper, private evaluator, corrected authenticated wrapper, instantiation behavior, and recurrence-aware activation.
4. Let the migration invoke activation once to repair due work.
5. Verify the affected recurrence generated exactly one ordinary instance, retained its cadence-derived Deadline, received its projected Start and Today Inbox placement, and advanced its prototype.
6. Verify cron, PowerSync table count, advisors, production migration parity, and rendered Today and Upcoming behavior.

Rollback is a forward migration restoring the prior function definitions. Generated ordinary instances are not deleted automatically because they are user-visible work. Any rollback must first audit occurrence provenance and obtain explicit approval for data deletion.

## Open Questions

None.
