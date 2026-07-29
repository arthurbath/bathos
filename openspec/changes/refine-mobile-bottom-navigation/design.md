## Context

`MobileBottomNav` is a shared portal-rendered component used by BathOS modules. Its current outer surface uses a fixed `1.75rem` radius, a high-contrast grid-line border, an opaque secondary background, and the same half-rem margin above the bottom safe area in every mobile context. The refinement must preserve the visual-viewport zoom compensation, module link semantics, overflow menu, and safe-area protection.

## Goals / Non-Goals

**Goals:**

- Render one complete outer pill without visually flat side edges.
- Let the border recede into the navigation surface.
- Restore restrained background translucency and blur.
- Place the pill slightly closer to the iOS home indicator in native and standalone PWA modes while retaining the full safe-area inset.
- Cover ordinary mobile web, native iOS, and standalone iOS behavior with focused tests.

**Non-Goals:**

- Change navigation destinations, item sizing, active-state styling, overflow behavior, or routing.
- Change placement on ordinary browser tabs or non-iOS installed contexts.
- Introduce a module-specific mobile navigation variant.

## Decisions

### Keep the refinement in the shared component

The shared `MobileBottomNav` will own the geometry and presentation so every module remains visually consistent. Module-level class overrides were rejected because they would duplicate one platform contract across isolated modules.

### Use full rounding and semantic surface tokens

The outer navigation will use the shared full-radius utility and a border colored from the same semantic surface family as its background. This avoids a magic radius that can expose flat edges as height changes and removes the current bright grid-line treatment.

### Pair restrained translucency with backdrop blur

The navigation background will retain the semantic secondary color at high opacity and apply a small backdrop blur. This preserves legibility while allowing content behind the floating surface to remain softly perceptible.

### Detect installed iOS without changing other platforms

The component will combine the existing installed-app detector with iPhone, iPad, iPod, and touch-capable iPadOS platform detection. Only that condition reduces the extra margin above `env(safe-area-inset-bottom)` from one-half rem to one-quarter rem. The safe-area inset itself is never reduced.

## Risks / Trade-offs

- [Backdrop filtering varies by engine] → Keep a high-opacity semantic fallback so the navigation remains legible when blur is unsupported.
- [iPadOS can identify itself as Mac] → Treat touch-capable `MacIntel` as iOS for installed placement.
- [A shared visual change affects every module] → Keep behavior and dimensions otherwise unchanged and run the focused shared-component suite plus rendered mobile QA.
- [Installed safe-area values cannot be fully emulated in a desktop browser] → Prove the conditional class contract in tests and reserve physical-device confirmation for final native/PWA acceptance.
