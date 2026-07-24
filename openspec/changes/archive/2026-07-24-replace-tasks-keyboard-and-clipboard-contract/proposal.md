## Why

Tasks currently overrides browser and operating-system Command shortcuts for unrelated planning actions, making its keyboard-first behavior unpredictable and hostile to standard platform intent. The module needs one deliberate macOS Command map for standard actions, one macOS Control map for Tasks-specific actions, translated Windows bindings, and a durable structured clipboard so task operations survive navigation and browser restarts.

## What Changes

- **BREAKING** Replace every existing Tasks keyboard binding with the approved macOS Command and Control maps plus their Windows translations.
- Preserve browser Find and the removed Projects and Templates navigation bindings, while retaining task-level undo, redo, selection, duplication, clipboard, help, form-close, and direct Tasks commands.
- Add versioned JSON task clipboard payloads for Copy, Cut, and Paste, including user-authored task data, reminders, recurrence intent, and checklist content where the existing model supports them.
- Apply destination-aware paste rules for Today, Anytime, Someday, project, and area views, and reject paste in Upcoming, Done, Config, and other unsupported destinations.
- Make duplicate and copied tasks reproduce user-authored metadata without reusing immutable identity, provenance, history, or terminal state.
- Make Cut write a recoverable clipboard payload before removing selected open tasks and report Copy, Cut, Paste, Duplicate, and rejected-paste outcomes with brief notifications.
- Coordinate task-editor expansion, focus, and scroll so opening is as graceful as closing while preserving reduced-motion behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Replace the keyboard-first operation contract, add durable task clipboard behavior, deepen duplication, extend selection-owned actions, and refine editor-opening motion.

## Impact

- Tasks keyboard parsing, command help, capture-phase dispatch, selection behavior, task rows, and expanded-editor motion.
- Tasks clipboard payload parsing and destination planning logic.
- Existing task, hierarchy, reminder, recurrence, and checklist repositories and hooks; no database migration or new Supabase object is expected.
- Focused domain/component tests, full regression validation, and rendered macOS/browser QA.
