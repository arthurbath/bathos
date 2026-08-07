## 1. Native Lucide Contract

- [x] 1.1 Add a deterministic generator, shared vector asset catalog, and typed SwiftUI renderer for the bounded canonical Lucide widget icon set.
- [x] 1.2 Add the shared assets and renderer to the iOS, macOS, and watch widget targets.
- [x] 1.3 Add a repository contract test that guards native semantic icon names against `TASK_ICON_NAMES`.

## 2. Widget Integration

- [x] 2.1 Replace list-header, Today-horizon, task-state, recurrence, add-action, and empty-state substitutes in the shared iOS/macOS list widget.
- [x] 2.2 Replace generic and protocol-specific Primary Link substitutes in the shared list widget.
- [x] 2.3 Replace the watch complication's SF Symbol checkmark with the canonical Lucide checkmark.
- [x] 2.4 Retain the adaptive `plus.square` symbol in the iOS New Task control as the live-device-proven system-surface exception, document it, and guard it against ordinary-image regression.

## 3. Verification

- [x] 3.1 Run focused icon contract and regression tests.
- [x] 3.2 Build the iOS widget, macOS widget, and watch complication targets without signing.
- [x] 3.3 Run `npm run spec:validate`, `npm run lint`, and `git diff --check`.
