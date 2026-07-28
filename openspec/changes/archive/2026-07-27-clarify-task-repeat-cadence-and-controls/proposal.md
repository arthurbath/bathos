## Why

BathOS Tasks currently hides monthly recurrence choices behind labels that infer a pattern from the selected date, which makes the saved cadence difficult to understand or predict. The repeat editor also uses native browser selects that do not match BathOS controls, and task rows do not disclose when Notes are present.

## What Changes

- Replace inferred monthly recurrence labels with explicit controls for a calendar date, the last calendar day, an ordinal weekday, or an ordinal weekday/weekend-day group.
- Keep recurrence preview and authoritative server evaluation aligned for every supported monthly pattern.
- Show the next three recurrence instances, including paired Start and Deadline dates when Deadline-based recurrence begins work early.
- Use the shared BathOS Select component for every dropdown in the repeat dialog.
- Establish a project-wide rule requiring shared BathOS Select controls for new ordinary dropdowns, with explicit exceptions only for documented specialized needs.
- Add the canonical Lucide `NotepadText` Notes indicator immediately before the checklist indicator in task-row metadata.
- Inventory remaining production native selects without replacing them outside the repeat dialog.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify explicit monthly recurrence configuration and preview behavior, and add Notes presence to the canonical task metadata row.
- `form-control-interactions`: Require new ordinary dropdowns to use the shared BathOS Select component rather than native or locally styled select controls.

## Impact

- Tasks recurrence types, preview domain logic, repeat dialog, metadata row, iconography, and tests.
- A forward-only Supabase migration extending the authoritative monthly recurrence evaluator.
- Shared form-control and human style documentation.
- No PowerSync table-set change and no replacement of legacy selects outside the repeat dialog.
