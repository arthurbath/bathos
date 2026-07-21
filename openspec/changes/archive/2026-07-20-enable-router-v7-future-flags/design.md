## Context

BathOS mounts every platform and module route beneath one shared `BrowserRouter` in `src/App.tsx`. React Router 6.30.4 supports two opt-in v7 compatibility behaviors and emits a browser warning for each behavior when the root router does not opt in. The current route tree is flat: registered routes use absolute paths, and the only splat route is the terminal not-found fallback.

## Goals / Non-Goals

**Goals:**

- Opt the production browser router into both compatibility behaviors supported by its installed React Router version.
- Preserve every registered platform, module, redirect, and not-found route outcome.
- Prove that an application load no longer emits the two compatibility warnings.

**Non-Goals:**

- Upgrade React Router to v7.
- Convert BathOS to a data router or restructure the route tree.
- Change module paths, navigation components, scroll behavior, authentication, or product identity.
- Rewrite isolated test harnesses that intentionally use `MemoryRouter`.

## Decisions

### Configure compatibility once at the platform boundary

Pass `v7_startTransition` and `v7_relativeSplatPath` through the existing root `BrowserRouter` `future` property. A single platform-owned configuration applies uniformly to every module and avoids coupling modules to router-version details.

The alternative was to suppress console warnings. That would hide migration evidence without exercising the future behavior and was rejected.

### Preserve the existing declarative route tree

Do not migrate to `createBrowserRouter` or otherwise reorganize routes. The installed component router already exposes both flags, and changing router architecture would enlarge the blast radius without contributing to this compatibility step.

### Validate behavior at two levels

Use focused source-level tests to require both flags at the root boundary, then run the existing route, module, build, and full test gates. Repeat a live-browser application load and inspect console output to prove the warning-free runtime outcome that motivated the change.

## Risks / Trade-offs

- [React transition scheduling exposes an order-sensitive state update] -> Run the full suite and a live-browser navigation smoke test before closeout; rollback is removal of the `future` property.
- [Relative links beneath a splat route resolve differently] -> BathOS has no nested route beneath its terminal `*` fallback, and all registered destinations are absolute; preserve that structure in this change.
- [Tests using `MemoryRouter` still omit flags] -> Leave isolated harnesses unchanged unless they emit a relevant warning; the production contract belongs to the shared browser boundary.

## Migration Plan

1. Add both supported flags to the existing root `BrowserRouter`.
2. Add a focused regression test for the root configuration.
3. Run route-focused tests, lint, build, the full test suite, strict OpenSpec validation, and a live-browser console check.
4. Roll back by removing the `future` property if any route or interaction regression appears.

## Open Questions

None.
