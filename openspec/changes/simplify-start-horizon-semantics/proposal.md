## Why

Tasks currently treats a day horizon as future-planning metadata, even though Inbox, Now, Next, and Later describe only work available Today. That mismatch makes Control+R appear stale and lets future Start values carry an inapplicable horizon.

## What Changes

- **BREAKING** Make future Start and Today horizon mutually exclusive for to-dos and projects: future work stores a Start with no horizon, while Today work stores a horizon with no future Start.
- Make a reached future Start activate into Today Next rather than preserving a horizon selected before the work became available.
- Make Control+R move every eligible target to Today and immediately cycle its Today horizon, including open-editor and row-summary presentation.
- Make specialized Mail capture enter Today Inbox while preserving Today Next as the ordinary active-capture and reached-Start default.
- Reconcile the open editor's Start state when keyboard or synchronized task mutations change accepted planning fields.
- Replace user-facing `Task's Start` wording with `Start` throughout Tasks controls, commands, guidance, errors, and supported API copy.
- Normalize existing future-start roots by clearing their stored horizons through a reviewed production migration.
- Preserve an immediate undo or redo command across bounded task/history projection lag by associating it with the exact accepted local mutation rather than discarding it or skipping to older history.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Redefine Start and Today horizon exclusivity, reached-date activation, Control+R behavior, immediate editor presentation, and user-facing terminology.
- `mcp-module-actions`: Require MCP task and project planning mutations, generation, export, and restore to follow the same future-Start versus Today-horizon invariant, with specialized Mail capture entering Today Inbox.

## Impact

This affects the Tasks shell and editor, task and hierarchy repositories, planning-domain helpers, templates, recurrence, export and restore normalization, MCP validation and responses, reminder rebinding, database constraints and triggers, reached-Start cron behavior, production data normalization, tests, and human-facing Tasks guidance. The PowerSync table set remains unchanged, but the synchronized values and matching MCP Edge Function require coordinated release and production acceptance.
