## Context

Tasks spans one React module plus installed iOS and macOS shells. The web editor currently renders the Summary input where the open row's summary content used to provide a safe task drag source, selection entry shares state with lightweight keyboard focus, app-level history can take long enough to appear unresponsive, and the macOS quick-entry panel loads a full web route before presenting its editor. Shared form primitives also use a mixture of bright border treatments that weaken focus contrast.

The implementation must preserve task autosave and offline synchronization, DataGrid's specialized editing contract, ordinary task-list drag semantics, and the existing native bridge message versioning.

## Goals / Non-Goals

**Goals:**

- Restore a stable summary-row drag handle without removing Summary editing from the metadata drawer.
- Make modified-click selection entry deterministic and independent from prior lightweight/open task state.
- Establish one theme-token-driven ordinary input outline convention with a stronger focus treatment.
- Acknowledge undo and redo synchronously while their asynchronous history traversal runs.
- Support iOS landscape and remove mobile navigation from the keyboard-constrained viewport.
- Make macOS quick entry compact, stable, cancellable, and explicitly committed.

**Non-Goals:**

- Change task history semantics, database schema, or synchronization topology.
- Make DataGrid cells use persistent borders.
- Redesign the Start or Deadline pickers.
- Publish, notarize, or install native builds without a separate release request.

## Decisions

1. **Keep summary display and Summary input as separate surfaces.** The open row retains its rendered title and drag handle; the expanded drawer retains the editable Summary input. This avoids making an input draggable and preserves precise text editing.
2. **Treat modified-click entry as a fresh selection context.** When selection mode is inactive, Command-click or Shift-click first flushes and closes any open editor, clears lightweight focus, then selects only the clicked task. Shift range expansion begins only after selection mode already has an anchor. Control+B remains the explicit current-task entry.
3. **Use a semantic CSS token for ordinary borders.** Shared non-grid form primitives consume one muted solid `--input`-family border value; focus rings remain brighter. DataGrid cells continue opting into their existing borderless-until-focused contract rather than inheriting the ordinary surface rule.
4. **Use one operation-owned history veil.** Undo and redo set a transient busy state before awaiting history traversal and clear it in `finally`. A centered spinner overlay blocks duplicate input while preserving the existing boundary/error toasts.
5. **Detect the software keyboard through the visual viewport, not orientation.** Mobile navigation hides when the visual viewport height contracts materially relative to the layout viewport while a text-editable control is focused. This works in both installed native/PWA contexts and does not hide navigation merely because the phone is landscape.
6. **Allow all standard interface orientations on iPhone.** The iOS target removes its portrait-only restriction while retaining the native safe-area behavior.
7. **Keep quick-entry draft ownership in the web editor, but make commit explicit.** The quick-entry route may persist a draft to support checklist/autosave behavior, but native dismissal sends cancellation and the web editor deletes/discards the draft before reporting completion. Save, Return, or Command+Return reports committed completion. The global shortcut toggles the existing panel closed through the same cancellation path.
8. **Stabilize the native panel before revealing web content.** The native shell presents a centered progress indicator until the web route reports readiness, uses a fixed compact content size derived from the largest picker, and avoids resizing/replacing the visible content after presentation.

## Risks / Trade-offs

- **[Visual viewport signals vary by browser]** -> Require editable focus plus a meaningful height delta and cover the helper with unit tests.
- **[Closing an editor before modified-click selection can race autosave]** -> Reuse the existing flush-and-close path before mutating selection state.
- **[Quick-entry cancellation after draft persistence could briefly sync a draft]** -> Reuse recoverable task deletion/discard semantics and wait for cancellation before closing the panel when possible.
- **[A blocking undo veil can feel heavy for fast history operations]** -> Mount it immediately but let it disappear as soon as the promise settles; do not impose a minimum duration.
- **[Global input-token changes can expose component-specific assumptions]** -> Inventory shared primitives, add explicit DataGrid exclusions, and run the full suite plus representative rendered QA.

## Migration Plan

No data migration is required. Deploy the web change before or with native rebuilds so the quick-entry bridge understands the refined completion states. Rollback is source-only: restore the prior CSS token, selection handler, and native panel/orientation settings.

## Open Questions

None. The user has explicitly selected the interaction and dismissal semantics.
