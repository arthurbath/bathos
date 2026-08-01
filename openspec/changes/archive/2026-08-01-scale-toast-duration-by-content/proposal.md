## Why

BathOS toast notifications currently remain visible for a fixed interval that feels excessive for short messages. Toast visibility should instead scale predictably with the amount of text the user needs to read.

## What Changes

- Estimate the number of rendered toast text lines from title and message-body character counts using the available mobile toast width.
- Show a one-line toast for one second and add one second for each additional estimated line.
- Apply the duration centrally so every BathOS module inherits the same behavior without configuring individual toasts.
- Preserve manual dismissal and Radix Toast pause behavior while the user is interacting with a toast.

## Capabilities

### New Capabilities

- `toast-notifications`: Defines shared BathOS toast visibility timing and dismissal behavior.

### Modified Capabilities

None.

## Impact

- Affects the shared toast renderer and a new shared duration utility with focused unit coverage.
- Applies to every module that uses the BathOS toast service.
- Requires no database, Supabase, routing, or dependency changes.
