## Why

Numeric badges add visual noise to Tasks headings without helping the owner's workflow. Tasks views should identify their sections and groupings without reporting how many items each contains.

## What Changes

- Remove compact numeric badges from every Tasks list, section, grouping, search-results, project, area, and checklist heading.
- Remove the badge counts from the headings' programmatic accessibility output as well as their visible presentation.
- Preserve counts that are operationally meaningful outside headings, such as bulk-selection status and bounded search-result disclosure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Tasks list and grouping headings no longer present item-count badges or announce totals.

## Impact

- Affects the BathOS Tasks React components and their focused presentation tests.
- Removes the Tasks-only count-badge component once its remaining heading usages are gone.
- Does not affect task data, ordering, filtering, selection counts, APIs, Supabase, PowerSync, or other BathOS modules.
