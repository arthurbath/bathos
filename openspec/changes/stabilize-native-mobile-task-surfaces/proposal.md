## Why

The shared mobile navigation still sits too high and shifts vertically at the end of an iOS list, while the longest Tasks destination remains cramped. New-task creation also produces an invisible WebKit focus state, and an open task can visually merge with the floating navigation, making native and standalone use feel less stable than the surrounding application.

## What Changes

- Anchor the shared mobile navigation consistently to the installed viewport safe area so list scroll extent cannot move it.
- Reduce the navigation container's internal padding without widening it, giving equal-width destinations more usable room and reducing excess vertical bulk.
- Place native and standalone touch navigation only a few pixels above the iOS home-indicator safe area while preserving the ordinary mobile-web offset.
- Ensure new-task creation visibly focuses the Summary input and places the caret in it when WebKit opens the software keyboard.
- Darken the complete open-task surface, including its summary and metadata drawer, so it remains visually distinct beneath the lighter translucent mobile navigation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-visual-foundations`: Refine shared mobile-navigation padding and stable fixed placement.
- `installed-module-shell`: Refine native and standalone touch-device bottom-safe-area placement.
- `personal-tasks-module`: Require visible Summary-input focus for new tasks and one darker unified open-task surface.

## Impact

- Shared platform code: `src/platform/components/MobileBottomNav.tsx` and focused layout tests.
- Tasks module: new-task focus handoff, task-row/editor surface styling, and focused interaction tests.
- Blast radius: every module using the shared mobile navigation; open-task and creation changes remain scoped to Tasks.
- No Supabase, API, migration, or dependency changes.
