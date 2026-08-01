## Why

Repeating task prototypes currently expose schedule editing without the ordinary task metadata surface, and their projection behavior is too restrictive for established selection and ordering interactions. The Apple companions also need a focused round of native-surface refinement: compact lock-screen rendering, portrait-only iPhone use, and a truly global Mac quick-entry workflow using the authoritative Tasks form.

## What Changes

- Make an Upcoming recurrence prototype openable and editable through the ordinary task drawer, excluding Start and Deadline, with a separate Edit Repeat action beneath its metadata.
- Preserve the prototype as the sole template authority for future instances. Existing or completed instances never write metadata or checklist state back into the prototype.
- Let prototypes participate in selection and group dragging while excluding unsupported bulk actions and leaving prototypes in their cadence date when a group moves between Upcoming dates.
- Trash and restore prototypes within the ordinary 30-day Done retention window while suspending occurrence generation for a trashed prototype.
- Remove recurrence-ending controls from the user interface while retaining dormant schema compatibility.
- Slightly strengthen the shared mobile-navigation border.
- Strip all contextual badges and markers from the iOS rectangular Lock Screen widget so every row contains only a checkbox and Summary, including recurrence prototypes.
- Add a macOS-native-only Settings control for recording a global quick-entry shortcut and a native overlay that hosts the authoritative web new-task editor from any macOS application.
- Lock the iPhone companion to portrait and declare portrait orientation for the Tasks PWA as a best-effort browser policy.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Recurrence prototype editing, selection, dragging, lifecycle, template authority, and recurrence-ending UI change.
- `tasks-macos-companion`: Configurable global shortcut and native quick-entry overlay using the Tasks web form.
- `tasks-ios-companion`: Minimal Lock Screen widget rows and portrait-only native presentation.
- `installed-module-shell`: Brighter mobile-navigation border and best-effort installed-web-app portrait declaration.

## Impact

The change affects the Tasks recurrence RPC/service layer, recurrence projections and task editor, selection and drag policy, Done recovery behavior, shared widget renderer, Tasks PWA manifest, iOS target orientation settings, the macOS WebKit bridge, native shortcut registration, native overlay window management, and focused database, React, Swift, and OpenSpec tests. No new PowerSync table or externally managed secret is required.
