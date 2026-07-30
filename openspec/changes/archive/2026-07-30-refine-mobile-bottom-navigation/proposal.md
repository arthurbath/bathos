## Why

The shared mobile bottom navigation is visually too rigid and prominent: its outer border does not form a complete pill, its light border competes with the content, and its opaque background lacks the subtle depth expected from a floating mobile surface. Installed iOS contexts also leave more space above the home indicator than necessary.

## What Changes

- Make the shared mobile navigation outer boundary fully pill-shaped with no flat side edges.
- Darken the border so it visually blends with the navigation background.
- Restore slight translucency and backdrop blur so underlying content is softly obscured.
- Reduce the extra bottom margin used by native and standalone installations on touch devices while retaining the full safe-area inset plus a small fixed clearance above the home indicator.
- Keep the navigation pinned to one viewport coordinate at every list scroll depth, including the elastic scroll boundary.
- Position Tasks floating actions from the same bottom-navigation coordinate so their visual gap remains unchanged across ordinary web, native, and standalone PWA modes.
- Remove spacing between navigation destinations so the longest active label receives every available pixel without widening the outer pill.
- Remove destination hover-color treatment from the mobile-only navigation.
- Preserve ordinary mobile-web placement, navigation behavior, and link semantics.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-visual-foundations`: Replace the opaque floating-pill contract with a fully rounded, subtly translucent, blurred, low-contrast treatment whose active destination remains comfortably padded without a touch-irrelevant hover treatment.
- `installed-module-shell`: Refine installed touch-device bottom-navigation placement to retain a small clearance above the home indicator, remain stable at scroll boundaries, and provide one shared anchor for related floating actions.

## Impact

- Shared component and styles: `src/platform/components/MobileBottomNav.tsx` and `src/index.css`
- Tasks floating controls: `src/modules/tasks/components/TasksShell.tsx`
- Native scroll boundary: `ios/TasksCompanion/TasksCompanion/TasksWebView.swift`
- Focused tests: shared navigation, Tasks shell, and iOS companion suites
- Durable specifications: `platform-visual-foundations` and `installed-module-shell`
- Blast radius: every BathOS module that renders the shared mobile navigation, with a conditional offset change limited to native and standalone touch-device contexts
- No database, Supabase, API, dependency, routing, or link-behavior changes
