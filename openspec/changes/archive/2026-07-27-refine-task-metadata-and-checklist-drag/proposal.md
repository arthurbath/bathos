## Why

Checklist-item drags currently leak into the enclosing task-list drag system, and several task planning and metadata surfaces no longer match the intended keyboard and information hierarchy. These refinements keep nested drag scopes honest while making bulk planning, collapsed summaries, and the metadata drawer consistent and predictable.

## What Changes

- Isolate checklist-item drag gestures from task-list placement indicators while preserving last-valid checklist drop finalization elsewhere in BathOS.
- Normalize mixed bulk horizon targets to Now before advancing a uniform selection through Next, Later, and Now.
- Reorder and restyle collapsed task metadata, including an Anytime-only second-line horizon icon and icon-only purple non-ready actionability states.
- Put Area before Actionability in the metadata drawer.
- Replace an absent Primary Link input with an Add Primary Link action that reveals and focuses the URL field, and place Primary Link before Checklist.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refines nested drag isolation, bulk horizon cycling, collapsed metadata presentation, and task metadata editing.

## Impact

- Tasks module React components and focused component/domain tests.
- The durable `personal-tasks-module` specification.
- No database schema, Supabase deployment, PowerSync topology, or external API changes.
