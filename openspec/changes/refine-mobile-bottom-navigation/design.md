## Context

`MobileBottomNav` is a shared portal-rendered component used by BathOS modules. Its current outer surface uses a fixed `1.75rem` radius, a high-contrast grid-line border, an opaque secondary background, and the same half-rem margin above the bottom safe area in every mobile context. The refinement must preserve the visual-viewport zoom compensation, module link semantics, overflow menu, and safe-area protection.

## Goals / Non-Goals

**Goals:**

- Render one complete outer pill without visually flat side edges.
- Let the border recede into the navigation surface.
- Restore restrained background translucency and blur.
- Place the pill only the safe-area distance above the home indicator in native and standalone PWA modes on touch devices.
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

### Detect installed touch presentation without changing ordinary web

The component will combine the existing installed-app detector with touch-capable platform detection. Only that condition removes the extra margin above `env(safe-area-inset-bottom)`. The safe-area inset itself is never reduced, while ordinary browser tabs retain their existing one-half-rem margin.

## Risks / Trade-offs

- [Backdrop filtering varies by engine] → Keep a high-opacity semantic fallback so the navigation remains legible when blur is unsupported.
- [iPadOS can identify itself as Mac] → Treat positive touch capability as authoritative for installed placement.
- [A shared visual change affects every module] → Keep behavior and dimensions otherwise unchanged and run the focused shared-component suite plus rendered mobile QA.
- [A gapless grid could make adjacent controls feel crowded] → Preserve distinct rounded active treatment and each destination's full equal-width touch target.
- [Installed safe-area values cannot be fully emulated in a desktop browser] → Prove the conditional class contract in tests and reserve physical-device confirmation for final native/PWA acceptance.
