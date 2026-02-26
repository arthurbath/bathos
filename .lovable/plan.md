
Objective
- Eliminate “save failed” experiences in Budget (especially Categories) by hardening client↔Supabase communication, not just speeding individual queries.
- Deliver a system where transient connectivity issues are absorbed automatically and user writes are eventually persisted.

What I found in the current implementation
1) Critical retry gap in current architecture
- Most calls are wrapped with `retryOnLikelyNetworkError(...)`, but Supabase PostgREST often returns network failures as `{ error }` objects rather than throwing.
- Current pattern retries only thrown exceptions inside the wrapper, then throws later at callsite (`if (error) throw error`) — which bypasses retry.
- Effect: many “Network request failed” cases are effectively single-attempt failures despite retry code being present.

2) Budget write paths are still partially unprotected
- `useCategories`, `useIncomes`, `useExpenses`, etc. are mostly wrapped, but some AppShell RPC writes (`budget_reassign_category_and_delete`, `budget_reassign_linked_account_and_delete`, `budget_restore_household_snapshot`) are not wrapped with retry/backoff and have no standardized mutation error UX.
- That creates inconsistency in perceived reliability.

3) No durable mutation queue for Budget
- Drawers module already has queued mutation patterns (`runQueuedMutation` / structural queues), but Budget does not.
- Budget writes are “best effort right now”; if browser loses connection mid-request, the change can fail permanently unless user retries manually.

4) Supabase backend appears healthy; failures are likely transport/client resilience
- No recent postgres/auth/edge error logs surfaced in analytics queries.
- `budget_categories` volume is tiny and fast (EXPLAIN shows sub-ms execution; no DB bottleneck signature).
- Existing indexes/policies are appropriate for current dataset.
- Conclusion: this is not a database throughput problem; it is request-delivery robustness.

5) Performance opportunities (secondary)
- Query client only has query retry rules; mutation retries rely entirely on hook-level wrappers.
- App loads multiple module datasets eagerly in AppShell. Not the root cause of failed category save, but contributes to network chatter under weak connections.

Serious recommendation (code + Supabase posture)

Phase 1 — Fix retry semantics at the root (highest impact)
- Introduce a single “Supabase operation with retry” utility that retries on:
  - thrown fetch/network errors, and
  - resolved results containing retriable `error` payloads.
- Replace direct `retryOnLikelyNetworkError(() => supabase...)` usage with this new helper across all hooks and AppShell RPCs.
- Expand retriable classifier beyond current string matching to include common fetch abort/offline/timeouts/status-family signals.
- Add jitter + longer capped backoff (e.g., 4 attempts, exponential with jitter).

Why this matters
- This addresses the core mismatch causing false confidence in retry behavior.

Phase 2 — Add deterministic mutation reliability for Budget (not just retries)
- Create a Budget mutation queue (same design style as Drawers):
  - serialize conflicting writes per entity/table,
  - prevent overlapping writes from UI double-actions,
  - preserve ordering for add→edit→delete sequences.
- For Categories specifically: queue add/update/remove operations so the UI can’t race itself under rapid interaction.

Why this matters
- Retries fix transient transport failures; queueing fixes client-side race/ordering fragility.

Phase 3 — Add offline/eventual-write behavior for critical writes
- Implement a lightweight outbox for Budget mutations:
  - when save fails for retriable network reasons, persist pending mutation locally,
  - replay automatically on reconnect/app resume,
  - show clear “Pending sync” state rather than hard failure.
- Keep client-generated UUIDs to make retries idempotent for inserts.
- For updates/deletes, include idempotency metadata in payload and dedupe replay attempts.

Why this matters
- If the network is unstable, user actions should still “stick” and sync later.

Phase 4 — Harden Budget RPC/mutation consistency
- Wrap all AppShell RPC writes with the same retry helper + standardized mutation error handling.
- Standardize all writes through one mutation facade (`budgetApi`) so behavior is identical for categories, linked accounts, restore, household updates.
- Ensure every mutation has:
  - retry policy,
  - timing instrumentation,
  - user-visible status (saving / retrying / queued / failed).

Phase 5 — Improve observability so failures are diagnosable in production
- Add request correlation IDs for each mutation and include them in:
  - client logs/Sentry breadcrumbs,
  - mutation timing records,
  - optional DB audit table (minimal payload).
- Capture explicit failure reason taxonomy:
  - offline, DNS/TLS/fetch fail, timeout, auth-expired, RLS/validation, server 5xx.
- Add a hidden diagnostics panel for latest 20 mutation attempts.

Supabase configuration recommendations
- Keep current RLS setup (not the bottleneck).
- Add operational guardrails:
  1) Monitor PostgREST/API error rates and latency in Supabase dashboard (alerts).
  2) Ensure project region is close to primary users; if not, migrate/clone to nearer region for lower RTT.
  3) Keep table/index hygiene (already good for budget tables).
- Optional reliability enhancement:
  - Move critical multi-step writes behind SQL functions (RPC) for atomic server-side execution and fewer client round-trips.
  - For category save specifically, a dedicated `budget_save_category(...)` RPC can centralize validation and simplify client retry logic.

Concrete implementation scope (if approved)
1) New shared helper(s)
- `src/lib/networkErrors.ts` (or `src/lib/supabaseRequest.ts`): add retry-aware Supabase result handling, richer retriable classifier, jittered backoff.
2) Refactor write/read callsites
- All Budget hooks + AppShell RPC write paths to use unified helper.
3) Budget mutation queue/outbox
- New hook/util (e.g., `useBudgetMutationQueue`) and integrate into category/income/expense/link account mutations.
4) QueryClient resilience tuning
- Add mutation retry defaults for retriable network errors.
- Tune reconnect behavior and stale-time to reduce request storms.
5) Instrumentation
- Correlation IDs + enriched timing/error records.

Success criteria
- Category save under flaky connection:
  - no immediate hard failure on first network hiccup,
  - visible retry/pending state,
  - eventual success after reconnect without user re-entry.
- Error rate:
  - significant drop in user-visible “Network request failed” toasts for Budget writes.
- Traceability:
  - every failed save can be classified and traced with correlation ID.

Technical notes
- I do not see evidence of DB-side slowness causing this class of failure.
- The most important immediate fix is correcting retry semantics for Supabase’s `{ error }` response style.
- “Never fail” UX requires eventual-write/outbox behavior; retries alone cannot guarantee that.
