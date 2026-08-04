## Why

Task selection mode currently layers its fixed action bar above the shared toast viewport, which can obscure notifications precisely while bulk actions are active. Toasts need to remain visible without breaking the established mobile-navigation-over-toast hierarchy.

## What Changes

- Place the Tasks selection-mode bar below the shared toast layer.
- Preserve the existing mobile navigation layer above the toast stack.
- Add regression coverage for the intended stacking order.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-visual-foundations`: Require shared toasts to layer above fixed in-content action surfaces such as the Tasks selection-mode bar while remaining below mobile navigation.
- `personal-tasks-module`: Require the fixed selection-mode bar to remain below shared toast notifications.

## Impact

- Affects the Tasks selection-mode toolbar styling and shared visual-layer contract.
- No database, Supabase, native-companion, routing, or dependency changes.
