## Context

Anytime and Someday are now divided into an unlabelled unassigned region followed by effective-Area buckets. Tasks inside each bucket use one destination-wide fractional `order_key`, and cross-Area drops combine organization and order changes in one undoable mutation. `tasks_user_settings` already provides a synchronized, owner-scoped preference row through PowerSync, while `bathos_user_settings` is used for platform preferences that need a Supabase-first fallback.

Automatic sorting must remain a projection rather than continuously rewriting every task. Manual rank still matters as the final tie-breaker, cross-Area movement must remain available, and disabling the preference must deliberately convert the projected order into a durable fully manual order.

## Goals / Non-Goals

**Goals:**

- Provide one synchronized, off-by-default preference for both Anytime and Someday.
- Produce one deterministic comparator inside every effective-Area region.
- Preserve manual ordering among exact automatic-sort peers.
- Communicate legal and illegal pointer-drop positions without preventing Area traversal.
- Materialize the visible automatic order when the preference is turned off.
- Preserve retained-editor, draft, focus, selection, undo, animation, Quick Filter, and offline-first behavior.
- Preserve manual task rank inside Upcoming's visible date sections and make cross-section drops update Start atomically.

**Non-Goals:**

- Show headings or labels for the invisible sort groups.
- Automatically sort Today, Upcoming, Done, Projects, Area detail, or Project detail.
- Preserve a second historical manual ordering.
- Add keyboard reordering.
- Change task organization, planning metadata, or actionability merely to make a drop legal.
- Apply the migration or release to production without separate approval.

## Decisions

### Store one owner preference in the existing synchronized settings row

Add `automatic_list_sorting boolean not null default false` to `tasks_user_settings`. The setting follows the existing owner-scoped RLS and PowerSync entity without adding a publication table. The client reads and writes it through the local repository so it remains offline-first and converges across sessions and devices.

Alternative considered: store the setting only in `bathos_user_settings`, following Quick Filters. Rejected because automatic ordering directly controls offline Tasks behavior and the existing Tasks settings entity already synchronizes through PowerSync.

### Compare one immutable automatic tuple inside each Area

For Anytime, compare:

1. Deadline, with non-null ISO calendar dates ascending and null last
2. Horizon rank: Inbox, Now, Next, Later, null
3. Actionability rank: Ready, Rechecking, Waiting
4. Existing manual `order_key`, then stable task ID

For Someday, every valid task lacks a Today horizon, so the horizon comparator ties and the effective order is Deadline, Actionability, then manual rank. The comparator runs after effective-Area partitioning, never across Areas.

Alternative considered: persist a computed sort key. Rejected because all source fields are already synchronized and a derived column would add consistency and migration risk.

### Retain current placement until editor close

The existing retained projection captures Deadline, horizon, actionability, Area, and order values when a task opens. Comparator inputs use that retained snapshot until close, after which the ordinary delayed reconciliation and movement animation reveal the new sorted position.

Drafts remain pinned at their contextual creation location while open and join the automatic projection after close.

### Restrict peer reordering without restricting Area traversal

Define automatic peers as tasks with equal normalized Deadline, Today horizon, and Actionability. In automatic mode, same-Area drop markers may move only among peers. Passing over a non-peer leaves the most recent legal marker unchanged. Entering another Area computes the canonical insertion range for the dragged task's unchanged automatic tuple:

- If peers exist, the pointer can choose among them.
- If no peers exist, the marker uses the single boundary between the surrounding automatic groups.

Dropping anywhere over the Area commits at the displayed legal marker. Cross-Area drops preserve the existing exact-container behavior, including clearing an incompatible Project.

The Tasks module root is the drop-commit surface. Once a legal marker exists,
releasing over blank list space, fixed navigation, or any other descendant of
the module commits at that marker. Task rows only update the marker; they do not
own commitment. A drag end without an in-app `drop` event remains a
cancellation because browsers do not reliably distinguish Escape from a
release outside the browser.

