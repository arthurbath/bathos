## Why

The native Tasks companion has no Control Center entry point for fast capture, requiring the user to find and open the app before beginning a task. A dedicated control can shorten that path while keeping task creation inside the authoritative web module.

## What Changes

- Add one nonconfigurable Tasks control for Control Center, the Lock Screen controls gallery, and supported Action button surfaces.
- Represent the add-task action with the native square-plus symbol treatment used by Apple system controls.
- Open the native companion directly to a new task draft in the Today list's Inbox horizon.
- Extend the allowlisted native deep-link boundary and web task shell with one single-use Today Inbox creation signal.
- Preserve ordinary app launches, list and task deep links, authentication, offline behavior, and existing widgets.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-ios-companion`: Add an approved Control Center capture surface and a narrowly scoped native deep link that begins a Today Inbox task in the existing web editor.

## Impact

- **Tasks widget extension:** One WidgetKit `ControlWidget`, one shared App Intent, and widget-bundle registration on supported iOS versions.
- **Native routing:** One allowlisted new-task route mapped to the production Today page with a bounded single-use query signal.
- **Tasks web module:** Consume that signal once, open the existing creation draft at the top of Today Inbox, focus Summary, and remove the signal from the address.
- **Tests and documentation:** Native routing, widget registration, web signal parsing, task-creation behavior, and companion README coverage.
- **Backend and sync:** No database, Edge Function, PowerSync, credential, projection, or migration change.
