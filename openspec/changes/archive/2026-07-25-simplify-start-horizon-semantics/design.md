## Context

BathOS currently represents Today work as `start_date = null` plus a non-null `today_section`, while future work stores both a future `start_date` and a preselected `today_section`. Database constraints, normalization triggers, local repositories, template and recurrence services, export and restore, MCP actions, reminders, and reached-date activation all encode that pairing.

The revised product model treats Start and horizon as mutually exclusive states. `start_date` remains the future-only persisted deferral date. A Today Start is represented by the existing active form, `start_date = null` plus `today_section IN ('inbox', 'now', 'next', 'later')`. This preserves the existing view model without storing today's date redundantly.

## Goals / Non-Goals

**Goals:**

- Store no horizon on future-start to-dos or projects.
- Activate reached future work into Today Next.
- Place specialized Mail captures in Today Inbox without changing the ordinary Today Next creation default.
- Make Control+R synchronously visible in an open editor and its row while persistence proceeds.
- Use `Start` consistently in user-facing Tasks language.
- Keep web, local PowerSync writes, production PostgreSQL, MCP, templates, recurrence, portability, and reminders on one invariant.

**Non-Goals:**

- Add another calendar field or change the `start_date` column type.
- Change the four Today horizon values or their cycle order.
- Change reminder date derivation from future Start or Today planning.
- Change the synchronized table set, RLS ownership boundary, or PowerSync publication.

## Decisions

The canonical placement forms are:

- Someday: `destination = 'someday'`, `start_date = null`, `today_section = null`.
- Unplanned Anytime: `destination = 'anytime'`, `start_date = null`, `today_section = null`.
- Today: `destination = 'anytime'`, `start_date = null`, `today_section` non-null.
- Future: `destination = 'anytime'`, `start_date` later than the owner planning date, `today_section = null`.

Control+R always requests Today placement. It cycles the current horizon only when the target is already Today. Unplanned, Someday, and future work enter Today Now on the first invocation. The command clears future Start as part of the same atomic planning mutation.

The existing optimistic task-list layer remains the source for immediate row-summary updates. TaskEditor will additionally reconcile local `startDate` and `todaySection` state from accepted task props, matching its Actionability and Organization reconciliation.

An open task keeps a separate immutable view-placement snapshot captured when its editor opens. Current task data continues to drive the editor and row metadata, while the snapshot alone drives current-list membership, grouping, and ordering until close. Closing the editor starts a brief settling interval while the snapshot remains active. Releasing the snapshot after that interval applies the latest projection exactly once. Same-destination planning changes preserve `order_key`; only entering a different destination assigns a new destination-tail key. When a released task remains on the current page but changes position, Tasks uses a calm FLIP-style movement animation unless reduced motion is requested.

Completion uses the same perceptual sequence for pointer and keyboard activation. The checkbox reflects accepted completion intent immediately, the row remains in place for a brief settling interval, and the row then collapses before the transition removes it from the active list. Reduced-motion preference skips the decorative settling and movement delays so mutation feedback remains immediate.

Every successful local task mutation reports its client mutation identifier to the history hook. Until the matching authoritative history event projects, the hook withholds older undo candidates. An immediate undo or redo command may wait for a bounded interval, but it remains anchored to the identifier that existed when the command was invoked. Once that exact event and its current task snapshot form a safe pair, the ordinary guarded repository inverse runs. Timeout, an unsupported event, or a different newer event resolves as a no-op rather than applying the command to unrelated history.

Reminder entry is committed through one guarded interaction even if assigning Today Inbox rerenders or blurs the Start picker while persistence is pending. Because root planning is a local-first PowerSync write while reminder persistence is a direct Supabase RPC, the reminder service retries only the exact temporary server response indicating that the root's Start planning has not arrived yet. The retry reuses one mutation identifier and remains bounded so unrelated reminder failures surface immediately.

Collapsed task rows present reminder intent as the Lucide bell plus the reminder's local wall-clock time in 12-hour form with an uppercase meridiem. The Start date already determines the reminder day, so row metadata does not repeat a date or introductory reminder phrase. Start and Deadline triggers retain the ordinary input background on hover even though their popovers are activated by button elements.

The database migration will activate any open present Start that reaches its owner-local date between preflight and execution, clear obsolete horizons from every remaining Start-bearing to-do and project, replace planning constraints and normalization triggers, and change reached-date activation to assign Next. Retained completed, canceled, or deleted history may preserve the Start that applied while it was active, but its Today horizon is cleared and future-only validation resumes if the work returns to an active present state. Export, restore, template, recurrence, MCP, and undo or redo normalization must emit only canonical forms. Existing reminders remain anchored to a future Start and are not canceled merely because its obsolete future horizon is cleared.

