## Context

Tasks currently converges open-editor closure through shared orchestration that can restore whole-task focus after the drawer collapses. That restoration is correct for the Open/Close Task keyboard command, but it is also reached when a user clicks or taps the already open task's summary row. The close path therefore needs an explicit focus intent instead of inferring intent solely from the task that just closed.

## Goals / Non-Goals

**Goals:**

- Preserve the existing autosave, deferred-completion, projection, and close-animation behavior.
- Make pointer closure end with no lightweight whole-task target and no DOM focus on the closed row or one of its controls.
- Keep keyboard-command closure focused on the surviving closed row or its established same-position fallback.
- Apply the same interaction-origin rule to ordinary tasks and recurrence prototypes where they share summary-row activation.

**Non-Goals:**

- Changing how a task opens or where Summary focus lands.
- Changing focus behavior for completion, ellipsis menus, drag initiation, selection mode, or navigation between tasks.
- Changing persistence, synchronization, database schema, or task ordering.

## Decisions

### Carry explicit close-focus intent through the existing close orchestration

The summary-row pointer handler will request closure with a clear-focus intent, while keyboard commands will continue requesting row-focus restoration. This keeps focus policy at the interaction boundary and leaves the autosave-aware close transaction shared.

An alternative was to inspect `document.activeElement` after closure. That is rejected because browser focus can move during React updates and does not reliably describe whether the initiating action was pointer or keyboard.

### Clear both Tasks focus state and browser DOM focus for pointer closure

Pointer closure will clear the lightweight focused-task identifier, range anchor where applicable, and any row-owned active element. Clearing only the Tasks identifier could leave a native focus ring or make subsequent keystrokes target the row despite the visual state.

### Preserve existing keyboard fallback behavior

Keyboard closure will continue to restore the surviving task row or the existing same-position fallback if projection changes remove the task. This protects continuous keyboard navigation and avoids inventing a second fallback policy.

## Risks / Trade-offs

- **Risk:** A shared close callback could accidentally clear focus for keyboard commands. **Mitigation:** Make the interaction-origin intent explicit and cover pointer and keyboard paths in the same regression suite.
- **Risk:** Pointer closure could blur an unrelated control if focus moves during close. **Mitigation:** Only blur task-row-owned active elements and clear Tasks' lightweight focus state.
- **Risk:** Recurrence prototypes could use a distinct activation path. **Mitigation:** Trace both row types and add focused coverage when their handlers diverge.
