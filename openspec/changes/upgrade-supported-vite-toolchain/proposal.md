## Why

BathOS still uses unsupported Vite 5.4.21, which remains in vulnerable advisory
ranges and exposes ordinary development sessions on every interface through the
current `::` host. The build toolchain should move to the supported Vite 7.3
line and make network exposure an explicit developer choice.

## What Changes

- Upgrade the root build toolchain to exact Vite 7.3.6 and retain only peer
  packages that resolve one valid supported Vite graph.
- Bind ordinary `npm run dev` sessions to localhost instead of all interfaces.
- Add a separate explicit command for intentional LAN and device testing.
- Preserve production and development builds, HMR, client-console mirroring,
  development-only Lovable tagging, MCP bundle generation, PowerSync and
  WA-SQLite assets, and the PWA/service-worker boundary.
- Add dependency-graph and development-server regressions that prevent an
  unsupported Vite node or accidental default network exposure from returning.
- Keep Vite 8, React, Vitest, Supabase, PowerSync, and unrelated dependency
  upgrades outside this compatibility unit.

## Capabilities

### New Capabilities

- `development-toolchain-security`: Supported build-tool versions, safe default
  development-server binding, explicit LAN exposure, and retained build/runtime
  integration behavior.

### Modified Capabilities

None.

## Impact

- Root `vite` development dependency and npm lockfile
- Root Vite configuration and development scripts
- Vite peer compatibility for the React SWC plugin, Vitest, Lovable MCP, and
  `lovable-tagger`
- Local development startup, HMR, console mirroring, module routing, PWA assets,
  PowerSync workers, WA-SQLite assets, and production builds
- No product data behavior, module API, Supabase object, Edge Function source,
  database migration, production deployment, or native companion change
