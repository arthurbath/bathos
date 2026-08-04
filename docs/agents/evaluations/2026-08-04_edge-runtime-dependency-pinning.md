# Edge Runtime Dependency Pinning Evaluation

## Scope

This evaluation selects and bounds Phase 5 of the dependency-hardening program. It changes repository Edge dependency source and local verification only. It does not change function behavior, database objects, RLS, managed secrets, production data, or deployed functions.

## Current Inventory

| Function or generator | Current dependency source | Current lock boundary | Target |
| --- | --- | --- | --- |
| `admin-delete-users` | esm.sh Supabase JS floating `@2` | none | function-local npm mapping at exact 2.112.0 |
| `check-auth-rate-limit` | npm Supabase JS floating `@2` | none | function-local npm mapping at exact 2.112.0 |
| `delete-user-account` | esm.sh Supabase JS floating `@2` | none | function-local npm mapping at exact 2.112.0 |
| `notify-new-signup` | esm.sh Supabase JS floating `@2` | none | function-local npm mapping at exact 2.112.0 |
| `send-feedback-email` | esm.sh Supabase JS floating `@2` | none | function-local npm mapping at exact 2.112.0 |
| `submit-help-request` | npm Supabase JS exact 2.50.0 | none | function-local npm mapping at exact 2.112.0 |
| `dispatch-task-reminders` | function-local Supabase JS 2.95.3 and web-push 3.6.7 | committed Deno v4 lock | Supabase JS 2.112.0, current web-push retained, refreshed lock |
| `tasks-widget-actions` | function-local Supabase JS 2.95.3 | no committed lock | Supabase JS 2.112.0 and generated lock evidence |
| generated `mcp` | Lovable MCP 0.20.1, Zod `^3.25.76`, Supabase JS 2.112.0, fractional-indexing 4.0.0 | root npm lock plus generated source | exact existing versions with exact root generator inputs |

The cached local Supabase Edge Runtime is 1.74.2. The existing reminder verification bundles with that image, and the local Supabase CLI serve path starts all configured functions through the same development stack.

## Supported Targets

- Supabase JS 2.112.0 is the current stable registry release and requires Node 22 or later for Node execution. Supabase Edge Functions execute it through Deno's npm compatibility layer.
- web-push 3.6.7 and `@types/web-push` 3.6.4 are the current stable registry releases.
- Lovable MCP 0.26.1 is newer than installed 0.20.1, but both releases declare MCP SDK 1.28.0 and esbuild 0.27.x. Moving to 0.26.1 would not resolve the classified MCP-chain advisories, so this phase pins installed 0.20.1 rather than taking an unrelated pre-1.0 feature upgrade.
- Zod 4 is a separate compatibility migration. The generated MCP surface retains exact 3.25.76.
- Existing Node 22.15.30 Edge types remain on the supported Node 22 line. The current Node 26 type package is not a runtime security fix and is outside this compatibility phase.

## Dependency Management Basis

Supabase's [Edge dependency guide](https://supabase.com/docs/guides/functions/dependencies) recommends npm specifiers and function-local `deno.json` files for isolation. Its [npm security guidance](https://supabase.com/docs/guides/security/npm-security) recommends exact Edge versions because Deno runtime resolution does not inherit npm's minimum-release-age protection. Supabase's [dependency analysis guidance](https://supabase.com/docs/guides/troubleshooting/edge-function-dependency-analysis) also recommends exact pins to prevent unexpected bundle-size and startup changes. Deno documents lockfiles as the integrity and exact-resolution record for reproducible dependency graphs.

## Verification Routes

| Surface | Verification |
| --- | --- |
| Exact source and Deno mappings | `src/integrations/supabase/edgeDependencyPins.test.ts` |
| MCP generation and deployment contract | MCP deployment/configuration Vitest files plus repeated Vite generation diff |
| Reminder dependency graph | `npm run verify:tasks:edge-bundle` |
| Reminder HTTP boot | `npm run verify:tasks:edge-serve` |
| All configured functions | local Supabase Functions serve startup and bounded request probes |
| Repository compatibility | full Vitest suite, Tasks typecheck, lint, production build, npm graph/audit, and strict OpenSpec validation |

## Rollback

Restore the prior Edge entrypoints, Deno configuration and locks, root generator ranges, generated MCP source, and dependency-pin test as one unit. No database or deployed-function rollback is required because Phase 5 does not deploy.

## Final Evidence

- All eight hand-maintained functions resolve `@supabase/supabase-js` through function-local npm maps pinned to 2.112.0. The generated MCP function contains exact imports for Lovable MCP 0.20.1, Zod 3.25.76, Supabase JS 2.112.0, and fractional-indexing 4.0.0.
- Deno 2.1.4 regenerated the reminder and widget lockfiles. The reminder lock retained web-push 3.6.7, `@types/web-push` 3.6.4, and Node 22.15.30 types while replacing the prior Supabase 2.95.3 family with 2.112.0.
- The focused Edge suite passed 53 assertions. The complete repository suite passed 1,433 tests in 174 files, with 9 opt-in files and 16 opt-in tests skipped as designed.
- Supabase Edge Runtime 1.74.2 generated a 13,198,015-byte reminder bundle. Local Supabase Functions served and resolved all ten configured functions through safe `OPTIONS` probes, and the reminder `GET` boundary returned the expected 405 with `Allow: POST`.
- ESLint completed with no errors and one pre-existing Fast Refresh warning. TypeScript completed with no errors. The production build transformed 3,496 modules and reproduced the generated MCP SHA-256 `163b885bd95884cd31f4c469294a95ca0f5b55bc34840c93630bfbb489bd8b2c` on a second generation.
- A clean `npm ci` installed 732 packages, the dependency tree resolved, and strict OpenSpec validation passed all 53 items. The audit remains at zero critical, two high, three moderate, and one low package findings. Those six findings are the already-classified unreachable RSC-only React Router advisory and owner-blocked Lovable MCP development-chain advisories, not new Edge findings.
- The resolved root package graph did not change in this phase: the Lovable MCP and Zod edits replaced ranges with the already-installed exact versions. A separate Phase 5 performance rerun was therefore unnecessary under the change contract. The comprehensive baseline-versus-final performance assessment remains the program closeout gate.
- No deploy command ran. No database, managed secret, production data, or deployed function changed. Local serve processes stopped, generated serve directories and the clean-install directory were removed, and no Phase 5 bundle artifact remains.
