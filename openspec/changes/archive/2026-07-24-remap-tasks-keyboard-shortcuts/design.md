## Context

Tasks currently resolves every module shortcut through one platform-aware gesture function and dispatches the resulting semantic command from a capture-phase listener. The existing map mixes view navigation with metadata controls across much of the keyboard. The revised graphics establish a replacement map, not additive aliases.

## Goals / Non-Goals

**Goals:**

- Make the graphic-defined Mac map authoritative.
- Derive Windows commands consistently: Command becomes Control, while Mac Control becomes Control+Shift.
- Keep command dispatch semantic so remapping does not duplicate task behavior.
- Add direct Clear Start and Move to Someday actions with the same autosave, reminder, selection, and optimistic-projection behavior as other planning commands.
- Keep the visible keyboard reference, accessibility metadata, tests, and human guidance synchronized.

**Non-Goals:**

- Add task-list checklist editing where that editor does not yet exist.
- Add or change Find shortcuts.
- Change pointer selection, database schema, MCP behavior, or native-app shortcuts.
- Retain superseded keyboard aliases that are absent from the new graphics.

## Decisions

### Treat the graphics as a replacement map

Only the revised chords remain documented and claimed. In particular, view navigation moves from Mac Control letters and Windows Control+Shift letters to Command/Control plus 1 through 6. Redo is Command/Control+Y, and keyboard help remains available through its visible button rather than an undocumented legacy chord.

### Keep one cross-platform resolver

The resolver continues returning semantic commands. Mac Command and Windows Control share the application-command map. Mac Control and Windows Control+Shift share the Tasks-specific map. This prevents platform handlers from drifting.

### Reuse ordinary planning mutations

Clear Start moves eligible work to unplanned Anytime and cancels Start-dependent reminders. Set Start to Someday moves eligible work to Someday and likewise cancels Start-dependent reminders. Both commands operate on the current multi-selection when present and otherwise the open task, including the local creation draft.

### Preserve deferred checklist behavior

Control+C on Mac and Control+Shift+C on Windows replace the old checklist chord. Until checklist editing exists in the expanded list editor, the command remains a deliberate no-op and the reference says “Edit Checklist” without status wording.

## Risks / Trade-offs

- [Browser-reserved number shortcuts may be difficult to intercept in every browser] → Use the existing capture-phase prevention when the event reaches Tasks and avoid claiming control when the operating system consumes it first.
- [Users may remember superseded aliases] → Remove old aliases from the resolver and show the full current map in one reference.
- [Planning commands can remove tasks from the current view] → Reuse optimistic list reconciliation, close/focus fallback, and reminder cleanup paths already used by planning surfaces.
