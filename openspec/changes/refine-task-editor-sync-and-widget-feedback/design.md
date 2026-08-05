## Context

Tasks uses one React task editor for browser and native-hosted routes, an owner-bound local PowerSync database for synchronized task state, and shared Swift WidgetKit source for the iOS and macOS widgets. Several regressions cross those boundaries: editor behavior is distributed between drawer composition, shortcut handling, and close-time reconciliation; native convergence depends on both the database sync lifecycle and React subscription lifecycle; and widget presentation is shared even though Lock Screen typography is iOS-specific.

The change must preserve ordered autosave, deferred movement of an open task, offline launch, module isolation, owner boundaries, and the existing bounded widget projection. It does not require a database migration unless investigation proves that a persisted schema field is missing.

## Goals / Non-Goals

**Goals:**

- Make the task editor's visual, DOM, focus, and shortcut behavior match the intended metadata workflow.
- Give blank Summary values one consistent definition based on whether the task contains other meaningful user content.
- Keep open tasks visually stable and reconcile their canonical view only when the drawer closes.
- Ensure the native macOS host observes externally originated authoritative changes without manual refresh.
- Present far-future Upcoming Start metadata, reminder feedback, and Apple widget empty states consistently.
- Verify browser behavior with focused tests and native presentation with reproducible builds and native tests where practical.

**Non-Goals:**

- Redesign task persistence, list sorting, recurrence, or the complete PowerSync topology.
- Add native task editing beyond the existing web-hosted macOS companion.
- Change widget projection privacy, supported widget families, or list configuration.
- Add a new reminder transport or delivery provider.

## Decisions

### Keep one authoritative task editor composition

The existing metadata drawer remains the only editor implementation. Its component order will be changed directly so visual, DOM, Tab, and accessibility order cannot drift. Control+N will be handled by the shared task-command layer and will focus Notes through an explicit ref, while ordinary Summary arrow-key editing remains native.

Alternative considered: CSS-only reordering. Rejected because it would leave DOM and keyboard order inconsistent with the visual order.

### Treat meaningful content as the persistence boundary

Summary will no longer be the sole persistence gate. A task is meaningful when trimmed Summary, Notes, Primary Link, or any nonblank checklist item exists. An existing task may persist a blank Summary when another meaningful field exists. Closing an existing task with no meaningful content will use the ordinary recoverable-delete lifecycle so undo, Done history, and synchronization remain coherent.

Alternative considered: retain the old Summary on blank input. Rejected because it contradicts the user's visible edit and creates stale-data restoration.

### Anchor open rows by identity until close

The open-row snapshot already used for stable editing will apply to Today as well as Anytime. Field values update immediately, but membership and bucket placement remain anchored to the opened position. Closing flushes autosave, releases the anchor, re-derives canonical membership, and only then emits departure feedback.

Alternative considered: optimistically move the open card. Rejected because it interrupts editing and violates the established open-editor contract.

### Repair native convergence at the subscription lifecycle

The investigation will trace an externally created task from the PowerSync download stream through the local query subscription into the React task repository. The fix will keep a live query/subscription active for the current owner while the native WebView is visible and will recover the sync session when macOS foregrounding or WebKit lifecycle transitions suspend it. It will not add polling unless the underlying transport cannot provide a live invalidation signal.

Alternative considered: periodic full-page refresh. Rejected because it disrupts local UI state, wastes work, and masks the broken synchronization lifecycle.

### Keep widget presentation in shared native source

The large-widget empty-state renderer will use the closest native Sparkles symbol and center the icon/message group inside the body area beneath the header. The iOS accessory rectangular renderer will retain its platform-specific task rows and explicitly use the Calendar-matched 13-point regular system type treatment.

Alternative considered: separate iOS and macOS empty-state implementations. Rejected because the large widgets intentionally share one renderer and should continue to evolve together.

## Risks / Trade-offs

- [Blank Summary tasks expose assumptions that Summary is always nonempty] -> Centralize the meaningful-content predicate and add repository/editor tests for each qualifying field and empty-close deletion.
- [Open-row anchoring can hide accepted membership changes too long] -> Release the anchor only through the ordinary close path after pending autosave is flushed, then test Today-to-Anytime reconciliation.
- [Native lifecycle recovery can duplicate subscriptions] -> Make subscription ownership explicit, tear it down on owner/session replacement, and assert one effective listener across foreground transitions.
- [Widget symbol availability varies by OS] -> Use availability-safe native symbol lookup with a conservative system-symbol fallback.
- [Font comparisons to Calendar are visual] -> Encode the exact 13-point regular system font contract and verify the compiled SwiftUI source and rendered preview where available.

## Migration Plan

1. Ship the web and native source changes without a data migration unless investigation identifies persisted-state drift.
2. Build and test the web bundle and both native companion targets.
3. Publish the web release before rebuilding native wrappers so their hosted route resolves compatible assets.
4. Roll back by reverting the application changes; task data remains compatible because no destructive schema change is planned.

## Open Questions

- Whether the native staleness is caused by a suspended PowerSync stream, a disposed React live query, or a stale bundled/web asset will be resolved from runtime evidence before selecting the exact repair.
