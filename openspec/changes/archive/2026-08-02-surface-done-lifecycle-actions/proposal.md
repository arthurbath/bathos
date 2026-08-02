## Why

Quick Find currently hides Done results even when they are the only matches, creating an avoidable mismatch with full Search. Done also lacks an explicit user-facing path for irreversible removal even though Tasks already retains terminal work for only 30 days and already has guarded permanent-deletion infrastructure.

## What Changes

- Return completed and deleted task roots in Quick Find while retaining the existing result ranking and three-result limit.
- Label Done Quick Find results explicitly as `Completed` or `Deleted` and route them to Done.
- Offer `Delete Permanently...` for any retained task in Done, whether it entered Done through completion, cancellation, or deletion.
- Require a server-authoritative preview and an explicit confirmation step before irreversible deletion.
- Add subtle Done footer copy stating that items in Done are permanently deleted after 30 days.
- Extend the existing owner-authorized permanent-deletion scope from deleted task roots to every retained terminal task root without exposing a broader database mutation surface.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Quick Find includes clearly labeled Done results, Done exposes guarded permanent deletion, and Done communicates its existing 30-day retention policy.

## Impact

- Tasks Quick Find result construction, presentation, ranking tests, and navigation.
- Done task row menus, confirmation UI, pending/error handling, and list footer copy.
- Existing Tasks permanent-deletion service and its Supabase RPC scope validation.
- Personal Tasks OpenSpec scenarios and targeted unit/integration coverage.
