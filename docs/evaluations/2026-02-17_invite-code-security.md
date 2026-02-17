# Invite Code Exposure Fix

**Date:** 2026-02-17
**Category:** Security
**Finding:** `budget_households_invite_code_exposure` (error)

## Problem

The `budget_households` table had a SELECT RLS policy `"Anyone can find household by invite code"` with `USING (true)`, which allowed **any user (including unauthenticated)** to read all household records — names, invite codes, and partner details. An attacker could enumerate every invite code and join any household.

## Root Cause

PostgreSQL RLS policies cannot inspect query `WHERE` clauses. A `USING (true)` policy grants access to every row regardless of what the client filters on.

## Fix Applied

1. **Dropped** the permissive `"Anyone can find household by invite code"` SELECT policy.
2. **Created** a `SECURITY DEFINER` function `lookup_household_by_invite_code(_code text)` that returns only the household UUID for a matching invite code — no other columns are exposed.
3. **Updated** `useHouseholdData.ts` → `joinHousehold()` to call the RPC instead of querying the table directly.

## Result

- Invite codes are no longer exposed to clients.
- The join flow works identically from the user's perspective.
- Only the household ID is returned, minimising information leakage.
