## 1. Audit Boundaries

- [x] 1.1 Record the post-Vite advisory identities, dependency paths, installed versions, registry fix versions, and non-forced audit dry-run manifest.
  - Evidence: the post-Vite audit reported 12 package findings (0 critical, 6 high, 5 moderate, 1 low), covering React Router's RSC-only action path, PostCSS 8.5.20, `brace-expansion` 1.1.16/2.1.2, `undici` 7.28.0, `fast-uri` 3.1.3, `ip-address` 10.2.0, Hono 4.12.27, the Lovable MCP SDK chain, and its nested esbuild 0.28.0. `npm audit fix --dry-run` proposed 10 updates, no additions or removals, and no forced or unrelated major changes.
- [x] 1.2 Identify focused CSS, representative DataGrid/modal rendering, MCP contract, deployment-configuration, and Edge-bundle checks before changing the graph.
  - Focused checks: production and development builds for PostCSS output; `data-grid.layout`, `data-grid.focus`, `modal-focus`, Expenses empty-state, and Garage services-grid tests for representative shared UI; Tasks MCP and deployment-configuration tests; `verify:tasks:edge-bundle`; installed-tree and generated-file diff inspection.

## 2. Compatible Patch Refresh

- [x] 2.1 Apply only the non-forced compatible patch refresh, selecting patched PostCSS 8.5.x and the dry-run-approved transitive versions without unrelated majors or overrides.
  - Evidence: non-forced `npm audit fix` changed the 10 packages named by the dry run. PostCSS resolved to 8.5.25; the compatible transitive fixes resolved to `brace-expansion` 1.1.18/2.1.4, `undici` 7.29.0, `fast-uri` 3.1.5, `ip-address` 10.4.0, Hono 4.13.0, `@hono/node-server` 1.19.17, and `@lovable.dev/mcp-js` 0.20.1. No manifest range, forced override, removal, addition, or unrelated major was introduced.
- [x] 2.2 Inspect the resulting manifest, lockfile, installed tree, CSS output, generated MCP files, and Edge bundle for unexpected changes or peer conflicts.
  - Evidence: `package.json` retained all pre-phase ranges; `npm ls` reports the intended valid graph without peer errors; production and development builds emitted the same 97.88 kB CSS asset and matching client chunk sizes. The development build's two generated MCP import-pin changes were inspected and restored because Edge source alignment remains Phase 5 scope. The task-reminder Edge bundle was non-empty and verified successfully.

## 3. Advisory Evidence

- [x] 3.1 Run focused CSS, representative shared-UI, MCP, deployment-configuration, and Edge-bundle verification.
  - Evidence: seven focused test files passed all 103 tests, covering DataGrid layout/focus, modal focus, Expenses empty state, Garage services grid, MCP deployment contracts, and Tasks deployment configuration. Production and development CSS builds passed, and the task-reminder Edge bundle passed with Supabase Edge Runtime 1.74.2.
- [x] 3.2 Produce a dated before-and-after advisory evaluation that documents every remaining finding by owner, execution surface, reachability, and applicable-fix status.
  - Evidence: `docs/agents/evaluations/2026-08-04_security-patched-dependency-refresh.md` records the reduction from 12 to 6 package findings and classifies the RSC-only React Router advisory, Windows-only Hono MCP chain, and Windows-only nested Lovable esbuild finding.

## 4. Complete Acceptance

- [ ] 4.1 Prove a clean install and valid dependency graph, then run the fresh audit, complete repository gate, applicable Tasks integration matrix, timing checks under the temporary performance waiver, strict OpenSpec validation, and Git diff checks.
