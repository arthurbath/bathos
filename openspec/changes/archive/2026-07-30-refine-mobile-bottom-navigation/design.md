## Context

`MobileBottomNav` is a shared portal-rendered component used by BathOS modules. Its current outer surface uses a fixed `1.75rem` radius, a high-contrast grid-line border, an opaque secondary background, and the same half-rem margin above the bottom safe area in every mobile context. The refinement must preserve the visual-viewport zoom compensation, module link semantics, overflow menu, and safe-area protection.

## Goals / Non-Goals

**Goals:**

- Render one complete outer pill without visually flat side edges.
- Let the border recede into the navigation surface.
- Restore restrained background translucency and blur.
- Place the pill the complete safe-area distance plus a small fixed clearance above the home indicator in native and standalone PWA modes on touch devices.
- Keep the pill fixed at one viewport coordinate through the maximum list scroll depth.
- Let module-level floating actions derive their offsets from the shared navigation coordinate.
- Give the longest active destination label more horizontal breathing room without widening the outer pill.
- Remove hover-only color feedback from the mobile-only destinations.
- Cover ordinary mobile web, native iOS, and standalone iOS behavior with focused tests.

**Non-Goals:**

- Change navigation destinations, outer navigation width, active-state color, overflow behavior, or routing.
- Change placement on ordinary browser tabs or non-iOS installed contexts.
- Introduce a module-specific mobile navigation variant.

## Decisions

### Keep the refinement in the shared component

The shared `MobileBottomNav` will own the geometry and presentation so every module remains visually consistent. Module-level class overrides were rejected because they would duplicate one platform contract across isolated modules.

### Use full rounding and semantic surface tokens

The outer navigation will use the shared full-radius utility and a border colored from the same semantic surface family as its background. This avoids a magic radius that can expose flat edges as height changes and removes the current bright grid-line treatment.

### Pair restrained translucency with backdrop blur

The navigation background will retain the semantic secondary color at high opacity and apply a small backdrop blur. This preserves legibility while allowing content behind the floating surface to remain softly perceptible.

### Reclaim all inter-destination space for the active pills

The five equal-width destination tracks remain intact, but their grid gap is removed. The reclaimed width is distributed evenly across every destination, giving `Upcoming` and the other longer labels more space inside their active pills while preserving the outer navigation width and viewport insets. Variable track widths were rejected because shifting destination hit targets between views would reduce predictability.

### Omit pointer-hover color changes from mobile navigation

The shared component is mobile-only, and destination focus remains represented by the existing focus-visible ring. Removing inactive-item hover classes avoids a desktop-like transient treatment on touch devices without changing active, focus, or activation behavior.

### Use one shared bottom-navigation coordinate

The shared stylesheet declares a bottom-navigation offset that includes the complete safe-area inset. Ordinary mobile web adds the established one-half-rem clearance, while installed touch presentation overrides only that clearance with one-quarter rem. `MobileBottomNav` and floating Tasks controls derive their positions from this same custom property, preserving the established visual gaps without parallel formulas that can drift.

### Detect installed touch presentation without changing ordinary web

The component will combine the existing installed-app detector with touch-capable platform detection. Only that condition reduces the additional margin above `env(safe-area-inset-bottom)` to one-quarter rem. The safe-area inset itself is never reduced, while ordinary browser tabs retain their existing one-half-rem margin.

### Stop elastic scrolling at the native viewport boundary

The iOS companion disables `WKWebView` scroll-view bouncing and automatic native content-inset adjustment while preserving normal vertical scrolling. The web layer already owns safe-area placement through `env(safe-area-inset-bottom)`, so removing the second native inset authority prevents viewport-fixed controls from acquiring a different resting position at the scroll boundary. Installed web presentation also applies overscroll containment to both the document root and body so the standalone PWA does not hand an exhausted list scroll to the outer page.

## Risks / Trade-offs

- [Backdrop filtering varies by engine] → Keep a high-opacity semantic fallback so the navigation remains legible when blur is unsupported.
- [iPadOS can identify itself as Mac] → Treat positive touch capability as authoritative for installed placement.
- [A shared visual change affects every module] → Keep behavior and dimensions otherwise unchanged and run the focused shared-component suite plus rendered mobile QA.
- [A gapless grid could make adjacent controls feel crowded] → Preserve distinct rounded active treatment and each destination's full equal-width touch target.
- [Disabling native elastic bounce changes an iOS convention] → Limit the behavior to the Tasks companion web view where fixed navigation stability is the explicit product contract; ordinary list scrolling remains native.
- [Installed safe-area values cannot be fully emulated in a desktop browser] → Prove the conditional class contract in tests and reserve physical-device confirmation for final native/PWA acceptance.
