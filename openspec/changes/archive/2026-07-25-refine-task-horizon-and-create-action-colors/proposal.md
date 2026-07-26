## Why

The new horizon colors improve scanning, but Inbox should use BathOS green rather than blue. The filled green floating create action also draws more attention than its supporting role warrants.

## What Changes

- Change the shared Inbox horizon color from blue to green everywhere horizon symbols appear.
- Keep the existing yellow Now, red-orange Next, and reddish-purple Later identities unchanged.
- Restyle the floating New Task action as a green outline control with a dark background and green plus.
- Preserve the floating action's size, location, accessibility name, and creation behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the Inbox horizon identity and the visual treatment of the floating task-creation action.

## Impact

- Tasks module presentation tokens and the floating New Task button.
- Tasks component tests and rendered desktop/mobile QA.
- No database, API, dependency, routing, or cross-module changes.
