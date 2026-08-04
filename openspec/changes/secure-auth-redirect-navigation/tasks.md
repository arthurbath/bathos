## 1. Security Boundary

- [x] 1.1 Add regression tests for protocol-relative, literal and encoded backslash, nested encoded separator, absolute URL, non-path scheme, valid internal path, query, fragment, and OAuth consent `next` values through authentication and tab switching.
- [x] 1.2 Implement same-origin redirect normalization at the shared `AuthPage` boundary and prove the vulnerable payload classes no longer reach navigation while legitimate destinations remain intact.

## 2. Router Upgrade

- [x] 2.1 Upgrade `react-router-dom` to exact version 7.18.2, the newest React 18-compatible 7.x release, without updating unrelated direct dependencies, then inspect the manifest and lockfile diff and document the RSC-only audit exception.
- [x] 2.2 Adapt the shared browser-router compatibility boundary and tests to React Router 7 while preserving every registered platform, module, legacy redirect, and not-found outcome.

## 3. Verification

- [x] 3.1 Run focused authentication, shared routing, launcher, module-access, scroll-restoration, and route-security tests, then confirm the original advisory payloads do not reproduce and legitimate redirects still work.
- [x] 3.2 Run the complete local repository gate: full tests, Tasks typechecking, lint, production build, strict OpenSpec validation, diff checks, dependency-graph inspection, and a fresh npm security audit.
- [x] 3.3 Run the applicable local Tasks integration and performance checks plus a Safari development smoke test covering authentication and every registered module route without mutating production data.

  The offline, multi-client, preservation, and ten-minute sustained parallel-use
  integrations passed. The performance suite was executed and its unstable
  wall-clock threshold failures remain recorded under the temporary
  dependency-upgrade waiver in
  `docs/agents/evaluations/2026-08-04_dependency_upgrade_performance_gate_waiver.md`.
  Safari preserved valid internal authentication destinations, removed an
  encoded backslash destination during tab switching, and resolved every
  registered platform, module, compatibility-redirect, and not-found route
  without an application-error surface or production mutation.
