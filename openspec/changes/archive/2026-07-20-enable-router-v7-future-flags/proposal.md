## Why

The shared BathOS browser router currently emits two React Router v7 compatibility warnings on every application load. Opting into the supported compatibility behavior now keeps browser diagnostics clean and reduces the eventual major-version migration risk while the route tree is still flat and fully absolute.

## What Changes

- Enable React Router's `v7_startTransition` compatibility behavior at the shared browser-router boundary.
- Enable React Router's `v7_relativeSplatPath` compatibility behavior at the same boundary.
- Add focused regression evidence that existing absolute BathOS routes continue resolving without compatibility warnings.

## Capabilities

### New Capabilities

- `platform-routing-compatibility`: Defines the shared browser router's compatibility-mode and route-preservation contract.

### Modified Capabilities

None.

## Impact

- Affects the shared `BrowserRouter` configuration in `src/App.tsx` and its focused tests.
- Applies uniformly to every BathOS module because routing is platform-owned.
- Does not change module route paths, public APIs, dependencies, Supabase objects, production services, or product identity.
