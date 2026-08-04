## 1. Regression Boundaries

- [x] 1.1 Add focused regressions proving ordinary development binds only to loopback, intentional LAN development binds all interfaces, and production configuration does not expose the client-console endpoint.
  - Evidence: `src/platform/dev/viteConfig.test.ts` passes the production endpoint restriction and fails against the pre-upgrade all-interface host and missing LAN command, proving the regression is live before implementation.
- [x] 1.2 Record the current Vite peer graph and add or identify checks covering React SWC, Vitest, Lovable tagging, MCP generation, PowerSync and WA-SQLite assets, PWA/service-worker output, and registered routes.
  - Evidence: `docs/agents/evaluations/2026-08-04_vite-7-toolchain-upgrade.md` records the one-node Vite 5 graph, registry-declared Vite 7 compatibility, and the focused plus complete regression map.

## 2. Supported Toolchain

- [x] 2.1 Upgrade only the root Vite declaration and lockfile to exact version 7.3.6, then prove the installed graph contains one valid Vite node and no unsupported Vite 5 copy.
  - Evidence: `npm ls vite @vitejs/plugin-react-swc vitest lovable-tagger @lovable.dev/mcp-js --all` reports one deduplicated `vite@7.3.6` node and no Vite 5 node.
- [x] 2.2 Make `npm run dev` loopback-only and add an explicit `npm run dev:lan` all-interface command without changing the port, HMR overlay policy, aliases, worker format, or dependency exclusions.
  - Evidence: the configuration regression passes, live ordinary development listened on `127.0.0.1`, and `npm run dev:lan` listened on all IPv4 interfaces at an isolated test port.
- [x] 2.3 Apply only Vite 7 compatibility edits proven necessary by peer, compiler, build, MCP-generation, or runtime evidence, and inspect generated files without hand-editing MCP output.
  - Evidence: both build modes and live development passed without companion dependency or generated MCP edits; the generated MCP manifest remained unchanged and served successfully.

## 3. Focused Verification

- [x] 3.1 Run production and development builds, a forced fresh development startup, HMR, client-console mirroring, development-only Lovable tagging, and MCP generation checks.
  - Evidence: production and development builds passed; forced optimization started Vite 7.3.6; the HMR websocket emitted a component update; the client-console endpoint returned 405 for GET and 204 for a logged POST; Lovable sandbox mode served the tagged JSX runtime; and the unchanged MCP manifest served at its development path.
- [x] 3.2 Verify PowerSync worker and WA-SQLite asset loading, PWA manifest and service-worker behavior, and Safari routing across authentication and every registered BathOS module without production mutation.
  - Evidence: production output contains two worker bundles and four WA-SQLite WASM assets; 68 focused integration tests pass; Safari rendered public routes, each protected module boundary, the not-found surface, and dev plus production-preview routes. Safari requested Touch ID for the saved login, so this Vite-only pass used the unauthenticated boundary while retaining the completed authenticated Phase 1 route evidence for unchanged application code.

## 4. Complete Acceptance

- [x] 4.1 Run the complete repository gate, applicable Tasks integration suites, timing checks under the temporary performance waiver, clean-install and dependency-graph checks, a fresh security audit, strict OpenSpec validation, and Git diff checks.
  - Evidence: 1,423 ordinary tests pass with 15 opt-in skips; lint has zero errors and one pre-existing Fast Refresh warning; Tasks type checking and production build pass; offline, multi-client, preservation, and the default ten-minute sustained gate pass. The sustained gate completed 300 cycles, 300 tasks, 1,050 history events, 300 conflict receipts, 300 capture retries, 300 transition retries, and 12 restarts. A clean temporary `npm ci` reproduced one deduplicated Vite 7.3.6 node. The fresh audit contains zero critical findings and no Vite or root esbuild advisory; remaining findings belong to later planned phases or existing transitive tooling. The single 1,000-row render measurement was 2,472.8 ms against the 2,000 ms ceiling and is advisory under `docs/agents/evaluations/2026-08-04_dependency_upgrade_performance_gate_waiver.md`. Strict OpenSpec validation and `git diff --check` pass.
  - Test-infrastructure repair: four stale inactive disposable PowerSync slots had exhausted local Postgres capacity. The exact slots were removed, all integrations passed with one fresh active slot, and harness cleanup now removes only inactive `powersync_1_*` slots from the local test database. Cleanup readback found zero synthetic owners, settings, tasks, history rows, publications, disposable slots, harness containers, or harness volumes.
