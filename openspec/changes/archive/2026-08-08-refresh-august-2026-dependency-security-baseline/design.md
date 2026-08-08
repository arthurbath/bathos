## Context

BathOS currently pins the root browser Supabase and Auth clients and every Edge Supabase client to 2.112.0, while the isolated PowerSync spike remains on 2.110.7. The August 8 registry and advisory refresh also reports root js-yaml 4.3.0, root and spike Nano ID 3.3.16, and spike PostCSS 8.5.20 as affected by newly published denial-of-service and file-disclosure advisories. The root manifest does not state a Node engine even though Supabase JS 2.112.2 requires Node 22 or later and the project-standard supported runtime is Node 24 LTS.

The repository's existing dependency-security contract requires compatible non-forced remediation, clean installation, complete regression testing, Edge resolution proof, and explicit evidence for residual advisories. Its Edge contract requires one exact Supabase version across every deployable function. The local `node_modules` tree contains iCloud duplicate-package pollution, so dependency conclusions must come from the committed manifests and locks plus a clean disposable installation rather than the ambient installed tree alone.

## Goals / Non-Goals

**Goals:**

- Select root PostCSS 8.5.26, patched spike PostCSS, Nano ID 3.3.18, and js-yaml 4.3.1 through compatible direct and transitive ranges.
- Align root Supabase JS and Auth, the PowerSync spike, all function-local maps and locks, the generated MCP source, and dependency-pin tests to exact Supabase JS 2.112.2.
- Declare Node 22 or newer as the supported engine floor and use Node 24 LTS as the local project pin.
- Prove the original advisories no longer appear, preserve browser authentication and retry behavior, preserve offline synchronization and native contracts, and verify Edge bundling and HTTP startup without deployment.

**Non-Goals:**

- PowerSync 2, WA-SQLite 2, React 19, Vite 8, Tailwind 4, or other unrelated major migrations.
- Forced npm audit remediation, out-of-range overrides, production deployment, schema changes, RLS changes, migrations, secrets, or production-data mutation.
- Removing residual Lovable MCP findings whose fixed releases remain outside the owning dependency ranges and whose vulnerable Windows-only paths are not reachable in BathOS production.

## Decisions

1. Update only the assessed compatible set. The root manifest will select PostCSS 8.5.26 and exact Supabase 2.112.2 packages. npm will refresh root and spike Nano ID, spike PostCSS, and root js-yaml within their existing owner ranges. This closes the current compatible findings without coupling the work to unrelated broad `npm update` output. Adding direct js-yaml, Nano ID, or spike PostCSS dependencies was rejected because BathOS does not import them directly and the existing owner ranges admit patched versions.
2. Use `engines.node: >=22.0.0` with `.nvmrc` set to `24`. The engine expresses the actual Supabase support floor and allows supported newer Node releases, while the local pin makes the tested active-LTS choice reproducible. Restricting the manifest to Node 24 alone was rejected because Node 26 is also supported and current on this Mac.
3. Treat Supabase 2.112.2 as one coordinated source update across browser, Edge, MCP generation, and the isolated spike, but keep deployment out of scope. Coordinating exact source pins prevents a second direct client version without conflating source verification with production mutation.
4. Regenerate only the two existing committed Deno locks. Other hand-maintained functions retain isolated exact maps without newly introducing lock policy beyond the current contract. The MCP source remains generated from the exact root manifest and must be deterministic on a second build.
5. Verify from a clean disposable npm installation in addition to the working tree. The clean graph is authoritative for audit and dependency-tree validity because ambient iCloud duplicate-package artifacts can make `npm ls` report unrelated extraneous nodes.
6. Retain the temporary dependency-upgrade performance waiver for individual timing ceilings, then compare repeated final performance measurements with the August 4 baseline. A single synthetic threshold failure is not a user-facing regression, but a material average degradation must be reported.

## Risks / Trade-offs

- [Risk] Supabase patch types alter generic inference in browser, Edge, or offline connectors. -> Run TypeScript, focused client lifecycle, Edge type and bundle checks, the complete unit suite, and offline/multi-client integrations. Make only narrow type repairs if required.
- [Risk] Regenerated Deno locks change packages beyond Supabase. -> Diff each lock and reject unrelated direct dependency drift; retain exact web-push and type-package pins.
- [Risk] Toolchain patches alter generated CSS or production bundles. -> Run both Vite builds, lint, representative browser smoke checks, and compare final bundle and performance evidence with the prior baseline.
- [Risk] Node 24 policy passes only under the machine's Node 26 installation. -> Execute the clean install and core regression gates with Node 24 available through the repository pin or a disposable Node 24 runner, while also confirming the current supported Node 26 environment remains compatible.
- [Risk] An audit count decreases while an applicable advisory remains. -> Compare advisory identities and dependency paths, confirm js-yaml and Nano ID no longer reproduce, and document every residual finding by execution surface and fix availability.

## Migration Plan

1. Record the current graph, advisories, registry versions, and Supabase changelog constraints.
2. Add the Node policy and update root and spike npm manifests and lockfiles.
3. Update function-local maps, applicable Deno locks, the generated MCP source, and exact-version tests.
4. Run focused security closure, clean-install, dependency-tree, Edge, browser, offline-sync, native, global, and performance validation.
5. If any non-performance regression cannot be repaired narrowly, restore the changed manifests, locks, Edge maps, generated source, tests, and Node policy as one unit. No database or deployed-function rollback is required.

## Open Questions

None. The weekly report and current registry metadata provide the exact targets and validation boundary.
