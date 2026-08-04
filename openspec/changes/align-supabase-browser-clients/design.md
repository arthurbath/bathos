## Context

BathOS currently pins both browser Supabase packages to 2.95.3. The current stable 2.x release is 2.112.0, requires Node 22 or later, and aligns all Supabase JavaScript subpackages to that exact release. BathOS runs Node 24.12.0 and TypeScript 5.8.3, satisfying the current and announced support boundaries.

Supabase JS 2.102.0 introduced automatic retries for transient GET and HEAD PostgREST requests. It makes up to three retries after the initial request with exponential delays of 1, 2, and 4 seconds, only for network failures and HTTP 503/520 responses. Writes are intentionally not retried.

BathOS also has two generic outer layers. `supabaseRequest` defaults to four total attempts and can retry both reads and writes. React Query can repeat network-failed query functions. Once the new client is installed, a wrapped query could therefore multiply the Supabase client's internal attempts, and a wrapped mutation could retain ambiguous-response replay risk.

## Goals / Non-Goals

**Goals:**

- Use one exact tested Supabase release across the direct browser client and direct Auth import.
- Gain bounded automatic recovery for idempotent PostgREST reads.
- Prevent generic retry multiplication and automatic replay of non-idempotent writes.
- Preserve all current session, refresh, sign-out, and native-companion lock behavior.
- Prove the upgrade through local Supabase, Safari, module, integration, clean-install, and audit evidence.

**Non-Goals:**

- No Supabase 3 prerelease.
- No database, migration, RLS, Auth-provider, or production-data change.
- No Edge Function import or lockfile change.
- No removal of explicit retry logic that has a domain-specific idempotency or conflict contract, such as Tasks mutation identities.

## Decisions

1. Pin both direct packages to exact version 2.112.0. This is the current stable 2.x release, meets the plan's 2.102.0 minimum, keeps direct Auth types identical to the Auth copy owned by supabase-js, and avoids range drift.
2. Explicitly enable `db.retry` on the shared browser client. Although enabled by default, making the setting visible protects the intended reliability contract from unnoticed default changes.
3. Reduce `supabaseRequest` to one generic attempt and retain its normalized success/error contract. The Supabase client owns safe GET/HEAD retry behavior. POST, PATCH, PUT, DELETE, and RPC operations are not replayed by the generic wrapper after an ambiguous response.
4. Disable the root React Query automatic retry layer. Supabase-backed query functions already receive the client's bounded GET/HEAD recovery, so an outer generic retry would multiply the request and latency budget. Explicit domain-specific retries remain allowed where their operation is proven safe.
5. Preserve `resolveSupabaseAuthLock` without modification. Native companions continue to use `processLock`, while ordinary Safari/browser contexts retain the Supabase browser lock.
6. Keep Edge source unchanged. Vite may regenerate the MCP function with the newer local package, but generated Edge changes are restored and deferred to Phase 5.

Alternatives considered:

- Keeping all three retry layers was rejected because it can multiply one logical query into many requests and extend failure latency substantially.
- Disabling the Supabase retry option was rejected because it would discard the robustness improvement that motivates the minimum target.
- Retaining generic write retries was rejected because the client deliberately excludes non-idempotent methods and an ambiguous write response can make replay unsafe.

## Risks / Trade-offs

- [Risk] A latest stable 2.x Auth or PostgREST behavior change breaks session handling. -> Mitigation: focused Auth tests, local session lifecycle tests, Safari authenticated smoke testing, and rollback to the exact 2.95.3 pins.
- [Risk] Removing outer generic retries reduces recovery for non-Supabase or mutation operations. -> Mitigation: retain explicit domain-safe retry mechanisms and test that generic mutations stop after one ambiguous failure.
- [Risk] Internal retries delay a failed read by up to the documented bounded backoff. -> Mitigation: prohibit additional generic outer retries and retain final performance measurements under the temporary waiver.
- [Risk] Build tooling regenerates Edge output. -> Mitigation: inspect and restore generated changes in this phase, with no deployment.

## Migration Plan

1. Add focused tests for client options, lock preservation, single-layer retry behavior, and non-replayed writes.
2. Install exact Supabase JS and Auth 2.112.0 pins with the task-specific npm cache.
3. Enable the client retry option, remove the two generic outer retry layers, and inspect the installed graph and all generated output.
4. Run focused Auth, account, household, module, local-session, and retry tests.
5. Run clean install, audit, build, complete repository gate, Tasks integrations, Safari authenticated module coverage, timing checks, and strict OpenSpec validation.
6. Roll back the manifest, lockfile, and retry-policy changes together if any non-performance gate fails.

## Open Questions

None. Edge alignment remains intentionally deferred.
