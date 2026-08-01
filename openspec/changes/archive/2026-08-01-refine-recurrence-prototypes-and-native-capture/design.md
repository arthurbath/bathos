## Context

The current recurrence work distinguishes future prototypes from reached ordinary instances, but the prototype row still jumps directly to Edit Repeat and is excluded from selection. Template snapshots are immutable and already provide the correct source boundary, so prototype editing must create a new template revision rather than copy data from any instance. The Apple companions share a WidgetKit renderer and host the same production web application in persistent WebKit stores.

Apple exposes native orientation declarations for iPhone targets. A PWA can request `portrait-primary` through its web-app manifest, but iOS may ignore that request. On macOS, a system-wide shortcut can be registered without monitoring arbitrary text input, and a small AppKit panel can host a second app-bound `WKWebView` that shares the default website data store with the main Tasks window.

## Goals / Non-Goals

**Goals:**

- Make recurrence prototypes editable, selectable, recoverable, and safely draggable.
- Keep the prototype's latest immutable template revision as the sole content source for future instances.
- Reuse the exact web new-task form in a global macOS overlay.
- Simplify Lock Screen rows, refine the mobile-navigation outline, and lock the native iPhone app to portrait.

**Non-Goals:**

- Do not make a prototype's Start or Deadline directly editable.
- Do not propagate any spawned-instance metadata or checklist edits into the prototype.
- Do not add a native macOS task database or duplicate the web task form in Swift.
- Do not use scripted CSS rotation to imitate a PWA orientation lock.
- Do not remove dormant recurrence-ending columns from stored historical revisions.

## Decisions

### Prototype edits create a new template revision

The dated projection task is the prototype editing surface. On editor commit, an owner-scoped RPC captures that task into a new immutable template revision and creates a recurrence revision that retains the schedule while pointing to the new template revision. Every future instance is copied from that prototype revision, including its Primary Link and checklist content, order, and completion states. Reached instances keep their original provenance and never supply content to the prototype or a later instance. For after-completion schedules, the prior instance contributes only its authoritative Done date as the next timing anchor. This reuses the existing snapshot authority and prevents instance-to-prototype feedback.

### Prototype lifecycle follows the ordinary task boundary

Prototype metadata commits use one owner-scoped recurrence RPC because the
immutable template snapshot and recurrence revision must advance atomically.
Deletion and restoration continue through the ordinary task lifecycle
operation. Owner-safe database triggers recognize only the active prototype,
atomically pause or resume its recurrence definition, and preserve the ordinary
30-day recovery boundary. Permanent purge archives the definition so a removed
prototype cannot generate again.

### Mixed bulk changes use intersection semantics

Selection stores prototypes normally. The Edit menu derives the intersection of supported operations. Cross-date group drops filter prototypes out of the metadata patch while preserving eligible ordinary-task order and selection. Same-date drops may reorder prototypes because order is not cadence metadata.

### The Mac overlay hosts the web workflow

The companion registers a user-recorded global shortcut and presents an AppKit floating panel containing a second app-bound `WKWebView` with the default persistent data store. The panel loads a dedicated Tasks quick-entry route that reuses the existing draft/editor component and hides the list shell. A narrow native bridge closes the panel after commit or cancellation. This preserves authentication, pickers, keyboard commands, and mutation history without a second implementation.

The panel applies its intended content size after installing the SwiftUI hosting controller and again before every presentation. Its native minimum and maximum content sizes are pinned to that same geometry so the hosting controller's initially tiny intrinsic size cannot collapse the overlay before WebKit renders the form.

The quick-entry route uses a drawer-only presentation of the shared editor: it omits the list-row checkbox, summary preview, source affordance, and ellipsis menu, removes the ordinary open-row blue treatment, and reduces overlay-only spacing without forking the editor behavior. The native panel is compact but remains tall enough for the largest temporal picker. Start and Deadline use the same authoritative web picker panels and keyboard handoff as the ordinary task editor, but anchor those panels at the overlay viewport center so they remain fully visible inside the WKWebView. Web content cannot paint beyond its native window, so a separate out-of-window picker would require a second native implementation and is intentionally rejected. Long Notes and checklists continue to scroll within the overlay.

### PWA orientation remains declarative

The iPhone target declares portrait only. The Tasks manifest requests `portrait-primary`; no forced JavaScript orientation lock or rotated DOM fallback is added because Safari support is not authoritative and scripted rotation would degrade accessibility and input behavior.

## Risks / Trade-offs

- [Risk] A template commit and recurrence revision could race with another editor. → Use expected record revisions and return a conflict without overwriting either edit.
- [Risk] A global shortcut conflicts with another app or macOS. → Validate modifiers, retain the last working registration, and report registration failure.
- [Risk] A second WebKit surface opens before authentication is available. → Share the persistent data store and show the ordinary authenticated loading/sign-in state in the panel.
- [Risk] An anchored date picker is clipped by the compact WebKit viewport. → Reuse the same picker content with a quick-entry-only viewport-center anchor and retain the ordinary keyboard contract.
- [Risk] Widget changes accidentally affect large widgets. → Branch the minimal presentation exclusively on `.accessoryRectangular` and retain shared large-widget rendering.
- [Risk] iOS ignores PWA orientation. → Treat the manifest member as best effort and report the limitation rather than simulate rotation.

## Migration Plan

1. Apply a forward-only Tasks migration adding one owner-scoped prototype
   commit RPC and owner-safe lifecycle triggers without adding a table or
   PowerSync publication.
2. Deploy the backward-compatible web client and recurrence tests.
3. Build the iOS and macOS companions with the updated shared widget source, orientation metadata, native bridge, shortcut manager, and overlay.
4. Roll back the web/native clients if needed; the new RPCs and immutable revisions remain backward compatible and can be removed in a later forward migration only after clients no longer call them.

## Open Questions

None. The PWA orientation request is intentionally best effort and will be called out in the completion report if iOS ignores it.
