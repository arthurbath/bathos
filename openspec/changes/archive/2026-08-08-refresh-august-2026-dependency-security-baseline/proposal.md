## Why

The August 8 dependency assessment found newly affected compatible transitive packages, an unbounded Node runtime policy, and a small Supabase client patch gap across BathOS browser, Edge, and offline-spike surfaces. Applying the supported patch set now removes reachable toolchain advisories and restores one explicit, reproducible runtime and Supabase baseline without taking unrelated major upgrades.

## What Changes

- Update the root and isolated-spike PostCSS and transitive Nano ID graphs, plus the root js-yaml graph, to current compatible patched releases.
- Require supported Node.js 22 or newer and pin Node.js 24 LTS for ordinary local development.
- Align direct browser Supabase and Auth clients, all exact Edge Supabase imports, and the isolated PowerSync spike to Supabase JS 2.112.2.
- Regenerate applicable npm and Deno lock evidence, then verify clean installation, advisory closure, Edge bundling and serving, browser and offline-client behavior, native contracts, and the complete regression matrix.
- Retain the existing unreachable Lovable MCP Windows-only Hono and esbuild findings with current reachability evidence rather than forcing incompatible overrides.
- Do not deploy Edge Functions, alter Supabase schema or production data, or adopt unrelated major dependency lines.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `development-toolchain-security`: Add an explicit supported Node runtime floor and Node 24 LTS local-development pin.
- `browser-supabase-reliability`: Permit coordinated browser and Edge client maintenance while preserving independent exact pins and prohibiting implicit deployment.
- `edge-dependency-reproducibility`: Move the single approved Edge Supabase JS version from 2.112.0 to 2.112.2.

## Impact

- Root and isolated-spike npm manifests and lockfiles, root Node runtime policy, and function-local Deno dependency maps and applicable locks.
- Shared browser Supabase initialization, Tasks offline synchronization, Edge Function dependency resolution, MCP generation, CSS compilation, and development tooling.
- All user-facing modules inherit the rebuilt shared application, but no module source, UI behavior, API contract, database object, RLS policy, migration, secret, or deployed service changes.
