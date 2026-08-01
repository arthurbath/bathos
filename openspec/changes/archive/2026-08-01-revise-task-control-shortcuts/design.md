## Context

Tasks centralizes platform-aware keyboard parsing in `taskKeyboardCommands.ts`, while `TasksShell` owns the stateful behaviors that those commands invoke. Selection mode already has established entry paths for pointer, touch, and empty-mode activation, but it lacks a task-targeted keyboard entry. The revised layout also puts Set Reminder on Control+Y, which must coexist with the application-level Redo contract.

## Goals / Non-Goals

**Goals:**

- Make the executable Mac Control layout match the supplied keyboard map.
- Preserve Windows task-command parity through Alt+Shift plus the same letter.
- Enter selection mode with exactly the currently open or keyboard-focused task selected.
- Keep Command+Y as Redo on Mac and Control+Y as Redo on Windows.
- Keep the Keyboard Commands dialog synchronized with executable behavior.

**Non-Goals:**

- Change task-selection membership rules after selection mode has started.
- Add a selection command on Config, Search, or Area-detail surfaces.
- Change reminder persistence, Start behavior, Undo/Redo storage, or native shell commands.
- Add database, PowerSync, Supabase, or migration work.

## Decisions

### Keep command resolution platform-aware and centralized

The task command table will map R to Clear Start, T to Cycle Horizon, Y to Focus Reminder, and B to a new Start Selection command. The parser will continue resolving the task-specific modifier before the application modifier. On Mac this makes Control+Y a Tasks-specific Reminder command while Command+Y remains Redo. On Windows, Alt+Shift+Y becomes Reminder while Control+Y remains Redo.

This preserves the established split between task commands and application commands without special-casing Y inside the shell.

### Reuse the existing task-selection transition

`TasksShell` will add one targeted selection-entry callback modeled on touch-swipe entry. It will:

1. Require a selection-capable list and inactive selection mode.
2. Resolve the current target from the open task first, then the keyboard-focused task.
3. Reject the transient new-task draft and missing or ineligible targets.
4. Close and flush any open editor through `setOpenTask(null)`.
5. Clear DOM and lightweight focus.
6. Enter selection mode with exactly the target selected and anchored.

The command will do nothing when there is no eligible target or selection mode is already active. This keeps the command scoped to starting selection mode and avoids surprising membership changes.

### Keep help copy explicit

The Keyboard Commands dialog will show the new R, T, Y, and B assignments directly. Existing platform columns remain unchanged: Mac shows Control chords and Windows shows Alt+Shift chords.

## Risks / Trade-offs

- **Control+Y previously acted as a Mac Redo alias.** The durable contract already identifies Command+Y and Command+Shift+Z as Mac Redo chords, so using Control+Y for Reminder preserves a standard redo path while matching the requested map.
- **Closing an open task may require asynchronous autosave.** The selection transition waits for the existing close path before changing selection state, preventing lost edits or a split open-and-selected presentation.
- **A keyboard-focused task can become stale during projection.** Eligibility is resolved against the current selectable task collection before the state transition; unavailable targets produce no action.

## Migration Plan

No data migration or rollout ordering is required. Ship the parser, shell dispatch, help copy, tests, and durable spec together. Rollback is a code-only reversal of those mappings and the selection command.

## Open Questions

None.
