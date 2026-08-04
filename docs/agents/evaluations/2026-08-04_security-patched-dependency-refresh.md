# Security-Patched Dependency Refresh Evaluation

## Scope

This evaluation records the compatible, non-forced security refresh performed after the Vite 7 upgrade. It covers the npm dependency graph only. It does not authorize an Edge Function source update, deployment, forced override, or unrelated package major.

## Before and After

| Audit state | Critical | High | Moderate | Low | Total package findings |
| --- | ---: | ---: | ---: | ---: | ---: |
| After Vite 7, before this refresh | 0 | 6 | 5 | 1 | 12 |
| After compatible patch refresh | 0 | 2 | 3 | 1 | 6 |

The non-forced refresh removed every finding for which npm could select a compatible version. It changed 10 installed packages, with no additions or removals:

- PostCSS 8.5.20 to 8.5.25
- `brace-expansion` 1.1.16 to 1.1.18 and both 2.1.2 nodes to 2.1.4
- `undici` 7.28.0 to 7.29.0
- `fast-uri` 3.1.3 to 3.1.5
- `ip-address` 10.2.0 to 10.4.0
- Hono 4.12.27 to 4.13.0
- `@hono/node-server` 1.19.14 to 1.19.17
- `@lovable.dev/mcp-js` 0.20.0 to 0.20.1

No `npm audit fix --force`, dependency override, direct manifest-range expansion, or unrelated major was used.

## Remaining Findings

### React Router RSC action CSRF

- Advisory: GHSA-qwww-vcr4-c8h2
- Reported packages: `react-router` and direct `react-router-dom`
- Severity and count: two high package findings representing one advisory
- Installed version: 7.18.2
- Execution surface: React Server Components action handling
- BathOS reachability: not reachable in the current application. BathOS uses `BrowserRouter`, `Routes`, and client-side navigation. It has no RSC router, RSC server, route action definitions, or server-action dispatch surface.
- Applicable fix: npm proposes forcing `react-router-dom` to 7.11.0, an older breaking selection outside the accepted graph. This does not provide a suitable forward security upgrade for BathOS.
- Decision: retain 7.18.2, monitor upstream, and reassess if BathOS adopts RSC or React Router publishes an applicable stable forward fix.

### Hono Node server encoded-backslash traversal

- Advisory: GHSA-frvp-7c67-39w9
- Reported packages: `@hono/node-server`, `@modelcontextprotocol/sdk`, and direct `@lovable.dev/mcp-js`
- Severity and count: three moderate package findings representing one advisory and its ownership chain
- Installed versions: `@hono/node-server` 1.19.17, MCP SDK 1.28.0, and Lovable MCP 0.20.1
- Execution surface: `serve-static` on Windows when a request uses an encoded backslash
- BathOS reachability: not reachable in the deployed browser application or Supabase Deno Edge runtime. The chain belongs to the local Lovable MCP generation and development toolchain, and BathOS development is currently performed on macOS.
- Applicable fix: patched `@hono/node-server` begins at 2.0.5. Lovable MCP 0.20.1 pins MCP SDK 1.28.0, whose declared dependency permits only the 1.x node-server line. npm reports no compatible fix.
- Decision: do not force an out-of-range node-server major. Reassess when Lovable MCP adopts an MCP SDK version that permits node-server 2.0.5 or later.

### Nested Lovable MCP esbuild development server

- Advisory: GHSA-g7r4-m6w7-qqqr
- Reported package: esbuild
- Severity and count: one low package finding
- Installed version: 0.27.7 nested under Lovable MCP
- Execution surface: esbuild development server file access on Windows
- BathOS reachability: not reachable in production and not the root Vite esbuild runtime. Root Vite uses patched esbuild 0.28.1. The remaining node is owned by the local Lovable MCP toolchain and BathOS development is currently performed on macOS.
- Applicable fix: esbuild 0.28.1 is patched, but Lovable MCP 0.20.1 declares an esbuild 0.27.x dependency range. npm can identify a fixed version but cannot install it without violating the owner range.
- Decision: do not add an override. Reassess with a separately tested Lovable MCP upgrade.

## Compatibility Evidence

- `npm ls` reports a valid graph with PostCSS 8.5.25 and the intended patched transitive versions.
- Production and development Vite builds complete with identical CSS and client chunk sizes. The generated CSS is 97.88 kB, 16.90 kB gzip.
- Seven focused shared-UI, MCP, and deployment test files pass, covering 103 tests.
- The task-reminder Edge Function bundles successfully with the local Supabase Edge Runtime image.
- A development build regenerated the tracked MCP source import pins from Lovable MCP 0.20.0 to 0.20.1. Those two generated changes were inspected and restored because Edge source alignment is reserved for Phase 5. No Edge Function was deployed.

## Decision

Accept the compatible patch refresh. It halves the audit package-findings count from 12 to 6 and removes all currently compatible findings without changing product behavior. The remaining audit output consists of one RSC-only high advisory, one Windows-only MCP static-serving moderate advisory reported through three owners, and one Windows-only nested development-server low advisory. None is reachable in the current BathOS production architecture.
