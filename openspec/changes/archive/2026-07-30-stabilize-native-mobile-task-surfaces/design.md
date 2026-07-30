## Context

`MobileBottomNav` is a shared portal-rendered fixed surface that currently gives native and standalone touch contexts the same CSS safe-area offset. The iOS companion already constrains its `WKWebView` to the SwiftUI safe area, so applying `env(safe-area-inset-bottom)` again inside that native viewport can double the apparent clearance. Root scroll elasticity can also move WebKit fixed descendants at the lower scroll boundary. The Tasks editor separately uses a hidden native `UITextField` to keep the iOS keyboard open while mirroring text into the focused HTML Summary input, which means WebKit may not paint its ordinary caret or focus treatment even though typing reaches the correct field.

## Goals / Non-Goals

**Goals:**

- Give native iOS, standalone PWA, and ordinary mobile web explicit bottom-offset contracts.
- Keep the navigation visually fixed through lower scroll-boundary interaction.
- Reclaim horizontal and vertical space inside the unchanged outer navigation width.
- Make native new-task Summary focus visually explicit while the native keyboard bridge owns first responder.
- Use one darker, continuous open-task surface beneath the lighter floating navigation.

**Non-Goals:**

- Change navigation destinations, outer width, route behavior, keyboard visibility policy, or list content clearance.
- Replace the native keyboard bridge or introduce custom scrolling.
- Change closed, keyboard-focused, or bulk-selected task colors.

## Decisions

### Separate native and standalone bottom offsets

The shared component will distinguish a declared native host from a standalone PWA. The native host will use only a small fixed inset because its `WKWebView` is already laid out above the home-indicator safe area. Standalone mode will retain the CSS safe-area inset plus the same small visual gap. Ordinary mobile web will retain its larger browser-context margin.

Treating all installed contexts identically was rejected because the native host and standalone Safari use different viewport containment.

### Suppress installed root overscroll without replacing native scrolling

While an installed touch navigation is mounted, the document root will declare `overscroll-behavior-y: none`. Scrolling remains browser-native, but the lower-boundary rubber-band no longer drags the fixed navigation layer. The attribute is reference-cleaned on unmount so ordinary web behavior is unchanged.

Disabling the entire native `UIScrollView` bounce behavior was rejected because it would solve only the companion and would not cover standalone PWA mode.

### Reduce both container and destination horizontal padding

The outer pill will use four-pixel padding and destination tracks will use two-pixel horizontal padding. Equal-width tracks, the gapless grid, minimum touch height, and the outer width remain unchanged.

### Represent native keyboard-bridge focus explicitly

When the web layer successfully requests the native Summary keyboard presenter, the Summary control will retain an explicit native-capture focus state. That state forces the ordinary input focus treatment and paints a non-interactive end caret synchronized with the mirrored Summary value. A direct pointer interaction clears the synthetic state before WebKit assumes normal text editing.

Attempting to transfer first responder back to WebKit immediately was rejected because earlier native acceptance showed that it can dismiss or fail to present the software keyboard.

### Use the semantic popover surface for the open task

The selected/open task container will use `bg-popover`, inherited by the summary and editor region. This stays darker than the translucent `secondary` navigation while preserving the existing input backgrounds and semantic tokens.

## Risks / Trade-offs

- [A synthetic caret only represents end insertion] → Limit it to the initial native capture flow, whose bridge already appends and mirrors at the end; direct editing restores WebKit's real caret.
- [Root overscroll suppression can change installed-app edge feel] → Scope it to the mounted installed-touch navigation and preserve ordinary native scrolling mechanics.
- [Safe-area behavior varies by iOS host] → Cover native, standalone, and ordinary-web class contracts in tests and reserve physical-device confirmation for final acceptance.
- [Shared padding affects every module] → Preserve the outer width, equal tracks, and touch height, then run shared navigation tests plus a rendered Tasks mobile viewport check.
