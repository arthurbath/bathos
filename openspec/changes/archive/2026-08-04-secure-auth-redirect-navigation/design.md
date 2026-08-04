## Context

`AuthPage` reads a user-controlled `next` query parameter, accepts values that begin with `/` except `//`, and forwards the result to `useNavigate`. React Router 6.30.4 is affected by open-redirect advisories involving backslash paths, and BathOS currently has no application-level same-origin normalization boundary. The shared `BrowserRouter` already enables both v7 compatibility flags, and the repository uses declarative routes with React 18.

The change affects the platform router used by every browser module. It does not change route registration, module isolation, authentication APIs, Supabase behavior, or native-companion routing.

## Goals / Non-Goals

**Goals:**

- Enforce same-origin post-authentication navigation before any candidate reaches React Router.
- Preserve valid internal destinations, including query strings, fragments, and `/.lovable/oauth/consent`.
- Move the browser router to exact React Router 7.18.2 without changing registered route outcomes.
- Prove the vulnerable payload classes fail through the real `AuthPage` boundary and that legitimate redirects still work.

**Non-Goals:**

- Adopt React Router framework or data-router mode.
- Upgrade React or React DOM.
- Redesign authentication, OAuth consent, route registration, or not-found behavior.
- Update unrelated packages or suppress preexisting test warnings.

## Decisions

### Enforce the invariant before navigation

`getSafeNextPath` will remain the single boundary used both after authentication and when switching authentication tabs. It will reject values that are not root-relative BathOS paths, values with multiple leading separators, literal or encoded backslashes, and values that parse to a different origin. Accepted values will be normalized back to pathname, search, and hash before being returned.

Relying only on the dependency patch was rejected because application-controlled redirect validation is still required defense in depth and protects future routing changes. Maintaining a route allowlist was rejected because it would couple authentication to every module route and would unnecessarily reject legitimate internal destinations.

### Upgrade directly to the patched React Router 7 line

`react-router-dom` will move to exact version 7.18.2. It fixes the open-redirect, client-routing, inefficient route-matching, hydration, SSR, and RSC advisories reported against the existing 6.30.4 dependency while retaining React 18 and declarative-router support. A fresh audit still reports GHSA-qwww-vcr4-c8h2 against 7.18.2, but the upstream advisory states that it affects only applications using unstable RSC APIs. BathOS is a Vite client-only application using `BrowserRouter`, `Routes`, and `Route`; it has no React Server Components, RSC request handlers, server actions, framework router, or React Router server runtime, so that finding is not reachable. React Router 8.3.0 contains the upstream RSC fix but requires React 19.2.7 and removes the `react-router-dom` package, so adopting it is a separate compatibility change rather than part of this focused security repair. Compatibility flags that represented v7 behavior under React Router 6 will be removed according to the React Router 7 type and runtime contract.

Staying on React Router 6 was rejected because there is no patched 6.x release for the affected advisory range. Migrating to React Router 8 was rejected because it would require unrelated React, Node baseline, and framework changes.

### Treat route behavior as a shared compatibility contract

Focused tests will cover malicious redirect payloads, valid authentication destinations, shared router startup, registered platform and module routes, retired redirects, and not-found behavior. The complete repository gate will run after the focused proof so the package change cannot silently alter another module's navigation.

## Risks / Trade-offs

- **Risk: A legitimate path containing a backslash or encoded backslash is rejected** -> BathOS routes do not use backslashes, and rejecting them is the intended security boundary.
- **Risk: React Router 7 type or runtime changes alter navigation** -> Preserve declarative routing, use the existing compatibility test surface, and run all routing plus full repository tests.
- **Risk: A parser edge case bypasses a string-only check** -> Combine separator rejection with URL parsing, same-origin comparison, normalized output, and encoded payload tests.
- **Risk: The dependency change updates unrelated transitive packages** -> Install only the exact React Router target, inspect the lockfile, and defer unrelated audit remediation to later phases.

## Migration Plan

1. Add malicious and legitimate redirect regression tests against React Router 6.30.4.
2. Implement same-origin redirect normalization and prove the security tests pass before the dependency upgrade.
3. Upgrade `react-router-dom` to exact version 7.18.2 and adapt the shared router boundary.
4. Run focused route tests, the full repository gate, a clean dependency-graph check, and a post-change security audit.
5. Keep the phase isolated in one reviewable change boundary. If React Router 7 introduces an unrecoverable regression, retain the application-level redirect guard while temporarily reverting only the package and router-compatibility changes, then treat the remaining vulnerable dependency as unresolved rather than declaring the phase complete.

## Open Questions

None.
