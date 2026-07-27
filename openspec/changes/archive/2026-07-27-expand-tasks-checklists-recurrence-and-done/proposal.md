## Why

BathOS Tasks already contains durable checklist, recurrence, history, and recoverable lifecycle foundations, but the daily interface does not expose them with the keyboard-first, direct-manipulation behavior expected of the module. This change completes those workflows while correcting shared form submission behavior to match established web expectations.

## What Changes

- Canonize updated Tasks iconography: dashed Someday task controls, contained completed-task checks, plain Plus add actions, and Star for Today.
- Add a directly editable task checklist to the expanded task drawer with keyboard entry and traversal, completion-to-bottom animation, drag reordering, close-time empty-item cleanup, and undoable checklist mutations.
- Add a Tasks-owned repeating-task editor for calendar and after-completion recurrences, including interval, weekday or monthly pattern, end condition, reminder inheritance, Deadline-relative Start offsets, preview, and Upcoming representation.
- Extend Upcoming with generated recurrence instances and a bottom section for after-completion definitions waiting on their prior instance.
- Add explicit task deletion from menus, keyboard focus, open tasks, and bulk selection while retaining recoverable trashed tasks in Done.
- Make completed, canceled, and trashed tasks fully openable, editable, selectable, and recoverable in Done, grouped by terminal-entry day without drag reordering.
- **BREAKING**: Make Return submit the nearest ordinary form from a single-line text-entry control by default while retaining Command+Return, preserving native multiline Return, and keeping composite triggers such as date pickers and dropdowns non-submitting.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Expand task checklist interaction, recurrence authoring and projection, terminal lifecycle behavior, Done grouping, deletion commands, and Tasks iconography.
- `form-control-interactions`: Reverse the opt-in ordinary-form Return policy so single-line text-entry controls submit by default while composite controls and textareas do not.

## Impact

- **Tasks UI**: expanded task drawer, list rows, Today, Someday, Upcoming, Done, actions menus, keyboard commands, drag-and-drop, animation, and responsive behavior.
- **Tasks domain and synchronization**: checklist repository and history integration, recurrence definition and occurrence projection, task terminal-state editing, undo and redo, PowerSync upload parsing, and portable schema behavior.
- **Supabase**: existing Tasks checklist and recurrence tables, recurrence RPCs and triggers, history snapshots, lifecycle validation, and generated TypeScript types. No new published table is expected.
- **Shared platform**: ordinary form command handling and its affected modal and in-page form tests throughout BathOS.
- **Documentation and validation**: durable OpenSpec deltas, Tasks icon registry and human guide, database assertions, application tests, production build, offline behavior, and rendered desktop and mobile acceptance.
