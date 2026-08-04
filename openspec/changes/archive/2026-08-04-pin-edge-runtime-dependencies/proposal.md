## Why

BathOS Edge Functions currently resolve several different Supabase JS versions, including floating major ranges through npm and esm.sh. The generated MCP source also inherits floating root manifest ranges. A future deployment or local bundle can therefore resolve a different runtime graph without a reviewed source change, and older functions miss the security and robustness fixes already accepted for the browser client.

## What Changes

- Pin every Edge Function Supabase JS dependency to exact stable version 2.112.0.
- Replace legacy esm.sh and floating npm imports with function-local npm mappings or exact generated npm specifiers.
- Pin the root Lovable MCP generator and Zod inputs to their currently installed exact compatible versions so regeneration preserves exact Edge imports.
- Retain exact current web-push, fractional-indexing, and Edge-only type packages unless registry inspection identifies a supported patch.
- Add a repository contract that rejects floating or CDN-hosted Edge dependency imports and detects drift across generated source and function-local Deno configuration.
- Regenerate and verify applicable Deno locks, then prove local Edge bundling and HTTP startup without deploying a function.

## Capabilities

### New Capabilities

- `edge-dependency-reproducibility`: Exact, reviewable, function-isolated Edge dependency resolution with drift detection and local runtime verification.

### Modified Capabilities

None.

## Impact

- Edge source and configuration: all Supabase Edge Function entrypoints, function-local `deno.json` and `deno.lock` files, and generated MCP source.
- Root generator inputs: `@lovable.dev/mcp-js`, Zod, `package.json`, and `package-lock.json` without changing their installed versions.
- Verification: dependency-pin contract tests, MCP deployment tests, task-reminder bundle and serve gates, all-function local startup, fresh audit, build, typecheck, lint, and complete repository tests.
- No database schema, RLS, production data, managed secret, external account, Edge deployment, or production mutation.
