## Context

Tasks maps platform-specific gestures to semantic commands in `taskKeyboardCommands.ts`, then resolves the singular open or whole-task-focused to-do through the shared command-target path in `TasksShell.tsx`. Primary Link controls already normalize destinations through `taskPrimaryLink.ts`, including browser-tab behavior for web URLs and operating-system dispatch for supported application protocols.

## Goals / Non-Goals

**Goals:**

- Map Control+J on Mac and Alt+Shift+J on Windows to one semantic `open-link` command.
- Resolve only the singular open or whole-task-focused ordinary to-do already recognized by task commands.
- Activate the exact normalized destination used by the task's existing Primary Link control.
- Keep the Keyboard Shortcuts modal and automated coverage synchronized with the command.

**Non-Goals:**

- Do not disclose, create, focus, or edit the Primary Link field.
- Do not add bulk, search-results, recurrence-prototype, native quick-entry, or list-navigation behavior.
- Do not change Primary Link protocols, normalization, browser-tab policy, or persistence.

## Decisions

- The command registry will expose `open-link` rather than overloading `focus-link`, because Control+H remains the field-disclosure and editing command.
- The summary-row Primary Link control will expose its task identity to the command layer. The shell will activate that real anchor, so the shortcut necessarily inherits the same normalized href, application handoff, browser context, and future pointer-link changes.
- Missing, blank, or non-actionable links will produce no navigation or toast. This mirrors the absence or disabled state of the pointer control and avoids turning a navigation command into validation UI.

## Risks / Trade-offs

- [Risk] The command could drift from rendered link behavior. -> Mitigation: activate the rendered Primary Link anchor itself and assert that the correct task's control receives the click.
- [Risk] A keyboard chord could run while bulk selection or search owns the surface. -> Mitigation: retain the shell's existing target and view guards, requiring exactly one ordinary task target.
