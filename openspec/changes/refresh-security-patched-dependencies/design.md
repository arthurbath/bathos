## Context

After the Vite 7 upgrade, `npm audit` reports 12 package findings: zero critical, six high, five moderate, and one low. A non-forced dry run proposes ten changes that fit existing dependency ranges: PostCSS 8.5.25, three patched `brace-expansion` nodes, `undici` 7.29.0, `fast-uri` 3.1.5, `ip-address` 10.4.0, Hono 4.13.0, `@hono/node-server` 1.19.17, and Lovable MCP 0.20.1.

Some findings cannot be removed within the current compatible graph. Lovable MCP pins MCP SDK 1.28.0, which allows only the vulnerable `@hono/node-server` 1.x line and an esbuild 0.27.x line below the patched 0.28.1 release. The React Router RSC advisory also remains reported even though BathOS uses declarative SPA routing and no RSC server-action surface.

## Goals / Non-Goals

**Goals:**

- Remove every current advisory that has a compatible non-forced fix.
- Keep package changes inside current direct dependency ranges except for an intentional patched PostCSS 8.5.x selection.
- Preserve CSS output, MCP contracts, Edge bundle behavior, application rendering, and all current product behavior.
- Document each remaining advisory by owner, execution surface, applicability, and available fix status.

**Non-Goals:**

- No `npm audit fix --force`.
- No React, Tailwind, Zod, date-fns, Recharts, PowerSync, Supabase, or unrelated major upgrade.
- No Edge Function source alignment or deployment. Those remain Phase 5 work.
- No attempt to suppress audit output or claim an unreachable advisory is removed.

## Decisions

1. Use the current audit and `npm audit fix --dry-run` as the bounded change manifest, then apply `npm audit fix` without `--force`. This lets npm select patched transitive versions already permitted by their owners while avoiding hand-authored override drift.
2. Retain the root PostCSS 8.5 range and require the lockfile to select patched 8.5.25 or later within the tested 8.5 line. The committed lockfile, clean install, and audit provide deterministic evidence without introducing a new package major.
3. Accept Lovable MCP 0.20.1 because it is a compatible patch selected by the dry run, but do not jump to the current 0.26.x minor in this security-only phase. A larger MCP upgrade needs its own compatibility evidence.
4. Do not force `@hono/node-server` 2.x or esbuild 0.28.x beneath packages whose declared ranges exclude them. The unresolved node-server issue is transitive development tooling, and its encoded-backslash Windows static-serving path is not used by BathOS production. The nested esbuild issue is Windows-only development-server behavior and is not the root Vite esbuild runtime.
5. Keep the React Router RSC advisory documented as non-reachable in BathOS's declarative browser router rather than downgrading to the audit tool's suggested vulnerable/older line.

## Risks / Trade-offs

- [Risk] A transitive patch changes CSS, MCP generation, or request behavior. -> Mitigation: compare build artifacts, run representative UI and MCP tests, verify the Edge bundle, and use Safari for rendered checks.
- [Risk] Audit count improves while a reachable advisory remains. -> Mitigation: compare advisory identities and dependency paths before and after, then document every remaining finding.
- [Risk] Forcing an incompatible fix breaks the MCP toolchain. -> Mitigation: never use `--force` or out-of-range overrides in this phase.
- [Risk] Lockfile-only transitive changes drift on later install. -> Mitigation: require `npm ci`, `npm ls`, and a committed lockfile as acceptance evidence.

## Migration Plan

1. Record the post-Vite audit, package explanations, and dry-run manifest.
2. Add focused tests or identify existing CSS, MCP, deployment, Edge-bundle, and representative UI checks.
3. Apply the non-forced audit fix with the task-specific npm cache.
4. Inspect direct and transitive version changes, generated MCP output, CSS/build output, and the installed graph.
5. Run focused verification, a clean install, audit comparison, the complete repository gate, Tasks integrations, and advisory timing checks under the temporary performance waiver.
6. Roll back by restoring the pre-phase package manifest and lockfile if any non-performance gate fails.

## Open Questions

None. Any later Lovable MCP minor or major refresh will be evaluated separately from this bounded patch phase.
