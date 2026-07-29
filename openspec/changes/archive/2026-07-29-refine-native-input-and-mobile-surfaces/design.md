## Context

BathOS renders the Tasks web module inside a persistent `WKWebView`, shares one mobile navigation component across module shells, and already has touch row selection plus task planning surfaces. The current native new-task focus workaround primes an invisible UIKit field and then asks the `WKWebView` itself to become first responder. That does not reliably transfer the input session to WebKit's focused HTML control and can leave iOS showing only the input-assistant controls. The current bottom navigation is a full-width translucent strip, visual surface tokens differ by a few luminance points, and task swipe handling recognizes only a completed left gesture.

## Goals / Non-Goals

**Goals:**

- Make native-surface new-task capture present a reliable software keyboard while preserving ordinary WebKit editing for direct field taps.
- Apply one shared floating mobile navigation and continuous dark surface across BathOS.
- Make bidirectional task swipes legible, responsive, and compatible with vertical scrolling.
- Preserve existing task planning, selection, link routing, autosave, accessibility, and reduced-motion behavior.

**Non-Goals:**

- Introduce a native duplicate task editor, private WebKit API, custom system keyboard, glass/blur visual effect, or custom scrolling system.
- Change mobile navigation destinations or module route ownership.
- Add database schema, synchronization authority, or task metadata.
- Replace meaningful protocol-specific destination icons.

## Decisions

### Use a bounded native responder only for native-surface Summary capture

iOS does not reliably present the software keyboard for a programmatically focused HTML control after a widget or Control Center launch. For that one handoff, the native shell keeps a transparent `UITextField` as first responder and relays its complete value into the allowlisted new-task Summary input through the existing native bridge. Return is relayed to the web field so the existing form behavior remains authoritative. A direct pointer interaction with any real web input immediately dismisses the native capture field and returns editing to WebKit.

The responder is scoped to the new-task Summary handoff rather than ordinary web editing, does not repeatedly reactivate after dismissal, and does not create a second persisted task model. A visible native overlay editor was rejected because it would duplicate layout, composition, accessibility, password/autofill behavior, and autosave. Private WebKit flags and responder-class manipulation remain rejected.

### Style mobile navigation once in the shared component

`MobileBottomNav` will retain its portal, visual-viewport compensation, real links, overflow menu, and module-supplied destinations. Only its geometry and opaque semantic-token styling changes: a viewport-inset rounded outer container, safe-area bottom offset, minimum 44-point item targets, and active nested pill.

Per-module copies were rejected because they would drift and violate shared platform ownership. Liquid-glass blur was rejected by request and by BathOS's flat visual language.

### Unify surface tokens at the root

The shared `card` and applicable platform navigation surfaces will resolve to the existing `background` color. `html`, `body`, and `#root` will declare the same background before React renders, the manifest background will match, and the native `WKWebView` hierarchy will use the matching UIColor. Popovers remain distinct because they need layering and are not card or application surfaces.

### Model swipe progress separately from swipe commitment

The task-row gesture helper will classify a touch gesture as horizontal-left, horizontal-right, vertical, or pending. The row will render a damped, clamped translation and direction-specific icon opacity during movement. On release, the existing threshold decides whether to commit. Left commits selection. Right seeds the existing single-task planning state and opens the existing Start picker. Pointer cancellation and vertical intent reset visual progress.

CSS transform feedback was chosen over a custom drag/scroll system because transforms stay compositor-friendly and preserve native vertical scrolling.

### Keep editor traversal narrow and native by default

The Summary key handler will intercept only unmodified, non-composing Right Arrow at a collapsed end boundary. It will focus the existing Notes editor and set its selection to zero. Every other key and cursor state remains native.

### Canonize generic external-link iconography by concept

React actions use Lucide `ExternalLink` through the existing task iconography map or direct imports where the action is platform-wide. Native WidgetKit uses the documented platform rendering of the same northeast-arrow-from-square concept. Protocol-specific action detection remains authoritative before choosing the generic icon.

## Risks / Trade-offs

- **WebKit limits programmatic keyboard presentation outside a user gesture** -> Keep the native capture responder bounded to native new-task Summary entry, relay through the allowlisted bridge, verify on the physical installed app, and preserve direct user-tap editing as the ordinary path without private APIs.
- **Floating navigation could cover list content** -> Update shared page-bottom spacing and verify short/long module layouts with device safe areas.
- **Swipe gestures could compete with vertical scroll or task drag** -> Restrict to touch pointers on the designated closed summary row, lock only after horizontal dominance, and cancel on vertical intent.
- **One continuous surface reduces card separation** -> Preserve borders, spacing, and semantic state colors rather than reintroducing decorative surface colors.
- **A widget cannot import Lucide React** -> Use the documented native equivalent of the same canonical concept and verify its appearance on-device.

## Migration Plan

1. Land shared token/root/mobile-navigation changes with focused component tests.
2. Land Tasks editor, departure animation, swipe, and icon changes with domain and interaction tests.
3. Land native responder and widget icon changes with Swift tests and signed simulator/device builds.
4. Run the full web and native validation suite, compare rendered mobile surfaces to the supplied reference geometry, publish the matching web release, and reinstall the signed companion for physical acceptance.
5. Roll back by reverting the web/native commit pair. No database rollback is required.

## Open Questions

None. The user's requested behavior and visual reference are sufficient to implement and validate the change.
