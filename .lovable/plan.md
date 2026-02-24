

# Resilience and Performance Audit -- Recommendations

## Current State Assessment

After reviewing all data hooks, the network error utility, the Supabase client configuration, and React Query setup, here is a summary of what exists today and what needs to change.

### What already works
- `retryOnLikelyNetworkError` utility exists with exponential backoff (3 attempts, 250ms base delay)
- Mutation timing/logging via `withMutationTiming` with Sentry breadcrumbs
- `pendingById` guards prevent double-submission of the same row
- React Query `refetchOnWindowFocus` is disabled (avoids unnecessary refetches)
- Auth context compares user IDs before re-rendering

### Problems found

**1. Retry coverage is inconsistent -- most hooks have zero retry protection**

Only `useExpenses` and `useLinkedAccounts` wrap Supabase calls in `retryOnLikelyNetworkError`. The following hooks make bare `supabase.from(...)` calls with no retry at all:

| Hook | Reads | Mutations |
|------|-------|-----------|
| `useIncomes` | No retry | No retry |
| `useCategories` | No retry | No retry |
| `useBudgets` | No retry | No retry |
| `useRestorePoints` | No retry | No retry |
| `useHouseholdData` | No retry | No retry |
| `useGridColumnWidths` | No retry | No retry |
| `useDrawersUnits` | No retry | No retry |
| `useDrawerInsertInstances` | No retry | No retry |

A single transient "Load failed" in any of these hooks surfaces immediately as an error to the user.

**2. React Query has no built-in retry configured**

The `QueryClient` is created with only `refetchOnWindowFocus: false`. React Query's default `retry: 3` applies to queries, but there is no `retry` configured for mutations (default is 0). This means every failed mutation immediately throws.

**3. No optimistic updates -- UI waits for the server round-trip**

All mutations follow a "wait for server, then update cache" pattern. If the network is slow, the UI feels sluggish. If the network fails, the user sees an error with no local feedback.

**4. No user-facing error toasts on mutation failure**

When a mutation throws, the error bubbles up to the component but most components don't catch it or show a toast. The user sees the UI "lock up" because the pending state clears but no feedback appears.

**5. Two build errors to fix**

- `useGridColumnWidths.ts` line 220: The `.upsert()` call passes an object but TypeScript expects an array
- `useDrawersUnits.ts` line 115: `data as DrawersUnit` cast needs `as unknown as DrawersUnit`

---

## Recommended Plan

### Phase 1: Fix build errors (immediate)

**File: `src/hooks/useGridColumnWidths.ts`** (line 216-224)
- Change `.upsert({ user_id, grid_column_widths }, { onConflict: 'user_id' })` to `.upsert([{ user_id, grid_column_widths }], { onConflict: 'user_id' })` (wrap in array)

**File: `src/modules/drawers/hooks/useDrawersUnits.ts`** (line 115)
- Change `data as DrawersUnit` to `data as unknown as DrawersUnit`

### Phase 2: Universal retry for all Supabase calls

**File: `src/lib/networkErrors.ts`**
- No changes needed -- the utility is solid

**Files: All 8 hooks listed above**
- Wrap every `supabase.from(...)` and `supabase.rpc(...)` call in `retryOnLikelyNetworkError(...)`, matching the pattern already used in `useExpenses` and `useLinkedAccounts`
- This gives every network call 3 automatic retries with exponential backoff before surfacing an error

Affected files:
- `src/hooks/useIncomes.ts` -- 4 calls (1 read, 3 mutations)
- `src/hooks/useCategories.ts` -- 5 calls
- `src/hooks/useBudgets.ts` -- 5 calls
- `src/hooks/useRestorePoints.ts` -- 4 calls
- `src/hooks/useHouseholdData.ts` -- 3 reads + 3 RPCs
- `src/hooks/useGridColumnWidths.ts` -- 2 calls
- `src/modules/drawers/hooks/useDrawersUnits.ts` -- 4 calls + 1 RPC
- `src/modules/drawers/hooks/useDrawerInsertInstances.ts` -- 4 calls + 3 RPCs

### Phase 3: Configure React Query retry for queries

**File: `src/App.tsx`**
- Add `retry` configuration to the QueryClient defaults so queries also benefit from automatic retry:

```text
queries: {
  refetchOnWindowFocus: false,
  retry: (failureCount, error) => {
    if (failureCount >= 2) return false;
    return isLikelyNetworkError(error);
  },
}
```

This gives query-level retry only for network errors, preventing duplicate retries for application-level errors (like RLS violations).

### Phase 4: User-facing error feedback on mutation failure

**File: `src/lib/networkErrors.ts`**
- Add a small helper `showMutationError(error)` that calls `toast.error(toUserFacingErrorMessage(error))` using sonner

**Files: All hooks with mutations**
- In the `catch` block of each mutation, call `showMutationError(error)` so the user always sees clear feedback when a save fails, rather than the UI silently doing nothing

### Summary of changes

| Area | Files changed | What it does |
|------|--------------|--------------|
| Build fixes | 2 files | Fixes TypeScript errors blocking deployment |
| Universal retry | 8 hook files | Every Supabase call gets 3 retries with backoff |
| Query-level retry | `App.tsx` | React Query retries failed queries for network errors |
| Error toasts | `networkErrors.ts` + 8 hooks | User always sees clear feedback on failure |

### What this plan intentionally does NOT include

- **Optimistic updates**: These add significant complexity (rollback logic, conflict resolution) and are better addressed as a separate effort once the reliability foundation is solid.
- **Offline queue / background sync**: Overkill for the current app scope.
- **Debouncing mutations**: The `pendingById` guards already prevent double-submission; debouncing would add latency to saves.

