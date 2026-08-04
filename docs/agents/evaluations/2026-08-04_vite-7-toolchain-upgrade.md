# Vite 7 Toolchain Upgrade Evaluation

## Scope

This evaluation records the dependency graph and regression boundaries for upgrading the root Vite installation from 5.4.21 to 7.3.6. It does not authorize a Vite 8 migration or any production deployment.

## Pre-Upgrade Runtime

- Node: 24.12.0
- Root Vite declaration: `^5.4.19`
- Installed Vite: 5.4.21
- Installed graph: one deduplicated Vite node shared by the root, React SWC, Vitest, Lovable Tagger, and Lovable MCP packages

## Vite 7 Compatibility

Registry metadata checked on 2026-08-04 establishes these declared boundaries:

| Consumer | Installed version | Declared Vite compatibility |
| --- | ---: | --- |
| `@vitejs/plugin-react-swc` | 3.11.0 | Vite 4, 5, 6, or 7 |
| `vitest` | 3.2.7 | Vite 5, 6, or 7 |
| `lovable-tagger` | 1.1.13 | Vite 5 through 7 |
| `@lovable.dev/mcp-js` | 0.20.0 | Vite 5 through 8 |

Vite 7.3.6 requires Node 20.19 or later on the Node 20 line, or Node 22.12 or later. The active Node 24.12.0 runtime satisfies that requirement. No companion-package upgrade is justified by the declared peer graph alone.

## Regression Map

| Surface | Verification |
| --- | --- |
| Ordinary and LAN development exposure | `src/platform/dev/viteConfig.test.ts` plus live listener inspection |
| Production client-console isolation | `src/platform/dev/viteConfig.test.ts` plus production-bundle inspection |
| React SWC compilation | Production and development builds plus HMR smoke test |
| Vitest integration | Focused configuration test followed by the complete Vitest suite |
| Lovable Tagger | Development build and browser DOM inspection |
| Lovable MCP | `.lovable/mcp/manifest.json`, `src/modules/tasks/integration/mcpDeploymentConfig.test.ts`, and generated-output inspection |
| PowerSync and WA-SQLite | Worker and WASM asset inspection, Tasks offline persistence, and Tasks multi-client convergence |
| PWA and service worker | `src/platform/pwaHead.test.ts`, `src/platform/pwaManifests.test.ts`, `src/modules/tasks/pwa/taskServiceWorker.test.ts`, and `src/modules/tasks/integration/tasksServiceWorker.test.ts` |
| Registered routes | `src/App.tasks-routing.test.tsx`, `src/platform/modules.test.ts`, and Safari route smoke testing |

## Decision

Upgrade only the root Vite declaration to exact version 7.3.6. Retain the existing React SWC, Vitest, Lovable Tagger, and Lovable MCP versions unless direct build or runtime evidence proves a compatibility repair is necessary. Keep Vite 8 outside this change because it is a separate major migration with a different bundler-risk profile.
