## Context

Tasks now assigns work directly to optional Areas. The task editor still labels the Area choices as a grouped organization list, Control+V still opens a selector, and Config uses a one-off inline Areas editor. Quick Find is already globally available through printable typing, so its persistent magnifying-glass button is redundant.

## Goals / Non-Goals

**Goals:**

- Make Area selection disappear cleanly when Areas do not exist.
- Make one keyboard command cycle Area values for one or many task targets.
- Use the shared card DataGrid for Area naming and row actions.
- Preserve Quick Find through type-to-search without visible search chrome.

**Non-Goals:**

- Change Area storage, deletion semantics, task history, or list bucketing.
- Add a new bulk mutation API or database migration.
- Remove the complete `/tasks/search` continuation route.
- Change shared DataGrid behavior for other modules.

## Decisions

### Use one ordered Area cycle

The cycle is `No Area`, followed by Areas in their configured order. A single target advances from its current value, wrapping to No Area. Multiple targets with different values converge to No Area on the first invocation. Once all targets share a value, the next invocation advances them together.

This mirrors the existing actionability convergence rule while retaining No Area as the neutral state. Opening the Area popover was rejected because it does not support rapid repeated keyboard changes or deterministic bulk behavior.

### Render Area editing with the shared DataGrid

The Areas card will use one editable Name column and the fixed 40px actions column. The actions menu conditionally exposes Move Up, Move Down, and Delete. Existing add and recoverable-delete dialogs remain intact. A dedicated persisted grid-width key keeps the shared DataGrid contract without borrowing another module's preference namespace.

The prior bespoke title and ordering controls were rejected because they duplicate established keyboard, focus, resizing, and visual behavior.

### Remove only visible Quick Find triggers

Tasks will keep the Quick Find dialog, global printable-key listener, and full results route. Only the header button is removed. This preserves the intended typing-only entry point and avoids changing search semantics.

## Risks / Trade-offs

- [Risk] Area updates are currently applied per target and a partial network failure could leave a bulk selection mixed. -> Reuse the existing task update and error path, keep the selection available for retry, and cover target calculation with unit and integration tests.
- [Risk] A DataGrid with only one data column can expose unnecessary resizing complexity. -> Retain standard 20px resizing and persisted widths because that is the BathOS-wide grid contract, while fixing the actions column at 40px.
- [Risk] Removing the search icon reduces discoverability. -> Preserve the Config keyboard-help breadcrumb and the keyboard reference while making type-to-search work on every eligible Tasks route.

## Migration Plan

This is a client-only release. Existing Areas, task assignments, and user settings remain valid. Rollback consists of reverting the web release; no data rollback is required.

## Open Questions

None.