The specialized Mail capture function remains an integration-owned exception to the ordinary active-capture default. It creates an active Anytime task with no future Start and the Inbox horizon. The caller supplies the final AI-processed title and notes once; BathOS owns the placement default and idempotent source record.

The release is coordinated but production mutation remains separately gated. Code, migration, MCP function, and tests can be prepared locally. Applying the migration, deploying the MCP function and web release, and running a disposable production fixture require explicit approval after a fresh verified private backup and owner-scoped preflight counts.

## Risks / Trade-offs

- [Risk] Existing future work loses its previously selected arrival horizon. → Mitigation: The migration clears only inapplicable future horizons and activation deterministically assigns Next.
- [Risk] Deploying web code before the database migration lets the old trigger recreate Next on future rows. → Mitigation: Treat migration, MCP, and web publication as one approved release and verify production parity afterward.
- [Risk] A stale editor can overwrite a keyboard planning change. → Mitigation: Reconcile only when accepted planning props change while direct picker edits continue updating local state immediately.
- [Risk] Reminder rebinding can be mistaken for planning removal. → Mitigation: Preserve reminders when moving between future Start and Today horizon, and cancel only when both Start forms are absent.
- [Risk] Freezing the whole task record would hide accepted Start or horizon metadata while editing. → Mitigation: Freeze only the view-placement snapshot and render the latest task record.
- [Risk] Destination-scoped order generation can silently rewrite Anytime manual rank during a horizon change. → Mitigation: Preserve `order_key` whenever the destination itself is unchanged.
- [Risk] Delaying persistence to create visual calm can lose completion intent if the page closes during the pause. → Mitigation: Keep the pause in the presentation layer around an already-started mutation or a bounded terminal-action handoff, never as an unsaved long-lived state.
- [Risk] Buffering Command Z during projection lag could undo a later unrelated change. → Mitigation: Bind the wait to the exact client mutation identifier returned by the accepted local write and expire it after a bounded interval.

## Migration Plan

1. Create and validate the migration locally with database tests.
2. Refresh and verify the private production backup and count affected future roots.
3. Apply the migration, deploy the matching MCP function, then publish the matching web release.
4. Run and clean up an owner-scoped fixture proving future Start without horizon, Control+R Today cycling, reached-date activation to Next, specialized Mail capture to Today Inbox, reminders, portability, and PowerSync projection.
5. Verify cron, advisors, publication parity, and production data invariants.

Rollback requires restoring the prior constraints and trigger, assigning Next to future roots that have a null horizon, and redeploying the prior MCP and web versions. The private predeployment backup remains the authoritative recovery point.

## Open Questions

None. Reached future work enters Today Next, preserving the prior default without storing a premature future horizon.

## Production Acceptance

The approved release completed on 2026 Jul 25. A fresh owner-only logical backup was written immediately before production mutation and verified twice with the same SHA-256 digest. Migration `20260725001910_enforce_exclusive_tasks_start_horizons.sql` then applied successfully after a clean transactional rollback exposed six terminal historical Starts that needed preservation. The corrected migration activates reached open work before replacing the trigger, clears every obsolete horizon paired with a Start, preserves terminal historical Starts, and applies future-only validation when work returns to an open present state.

Production retains 24 to-dos and no projects. The eight preflight Start/horizon conflicts are normalized to zero, all active Starts satisfy the future-only invariant, and six terminal historical Starts remain intact. MCP function version 13, Lovable deployment `e40935e8-a34f-47ce-90c1-c4911d8251c6`, the exact 21-table PowerSync publication, and all three once-per-minute Tasks jobs are active. The owner-scoped exclusive-Start fixture passed Supabase and fresh PowerSync acceptance, and cleanup independently returned zero synthetic users, to-dos, projects, settings, and reminders. Current advisors contain only documented preexisting findings and no regression from this migration.

Inbox Manager permanent parallel mode was enabled at `2026-07-25T14:54:43.778Z` with no expiry or acceptance limit. The first ordinary new-Mail run completed successfully and reused its established final AI results to create three verified Things tasks and three BathOS Today Inbox tasks. The installed runtime remained healthy with zero pending requests, retries, handoff failures, item incidents, or enrichment incidents. Supabase contained each opaque accepted task ID at revision 1 with one structured Mail source and one creation event. A fresh disposable PowerSync database independently projected the same three tasks and three creation events, then disconnected, cleared, closed, and removed its local files. No backfill or Mail-retirement synchronization ran.
