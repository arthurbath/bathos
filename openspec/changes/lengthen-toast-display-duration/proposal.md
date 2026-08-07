## Why

Automatically dismissed BathOS toasts disappear before users can comfortably read them. The existing content-proportional timing should retain its line-based model while allowing more time for the first line and each additional line.

## What Changes

- Increase the minimum automatic toast duration from 1,000 ms to 2,000 ms.
- Increase the automatic duration added for each estimated text line from 1,000 ms to 1,500 ms.
- Preserve explicit caller-supplied durations and manual dismissal behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `toast-notifications`: Change the shared automatic timing formula to a 2,000 ms base plus 1,500 ms for each estimated text line beyond the first.

## Impact

- Shared toast-duration utility and its focused tests.
- Shared toast-notification behavior across every BathOS module.
- No API, dependency, database, or native-app changes.
