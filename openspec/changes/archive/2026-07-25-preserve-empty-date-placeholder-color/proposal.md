## Why

Empty shared date-picker fields use muted placeholder text, but the current hover style changes that placeholder to foreground text. This makes a non-value look temporarily populated and creates an unnecessary visual reaction in an input.

## What Changes

- Keep an empty date-picker placeholder in its ordinary muted color while the trigger is hovered.
- Preserve the existing appearance of populated date-picker values, focus states, and calendar interaction.
- Cover the shared trigger styling with a focused regression test and rendered Tasks verification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `form-control-interactions`: Require empty shared date-picker placeholders to retain their resting color on hover.

## Impact

- Shared component: `src/components/ui/date-picker-field.tsx`
- Shared component tests: `src/components/ui/date-picker-field.test.tsx`
- Consumers: Every BathOS surface that uses `DatePickerField`, including Tasks Start and Deadline controls
- No database, API, synchronization, or dependency changes
