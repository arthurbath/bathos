## Context

Tasks already has one transient `bulkMode` state that drives circular row controls and the fixed selection toolbar, but every existing entry path selects at least one task. A new pointer-accessible header action must be able to enter that same mode with an empty selection without weakening the established rule that deselecting the final selected task exits the mode.

## Goals / Non-Goals

**Goals:**

- Expose selection mode from the top-right actions of every selection-capable task list.
- Let only this explicit entry path produce active selection mode with zero selected tasks.
- Keep the zero-selection toolbar truthful and prevent selection-dependent actions.
- Preserve automatic exit after the final selected task is deselected.
- Close an open task safely before entering the empty selection state.

**Non-Goals:**

- Adding a checklist-selection button.
- Extending task selection to Config, Templates, Search, or Area-detail surfaces.
- Changing modified-click, range-selection, or bulk mutation semantics.
- Adding database or synchronized preference state.

## Decisions

### Reuse the existing bulk mode with an empty selected-id set

The header action will close any open editor, clear lightweight task focus and the range anchor, set the selected-id set to empty, and activate the existing bulk mode. This avoids a parallel selection implementation and automatically reuses row controls, the fixed toolbar, Escape handling, outside-click dismissal, and view-change cleanup.

### Preserve empty mode only when it began empty

The visible-task reconciliation effect currently exits bulk mode whenever no selected ids remain visible. It will instead exit only when a previously nonempty selection reconciles to zero. The existing selection gesture normalizer will continue setting `bulkMode` false when the user explicitly deselects the final task, preserving the established automatic-exit behavior.

### Use the canonical Selection icon

The top-right action will use the existing Lucide `Circle` mapped to the canonical Tasks `Selection` concept, with the accessible label `Select Tasks`. It will appear only while bulk mode is inactive on Today, Upcoming, Anytime, Someday, and Done.

### Make zero-selection actions structurally safe

The toolbar already disables Select None and Plan Selected at zero. Select All will be adjusted to populate selection directly, including a one-task list, instead of promoting a lone task into lightweight keyboard focus.

## Risks / Trade-offs

- **Empty selection could be cleared immediately by list reconciliation.** Preserve it only when both the current and reconciled selections are empty.
- **A one-task list could exit selection when Select All is used.** Populate the bulk selected-id set directly for every list size.
- **An open task could remain expanded beneath the bulk toolbar.** Await the existing autosave-aware close path before entering selection mode.
