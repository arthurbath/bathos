## Why

Today horizons currently rely on icon shape alone and use inconsistent coloring across task rows and the Start picker, which slows recognition of Inbox, Now, Next, and Later. Generic Tasks bucket headings in Anytime, Someday, and Done repeat the view context without organizing or distinguishing the content below them.

## What Changes

- Give each Today horizon one consistent semantic color across Today headings, horizon markers in task rows, and Start-picker choices: blue Inbox, yellow Now, red-orange Next, and reddish-purple Later.
- Remove the generic Tasks bucket heading from Anytime, Someday, and Done while retaining accessible list structure and meaningful headings such as Today horizons, Upcoming dates, and Done's Deleted grouping.
- Add regression coverage for the shared horizon presentation and the flattened ungrouped list views.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define consistent semantic horizon colors and remove redundant generic Tasks bucket headings from ungrouped primary lists.

## Impact

- Tasks module presentation helpers, Today headings, task-row horizon markers, Start-picker controls, and primary list rendering.
- BathOS semantic color tokens in `src/index.css` and `tailwind.config.ts`.
- Tasks component tests and the durable personal Tasks specification.
- No database, Supabase, synchronization, routing, or dependency changes.
