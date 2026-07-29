## Why

The shared mobile bottom navigation is visually too rigid and prominent: its outer border does not form a complete pill, its light border competes with the content, and its opaque background lacks the subtle depth expected from a floating mobile surface. Installed iOS contexts also leave more space above the home indicator than necessary.

## What Changes

- Make the shared mobile navigation outer boundary fully pill-shaped with no flat side edges.
- Darken the border so it visually blends with the navigation background.
- Restore slight translucency and backdrop blur so underlying content is softly obscured.
- Reduce only the extra bottom margin used by native and standalone iOS installations while retaining full safe-area clearance.
- Preserve ordinary mobile-web placement, navigation behavior, and link semantics.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-visual-foundations`: Replace the opaque floating-pill contract with a fully rounded, subtly translucent, blurred, low-contrast treatment.
- `installed-module-shell`: Refine installed iOS bottom-navigation placement to sit closer to the home-indicator safe area without overlapping it.

## Impact

- Shared component: `src/platform/components/MobileBottomNav.tsx`
- Focused tests: `src/platform/components/MobileBottomNav.test.tsx`
- Durable specifications: `platform-visual-foundations` and `installed-module-shell`
- Blast radius: every BathOS module that renders the shared mobile navigation, with a conditional offset change limited to native and standalone iOS contexts
- No database, Supabase, API, dependency, routing, or link-behavior changes
