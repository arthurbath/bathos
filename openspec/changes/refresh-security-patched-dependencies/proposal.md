## Why

The post-Vite dependency graph still contains safely fixable PostCSS and transitive security advisories, including high-severity denial-of-service, URI parsing, address classification, and HTTP client findings. BathOS should consume the smallest supported patched dependency set without introducing unrelated framework or product changes.

## What Changes

- Update PostCSS to a patched 8.5.x release.
- Apply only non-forced, non-major dependency refreshes justified by the current audit and lockfile graph.
- Refresh safely fixable transitive `brace-expansion`, `undici`, `fast-uri`, `ip-address`, Hono, Lovable MCP, and related packages.
- Compare audit results by advisory and reachability rather than raw package-node count.
- Document findings that remain because the owning direct dependency does not offer an applicable fix.
- Preserve current React, Tailwind, Zod, date-fns, Recharts, PowerSync, Supabase, and product behavior.

## Capabilities

### New Capabilities

- `dependency-security-maintenance`: Defines the bounded, evidence-backed process for refreshing safely patchable direct and transitive dependencies while documenting unresolved findings.

### Modified Capabilities

None.

## Impact

- Affected dependency surfaces: `package.json`, `package-lock.json`, PostCSS, Lovable MCP tooling, and transitive parser, HTTP, and build packages.
- Verification surfaces: CSS builds and representative rendered UI, MCP contracts and deployment configuration, Edge bundle verification if MCP resolution changes, clean install, dependency graph, security audit, and the complete BathOS regression matrix.
- No intended product behavior, database, Supabase configuration, Edge deployment, or production data impact.