### Materialize visible order when disabling

Before setting the preference to false, read the complete unfiltered Anytime and Someday projections, grouped in effective-Area display order, and assign a fresh monotonic fractional `order_key` sequence matching their automatic order. Persist all changed keys as one ordered batch, then disable the preference.

This makes the last automatic projection the starting fully manual order. It does not retain or restore a second historical sequence.

Alternative considered: disable the comparator without rewriting keys. Rejected because the visible order could immediately jump back to an obsolete manual sequence.

### Keep preference changes ordered and recoverable

Enabling changes only the preference. Disabling first materializes task order and only then changes the preference, so a failed materialization leaves automatic sorting enabled rather than exposing a partial manual projection. Repository operations run through the local PowerSync database and surface ordinary Config error feedback.

### Treat each visible Upcoming section as one manual task-order scope

Upcoming retains chronological ordering between its visible day, month, and year
sections. Inside one visible section, task rows use durable `order_key` rank
instead of exact controlling-date rank. Project entries retain their existing
chronological slots and are not task drag targets.

Dragging between task rows in one section changes only `order_key`. Entering a
different section records both the destination section identity and its
canonical future date. A grouped month or year uses its first calendar date
that actually maps back to that visible section, preserving first-of-month and
first-of-year behavior where legal while avoiding a past or nearer-bucket date
at a grouping threshold. The eventual drop applies `destination = anytime`,
`today_section = null`, the canonical date as `start_date`, and the new
`order_key` in one undoable task mutation. The existing Upcoming derivation
continues to prefer a future Start over Deadline, so a deadline-only task gains
the new Start, retains its Deadline, and appears exactly once under Start.

The section itself is a drop surface. When it has task rows, hovering blank
section space projects the marker to the first or last task. When it has no task
rows, the section displays a boundary marker and the drop applies the Start
without requiring an order target. Reminder projection is refreshed after the
Start mutation succeeds.

## Risks / Trade-offs

- [A large disable operation updates many tasks] → Batch updates transactionally, skip unchanged keys where safe, and add large-library performance coverage.
- [Quick Filters hide tasks when disabling] → Materialize from the complete unfiltered owner projection rather than the rendered filtered subset.
- [An open task changes its automatic tuple] → Use the retained placement snapshot until close.
- [A remote preference change disables sorting without this client initiating materialization] → The writing client must materialize before publishing false; older clients treat the new field as absent and continue manual behavior until upgraded.
- [Concurrent task edits race with disable materialization] → Use current local revisions and fail the ordered transaction rather than partially rewriting.
- [Pointer movement over illegal groups feels detached] → Keep the marker visible at the last legal position and update it immediately on entering a legal peer range or another Area.
- [Releasing outside a row silently ignores the displayed marker] → Commit from the Tasks module boundary whenever the browser delivers an in-app drop event.
- [An outside-window release resembles an Escape cancellation] → Require an in-app drop event instead of committing blindly from drag end.
- [A destination Upcoming section contains projects but no task row] → Make the section itself a legal date target and permit a Start-only drop.
- [A deadline-only task could render under both dates after gaining a Start] → Keep the existing Start-first Upcoming derivation and retain only one entry per task.
- [Moving a reminded task changes its delivery date] → Reschedule the existing reminder immediately after the atomic Start-and-order mutation.
- [Global fractional keys span multiple Areas] → Generate one globally monotonic order matching Area display order when materializing, while automatic mode continues comparing only within each Area.

## Migration Plan

1. Add the default-false settings column and update generated types, PowerSync schema, connector, portability, and tests.
2. Ship clients that understand the preference and can materialize order before disabling it.
3. Apply the additive migration only after a verified private production backup and explicit approval.
4. Existing owners begin with sorting disabled and no task rewrite.
5. Rollback the client to manual projection. The additive column may remain harmlessly false; dropping it is unnecessary.

## Open Questions

None.
