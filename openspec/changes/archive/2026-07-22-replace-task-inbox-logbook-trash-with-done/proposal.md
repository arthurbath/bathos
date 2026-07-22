## Why

BathOS Tasks currently inherits separate Inbox, Today, Logbook, and Trash concepts that do not match the intended personal GTD workflow. The module needs one active task pool, one focused Today projection, and one disposable terminal queue so capture, planning, completion, and deletion remain simple and coherent.

## What Changes

- **BREAKING** Remove Inbox as a task destination and route every newly created or externally sourced to-do into Anytime while marking it for Today triage in Later.
- **BREAKING** Replace the separate Today destination with a filtered projection of open, present Anytime to-dos marked for Now, Next, or Later.
- Show a compact Lucide marker on Anytime rows when a to-do also appears in Today, including its Now, Next, or Later placement.
- **BREAKING** Replace Logbook and Trash with one Done view containing completed, canceled, and deleted work.
- Allow terminal work to be restored or reopened from Done during its retention window.
- Permanently purge terminal to-dos and terminal hierarchy roots at the owner-local midnight that begins their 31st day in Done.
- Redirect retired Inbox, Logbook, and Trash routes to their current equivalents and remove obsolete navigation, shortcuts, capture defaults, view labels, and empty states.
- Migrate existing Inbox and Today records into the new Anytime and Today-section model without losing task content, provenance, reminders, or history.
- Update web, local-first storage, PowerSync projection behavior, MCP tools, Raycast contracts, Mail capture, templates, backup/restore validation, and documentation to use the new model.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Replace Inbox and the separate Today destination with an Anytime-backed Today projection, replace Logbook and Trash with Done, and add automatic owner-local terminal retention.
- `mcp-module-actions`: Align task reads, creation, mutation, planning, and terminal recovery with Today, Anytime, Someday, Upcoming, and Done.
- `platform-routing-compatibility`: Preserve safe redirects for retired Tasks routes while keeping canonical neutral and deep-link routes stable.

## Impact

- Tasks React views, navigation, keyboard commands, local queries, repository validation, optimistic projection, templates, search, hierarchy planning, and tests
- Supabase task constraints, indexes, export/restore validation, Mail-capture RPCs, lifecycle functions, owner-local purge function, and pg_cron job
- PowerSync schema and upload/download behavior through the existing task tables
- Tasks MCP tools and generated Edge Function bundle
- Raycast task capture wording and destination contracts
- Inbox Manager BathOS handoff assumptions and tests
- Human documentation, README module summary, evaluations, and OpenSpec specifications
