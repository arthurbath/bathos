## Context

The root application resolves Vite 5.4.21 through the root declaration and the
peer ranges of Vitest, `@vitejs/plugin-react-swc`, `lovable-tagger`, and Lovable
MCP. Vite 5 is unsupported and is inside current Vite and esbuild advisory
ranges. The ordinary development server also binds to `::`, so every local
session is reachable from available network interfaces even when the developer
only needs localhost.

The repository runs Node 24.12.0, which satisfies Vite 7.3.6's Node requirement.
The isolated PowerSync spike already uses Vite 7.3.6 and is outside the root
lockfile. Vite 8.2.0 is current but replaces more of the build pipeline and is a
separate major compatibility decision.

## Goals / Non-Goals

**Goals:**

- Resolve the root graph to one exact supported Vite 7.3.6 installation.
- Remove the Vite 5 advisory exposure from ordinary development and builds.
- Make localhost the default development-server boundary.
- Retain an explicit LAN command for intentional device testing.
- Preserve React SWC compilation, Vitest, HMR, console mirroring, Lovable
  development tagging, MCP generation, PowerSync and WA-SQLite assets, PWA
  behavior, and every BathOS route.

**Non-Goals:**

- Adopt Vite 8 or its Rolldown migration.
- Upgrade React, Vitest, Supabase, PowerSync, PostCSS, or unrelated packages.
- Change product UI, module behavior, Supabase objects, Edge Function runtime
  dependencies, native companions, or production deployment state.
- Hand-edit the generated MCP Edge Function bundle.

## Decisions

### Pin Vite 7.3.6 as one compatibility unit

The root manifest will use exact Vite 7.3.6. The installed peer graph will be
inspected after installation and must resolve one valid Vite node with no Vite 5
copy. Existing compatible peer packages will remain unchanged unless an actual
peer, build, or runtime failure proves a narrowly required companion update.

Vite 8 was rejected for this phase because it expands a security maintenance
change into a build-engine migration. Remaining on Vite 5 was rejected because
the line is unsupported and no longer receives fixes.

### Default to an IPv4 loopback listener

`vite.config.ts` will bind the ordinary server to `127.0.0.1`. A separate
`dev:lan` script will pass an explicit all-interface host for device testing.
Using a single config flag or environment-dependent implicit exposure was
rejected because it makes the ordinary command's security boundary less clear.

### Treat existing Vite integrations as acceptance contracts

Phase acceptance will cover both production and development builds, a forced
fresh server startup, HMR, client-console mirroring, development-only Lovable
tagging, MCP generation, PWA/service-worker behavior, and PowerSync and
WA-SQLite asset loading. Safari will cover every registered route. Generated
MCP output may change only through its owning plugin/tooling and will be
inspected rather than manually patched.

## Risks / Trade-offs

- **Risk: Vite 7 changes configuration or asset defaults** -> Run focused build,
  worker, PWA, service-worker, MCP, and real-browser checks before the full gate.
- **Risk: A peer package silently installs another Vite version** -> Require
  `npm ls vite` to report one valid 7.3.6 node and no invalid or extraneous peer.
- **Risk: Localhost-only development surprises device testing** -> Preserve an
  explicit `npm run dev:lan` command whose network exposure is intentional.
- **Risk: Concurrent unrelated work affects the full suite** -> Preserve the
  existing dirty changes, inspect failures for attribution, and do not stage or
  rewrite unrelated files.
- **Risk: Performance samples remain noisy** -> Execute and record them under
  the temporary dependency-upgrade waiver, while keeping functional and
  security failures blocking.

## Migration Plan

1. Add focused tests for the default and explicit LAN server boundaries.
2. Install exact Vite 7.3.6 without updating unrelated direct dependencies.
3. Adapt only configuration or compatible peer packages proven necessary by
   Vite 7.
4. Run the focused toolchain, worker, PWA, MCP, and Safari checks.
5. Run the complete repository and Tasks integration matrix, recording timing
   results under the temporary waiver.
6. Roll back only the Vite/config/script changes if a functional or security
   acceptance gate cannot be repaired within this phase.

## Open Questions

None.
