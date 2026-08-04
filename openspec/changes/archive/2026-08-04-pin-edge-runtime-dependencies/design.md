## Context

Six legacy Edge Functions import Supabase JS through a floating `@2` range or the old exact 2.50.0 release. Two Tasks functions map exact 2.95.3 through function-local Deno configuration. The generated MCP source now reflects Supabase JS 2.112.0 and Lovable MCP 0.20.1, but it still emits the root Zod range. This leaves one repository with multiple runtime versions and allows some deployments to change dependency resolution without a reviewed diff.

Supabase recommends function-local `deno.json` dependency management, npm specifiers instead of CDN imports, and explicit versions for external dependencies. Its security guidance recommends exact Edge versions because runtime npm resolution does not inherit npm's minimum-release-age protections. Deno lockfiles preserve resolved versions and integrity data.

## Goals and Non-Goals

**Goals:**

- Make every external Edge dependency version exact and reviewable.
- Align every Edge Supabase client with the accepted browser version 2.112.0.
- Preserve function isolation and generated MCP reproducibility.
- Detect future floating ranges, CDN imports, or generated-source drift in ordinary tests.
- Prove local bundle and HTTP startup behavior without deployment.

**Non-Goals:**

- No Edge Function behavior, request contract, authorization, database, or secret change.
- No Lovable MCP 0.26 feature upgrade. Version 0.26.1 retains the same MCP SDK 1.28.0 and esbuild 0.27 dependency lines as installed 0.20.1, so it does not resolve the remaining npm advisories and would add unrelated pre-1.0 compatibility risk.
- No Zod 4 migration.
- No Edge Function deployment.

## Decisions

1. Use `npm:@supabase/supabase-js@2.112.0` everywhere. Legacy functions move away from esm.sh and floating major specifiers. Function-auth behavior and options remain unchanged.
2. Give hand-maintained functions a function-local Deno dependency map. Keep generated MCP imports generated, but pin the root generator inputs to exact installed versions so regeneration remains deterministic.
3. Retain web-push 3.6.7 and `@types/web-push` 3.6.4 because they are current stable releases. Retain the existing Node 22 type line for Edge compatibility rather than adopting unrelated Node 26 types.
4. Add a focused repository test that enumerates every Edge entrypoint and Deno import mapping. It rejects unversioned, range-based, tag-based, and CDN-hosted external imports and asserts the single approved Supabase JS version.
5. Regenerate applicable lockfiles with the local Edge toolchain and inspect the resulting dependency graph. A lock update must not introduce an unreviewed direct dependency.
6. Verify every function through local Edge startup, plus the existing reminder bundle/HTTP gates and MCP contract tests. Local GET requests may return their designed method or authentication boundary. They must not fail dependency resolution or runtime startup.

## Risks and Mitigations

- **Risk: A legacy function relied on esm.sh transformation behavior.** Use npm specifiers supported by the current Supabase Edge Runtime and boot every function locally.
- **Risk: Supabase JS changes a function's response or Auth behavior.** Keep function code unchanged and exercise focused request boundaries plus the complete repository tests.
- **Risk: Generated MCP source drifts after a build.** Pin the generator inputs exactly, regenerate, and require a clean second regeneration diff.
- **Risk: Lock generation differs from deployed resolution.** Use the cached Supabase Edge Runtime and local Supabase CLI gates that match the repository's current development path.

## Rollback

Revert the Edge entrypoints, Deno configuration and locks, exact generator-input pins, and contract test as one unit. No database or deployed-function rollback is required because this phase does not deploy.
