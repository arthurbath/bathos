## 1. Inventory and Contract

- [x] 1.1 Record every current Edge dependency source, resolved version, supported target, lock boundary, and local runtime verification route.
  - Evidence: `docs/agents/evaluations/2026-08-04_edge-runtime-dependency-pinning.md` inventories all nine deployable functions, root generator inputs, current and target versions, lock boundaries, supported-version decisions, local verification routes, and rollback.
- [x] 1.2 Add a failing repository contract for exact Edge versions, npm-only external imports, one approved Supabase JS version, and generated MCP drift.
  - Evidence: `src/integrations/supabase/edgeDependencyPins.test.ts` enumerates all hand-maintained and generated functions. The pre-change run failed all three contract groups on missing function-local Deno configuration, esm.sh and floating imports, and floating root MCP/Zod generator inputs.

## 2. Exact Edge Graph

- [x] 2.1 Pin root Lovable MCP and Zod generator inputs to their installed exact compatible versions without changing the installed graph.
  - Evidence: `package.json` and `package-lock.json` now require the already-installed `@lovable.dev/mcp-js@0.20.1` and `zod@3.25.76` exactly. `npm ls` confirms the resolved root and generator graph did not change.
- [x] 2.2 Align all hand-maintained Edge Supabase clients to exact 2.112.0 through function-local Deno configuration and npm mappings.
  - Evidence: all eight hand-maintained functions now resolve bare Supabase imports through function-local `deno.json` maps pinned to `npm:@supabase/supabase-js@2.112.0`; no source retains a floating npm specifier or CDN import.
- [x] 2.3 Regenerate MCP source and applicable Deno locks, then inspect direct and transitive changes for unexpected dependencies.
  - Evidence: the Vite generator emitted exact MCP imports for Lovable MCP 0.20.1, Zod 3.25.76, Supabase JS 2.112.0, and fractional-indexing 4.0.0. Deno 2.1.4 regenerated the reminder and widget lockfiles, replacing the Supabase 2.95.3 family with the expected 2.112.0 family while retaining the exact web-push and type packages.

## 3. Local Edge Verification

- [x] 3.1 Run the Edge pin contract, MCP deployment/configuration tests, and focused legacy-function request-boundary checks.
  - Evidence: 53 focused assertions passed across the Edge pin contract, MCP deployment and sync configuration, reminder deployment and handler, and widget handler suites. The local runtime also exercised a safe `OPTIONS` boundary for every function.
- [x] 3.2 Bundle the task reminder function and prove its local HTTP runtime boundary.
  - Evidence: Supabase Edge Runtime 1.74.2 produced a non-empty 13,198,015-byte reminder bundle, then the local HTTP boundary returned the expected `405 Method Not Allowed` with `Allow: POST` for `GET`.
- [x] 3.3 Start every Edge Function through the local Supabase runtime and confirm dependency resolution without deployment.
  - Evidence: the local Supabase Edge Runtime started all ten configured functions and resolved each through a safe `OPTIONS` request. No function returned 404 or a server error, and the runtime stopped cleanly without deployment.

## 4. Complete Acceptance

- [x] 4.1 Run the complete repository gate, fresh audit, dependency-graph and generated-diff checks, advisory performance measurement if the root graph changes, and strict OpenSpec validation.
  - Evidence: the complete suite passed 1,433 tests in 174 files; lint had no errors; TypeScript, production build, clean `npm ci`, dependency-tree resolution, generated MCP stability, and all 53 strict OpenSpec items passed. The audit remains zero critical, two high, three moderate, and one low. Phase 5 changed exact declarations but not the resolved root graph, so its conditional performance rerun did not apply.
- [x] 4.2 Record final Edge dependency and rollback evidence, prove no deployment or production mutation occurred, and read back cleanup of local runtime artifacts.
  - Evidence: `docs/agents/evaluations/2026-08-04_edge-runtime-dependency-pinning.md` records final versions, gates, advisory classification, rollback, and cleanup. No deployment or production command ran. Local serve processes stopped and the exact generated serve and clean-install directories were removed.
