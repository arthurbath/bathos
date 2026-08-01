## Context

Upcoming currently sorts ordinary tasks by the general task `order_key` and recurrence prototypes by an `order_key` embedded in immutable prototype content. That visually merges two models without providing one persisted rank or allowing prototype drag. The same mismatch propagates to midnight activation and native widget snapshots. Quick Find, shared Calendar, and native WKWebView behavior also contain isolated assumptions that now conflict with the intended product behavior.

## Goals / Non-Goals

**Goals:**

- Make one dedicated Upcoming rank authoritative across ordinary tasks, recurrence prototypes, activation, and widgets.
- Preserve recurrence cadence and immutable prototype content while allowing the projection itself to move inside its current date bucket.
- Make Quick Find and open-task editing spatially predictable.
- Preserve current-day semantics across every visible Calendar cell.
- Restore native iOS scrolling while disabling container-owned history swipes.
- Remove retired Template references from active sync configuration.

**Non-Goals:**

- Moving recurrence prototypes to a different cadence date by drag.
- Adding a new PowerSync table or changing the 17-table publication boundary.
- Replacing browser-native scrolling or task drag with a custom gesture engine.
- Guaranteeing suppression of Safari's PWA history gesture, which is controlled by the browser container.

## Decisions

### Store a dedicated Upcoming rank on both row identities

Add nullable `upcoming_order_key` columns to `tasks_todos` and `tasks_recurrence_definitions`. Backfill tasks from `order_key` and definitions from the current prototype snapshot. Upcoming uses only this rank as its within-bucket secondary sort. The recurrence definition owns projection placement because revisions and prototype snapshots remain immutable content/schedule records.

Alternative considered: keep updating `tasks_todos.order_key` and prototype snapshot JSON. Rejected because it couples Upcoming to Today/Anytime order and turns a presentation move into a recurrence-content revision.

### Reuse task mutation authority and add a narrow recurrence reorder RPC

The client calculates a fractional rank from the rendered mixed row sequence. Ordinary tasks persist that rank through the existing owner-scoped task mutation path. Recurrence definitions use a dedicated SECURITY DEFINER function that validates ownership, active status, revision concurrency, the current controlling date, and the proposed rank before updating only the definition projection. The UI accepts drops only inside the rendered controlling-date bucket and rolls optimistic state back on rejection. Recurrence cross-bucket drops fail closed.

Alternative considered: add one new RPC that mutates both row kinds. Rejected because ordinary task updates already have a versioned, undo-aware, offline-capable mutation authority. Routing them through a second channel would duplicate concurrency and history behavior without strengthening the recurrence boundary.

### Promote Upcoming rank through activation and widget projection

Midnight activation orders reached tasks by `upcoming_order_key` and writes Inbox `order_key` in that sequence. Recurrence spawn copies the definition's Upcoming rank into the ordinary instance. Both the in-app native bridge and credential-backed server snapshot sort normal rows and virtual prototypes by controlling date then Upcoming rank, so the leading ten rows match the list.

### Keep Quick Find input focus while styling the active row

ARIA active-descendant remains on the query input, but the active option receives the standard subdued blue whole-task surface and never receives browser tab focus. The palette anchors near the top of the visual viewport and grows downward. Route labels derive from the same planning-route decision used for navigation.

### Render the open Summary input through a row-owned slot

The existing editor continues to own local value, autosave, undo, and focus logic. When open, it portals that same Summary input into a slot beside the task completion control and omits the duplicate editor-row field. Closed-row metadata and ellipsis are hidden until close.

### Apply native policies at the WKWebView boundary

Set `allowsBackForwardNavigationGestures` to false. Keep the WKWebView scroll view vertically scrollable with bounce and ordinary deceleration while leaving web pointer/touch drag ownership unchanged. For installed web surfaces, CSS may suppress horizontal overscroll propagation, but Safari PWA history navigation is treated as best-effort only.

## Risks / Trade-offs

- [Fractional ranks can converge after extensive repeated inserts] -> Reuse the established rank generator and retain deterministic id fallback; rebalance only if later evidence requires it.
- [Mixed-row ranking and persisted rows can diverge] -> Keep ordinary tasks on their established optimistic mutation path, return the authoritative recurrence definition from its RPC, and roll back either row kind on rejection.
- [Native bounce could reintroduce fixed-control displacement] -> Apply bounce only to the WKWebView scroll view and validate that fixed nav/add controls remain viewport-bound.
- [PWA swipe suppression may remain incomplete] -> Report Safari's container limitation and avoid invasive history rewriting.
- [Legacy PowerSync clients can retain warning state] -> Deploy rules without retired tables, verify the 17-table publication, and allow normal client reconnect/reinitialization rather than fabricating compatibility tables.

## Migration Plan

1. Add and backfill the two nullable Upcoming-rank columns without changing task content, recurrence cadence, or table count.
2. Add checks/indexes and the recurrence projection reorder RPC, update activation and widget projection functions, and add database tests.
3. Update PowerSync client schema/types and verify sync rules contain exactly the 17 approved Tasks tables.
4. Publish the backward-compatible web client before or with the migration; old clients ignore the new columns and continue using existing order until refreshed.
5. Rebuild/install native companions after web/native code validation.

Rollback is code-first: an older client can ignore the new columns. The additive columns and RPC can remain safely present if the UI is rolled back. The deployment does not delete or rewrite user-authored content.

## Open Questions

None. Safari PWA history-gesture suppression will be documented as best-effort if the browser continues to own it.
