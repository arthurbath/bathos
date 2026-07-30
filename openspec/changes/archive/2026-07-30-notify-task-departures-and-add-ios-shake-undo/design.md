## Context

Tasks derives list eligibility with `taskIsVisible` and quick-filter eligibility with `taskMatchesQuickFilter`, but successful mutation methods currently report only the resulting task to the undo tracker. Consequently, individual interaction paths must remember to explain a disappearing task, and only the new-task close path currently does so. The iOS companion already hosts the authoritative Tasks web application in a `WKWebView`, while the web shell owns the single task-and-checklist undo command.

## Goals / Non-Goals

**Goals:**

- Detect departures from the same list and quick-filter rules that render Tasks.
- Cover single and bulk metadata mutations through one mutation-reporting seam.
- Delay an open task's departure notice until its retained editor closes.
- Route one foreground iOS shake to the existing web undo command.
- Preserve current neutral undo-boundary feedback and history safety.

**Non-Goals:**

- Create a native task history or duplicate task data in Swift.
- Add shake handling to macOS, browsers, or installed PWAs.
- Add database state, migrations, settings, haptics, or configurable shake behavior.
- Announce ordinary reordering or metadata changes that leave the task visible.

## Decisions

### Report successful before-and-after mutation pairs

`useTaskList` will report successful metadata mutation batches as before-and-after task pairs after repository acceptance. The shell will classify each pair against its current list and quick-filter context. This covers drawer autosave, keyboard shortcuts, action menus, drag metadata changes, and bulk edits without coupling the data hook to toast copy.

Alternative considered: add a toast after every interaction handler. Rejected because the existing handlers are numerous and would inevitably drift.

### Prefer list departure over filter exclusion

If the resulting task no longer belongs to the current list, the notice identifies the task's derived planning destination. Only a task that remains eligible for the list but stops matching the active quick filter is described as filtered out. A batch emits one summarized neutral toast rather than one toast per task.

### Defer retained-editor notices

When the changed task is the currently open, retained task, the shell stores the latest departure classification by task identifier. Returning the task to eligibility clears that pending notice. Closing the editor emits the final classification after autosave and the existing close animation, when the task actually leaves the rendered list.

### Bridge shake as an explicit native command

The iOS `WKWebView` subclass will recognize the completed shake motion and ask `TasksBrowserModel` to dispatch a versioned `bathos:tasks-native-command` event into the trusted Tasks page. The React shell listens for the `undo` command and calls the same `runTaskUndo` function used by keyboard undo. This keeps history ordering, checklist arbitration, projection waiting, error handling, and Nothing to Undo feedback authoritative in the web module.

Alternative considered: synthesize Command+Z JavaScript. Rejected because a typed native command is clearer and is not dependent on keyboard-platform detection or editable-control guards.

## Risks / Trade-offs

- [Risk] Repeated autosaves could repeat a departure toast. -> Mitigation: retain only the latest notice while an editor is open and summarize each accepted batch once.
- [Risk] A task can qualify for multiple planning lists. -> Mitigation: announce the canonical route produced by the established task planning-route policy only after it has left the current list.
- [Risk] UIKit shake-to-edit could compete with the task command. -> Mitigation: consume the completed shake in the Tasks web-view responder and dispatch exactly one app-level undo command.
- [Risk] Native JavaScript dispatch can occur before Tasks mounts. -> Mitigation: shake is meaningful only after the foreground web view is loaded; an absent listener is a harmless no-op and creates no native history divergence.
