## Context

BathOS DataGrid text-entry cells intentionally distinguish keyboard focus from editing. A focused cell behaves like a spreadsheet cell, while an editing cell behaves like a native text input. Printable keys already replace the focused value and begin editing, but paste currently has no corresponding focused-cell behavior.

The shared DataGrid exposes several text-like cell primitives with separate commit implementations: `GridEditableCell` (including text, long text, number, email, password, and time), `GridUrlCell`, `GridCurrencyCell`, and `GridPercentCell`. Each implementation already owns normalization, validation, optimistic display, undo history, async rollback, and focus restoration.

## Goals / Non-Goals

**Goals:**

- Make platform paste replace the complete value of a focused, non-editing text-entry cell.
- Commit the replacement immediately through each cell's existing commit path.
- Retain keyboard focus on the cell without entering editing mode.
- Preserve native paste behavior inside an actively edited field.
- Apply the behavior consistently across all shared text-like DataGrid cells.

**Non-Goals:**

- Parsing tabular clipboard data into multiple cells.
- Changing paste behavior for checkboxes, selects, dates, menus, or other non-text controls.
- Bypassing existing type-specific normalization, validation, permissions, or async save behavior.

## Decisions

### Handle the browser paste event on shared text-entry inputs

Each shared text-like input will handle React's `onPaste` event. When the cell is focused but not editing and is enabled, the handler will prevent the browser's default insertion, read `text/plain` from the event clipboard payload, and pass that complete string to the cell's existing commit function.

This is preferred to a global keyboard shortcut handler because it:

- works with both Command+V and Control+V without platform branching;
- also respects other platform mechanisms that emit a paste event;
- avoids requesting asynchronous Clipboard API permission;
- naturally scopes the action to the focused cell; and
- leaves active text editing under native input behavior.

### Reuse existing commit paths

Paste will not introduce a separate persistence path. `GridEditableCell`, `GridUrlCell`, `GridCurrencyCell`, and `GridPercentCell` will each pass pasted text to their existing commit function. Existing normalization, validation, optimistic display, undo registration, save callbacks, rollback, and error behavior therefore remain authoritative.

After initiating the commit, the shared handler restores focus to the start of the input while leaving the cell non-editing. If validation rejects the pasted value, the cell retains or restores its prior value according to its existing contract.

### Preserve native editing paste

When `data-grid-editing` is true, the paste handler will return without preventing default behavior. The browser may insert clipboard text at the caret or replace the current text selection, and the existing `onChange` and later commit flow will handle the edited value.

### Treat clipboard content as one cell value

The complete `text/plain` clipboard payload, including any embedded tabs or line breaks, is offered to the focused cell as a single replacement value. Individual cell types remain responsible for accepting, normalizing, or rejecting that value. Multi-cell spreadsheet import is deliberately outside this change.

## Risks / Trade-offs

- A pasted value can be invalid for URL or numeric cells. Existing validation and normalization remain visible and authoritative rather than adding paste-specific rules.
- Async persistence can fail after the cell changes optimistically. The existing rollback and history-invalidation behavior handles this case.
- Clipboard payloads may contain multiline or tabular text. Treating the payload as one value is predictable and avoids silently mutating adjacent cells.

## Migration Plan

No data migration or rollout sequencing is required. The behavior is entirely within the shared frontend component and is inherited by every DataGrid using the affected primitives.

## Open Questions

None.
