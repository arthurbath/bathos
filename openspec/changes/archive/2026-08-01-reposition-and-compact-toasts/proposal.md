## Why

BathOS toasts currently enter at the top on mobile, where they obscure the task or form content the user has intentionally scrolled into view. Toasts are also larger than their short-lived supporting role requires and the two shared toast renderers do not express one consistent placement contract.

## What Changes

- Move all shared BathOS toast stacks to the bottom of the viewport at every responsive width.
- Clear the floating mobile navigation and device safe area whenever that navigation is present, while keeping the navigation visually layered above toasts.
- Align wider-screen toast stacks with the right edge of BathOS's bounded content area.
- Use bottom-origin entrance and dismissal motion appropriate to the new placement.
- Reduce shared toast padding so notifications occupy less of the interface.
- Apply the same placement, layering, and compact treatment to both Radix and Sonner toast surfaces.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-visual-foundations`: Establish shared responsive toast placement, mobile-navigation clearance, layering, motion, and compact spacing.

## Impact

- Shared UI primitives in `src/components/ui/toast.tsx`, `src/components/ui/toaster.tsx`, and `src/components/ui/sonner.tsx`.
- Shared responsive styling and mobile-navigation geometry in `src/index.css`.
- Focused component tests for both toast renderers and OpenSpec coverage for the platform visual contract.
- No database, API, dependency, route, or module-specific behavior changes.
