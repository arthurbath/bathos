## Why

The expanded task editor repeats field names above controls that already communicate their purpose, consuming space without adding clarity. Tasks also needs one canonical user-facing vocabulary for its primary text field and its immediately executable actionability state.

## What Changes

- Canonize Summary as the user-facing name of the task text field stored internally as `title`.
- Add a Summary placeholder and remove visible field labels from the expanded metadata editor while preserving accessible names.
- Use field-identifying placeholder copy where an empty control needs it.
- Hide the Primary Link activation control while Primary Link is empty and reveal it as soon as any value is present.
- Rename the user-facing Actionable state to Ready across task editors, menus, search, quick filters, project task controls, validation copy, and durable specifications.
- Preserve the internal `title` field, `actionable` enum value, persistence contracts, and API schemas.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Simplify expanded-editor field presentation and standardize Summary and Ready terminology.

## Impact

- Tasks module editor, task command surfaces, quick-filter labels, project task controls, and user-facing validation copy.
- Tasks component and domain tests.
- Active Tasks changes that currently define the superseded Actionable label.
- No database migration, API contract, dependency, routing, or cross-module changes.
