## Context

BathOS Tasks currently owns a broad set of Command-key shortcuts, including chords whose established browser or operating-system meanings are unrelated to the task action. The module also duplicates only a subset of editable task state and has no durable task-object clipboard. This change replaces that contract with a platform-aware map: standard application actions remain on Command on Mac and Control on Windows, while Tasks-specific actions move to Control on Mac and Control+Shift on Windows.

The work stays inside the Tasks module. It composes the existing task, hierarchy, reminder, recurrence, checklist, history, notification, routing, and local database boundaries. It does not add a database table, RPC, RLS policy, package, environment value, or cross-module import.

## Goals / Non-Goals

**Goals:**

- Make every intercepted shortcut deliberate, discoverable, platform-aware, and consistent with the approved reference.
- Preserve native browser and operating-system intent for Command chords that Tasks no longer owns.
- Add a versioned, durable clipboard representation that can reconstruct task content after navigation, refresh, browser restart, or transfer to another BathOS Tasks session.
- Make Copy, Cut, Paste, and Duplicate preserve supported user-authored task state while generating new identities and open lifecycle state.
- Apply explicit destination planning rules and preserve source order when inserting clipboard tasks at the top of a supported list or hierarchy.
- Coordinate editor mounting, expansion, focus, and scroll so opening has the same visual grace as closing.

**Non-Goals:**

- No new Find shortcut or redesign of the visible Search and Find surfaces.
- No direct Projects or Templates navigation shortcut.
- No database migration, new Supabase object, or new recurrence data model.
- No permanent deletion as part of Cut.
- No checklist editor added to the expanded task form. Control+B is reserved until that surface exists.
- No attempt to override operating-system shortcuts whose events never reach the browser.

## Decisions

### Use an explicit platform command table

The keyboard domain will parse exact chords into semantic commands. On Mac, approved standard actions use Command and Tasks-specific actions use Control. On Windows, those layers translate to Control and Control+Shift. The capture-phase route handler will suppress defaults only after a recognized command is both applicable and owned by Tasks.

Windows Control+Shift+Z cannot represent both Redo and Close Task. Control+Y will be the Windows Redo command, and Control+Shift+Z will close the task. Mac retains both Command+Shift+Z and Command+Y for Redo.

Alternatives considered:

- Continue intercepting Command chords for Tasks-specific actions. Rejected because it conflicts with established browser and macOS behavior.
- Make every command configurable now. Rejected because it would expand this replacement into a shortcut-preferences system before the new baseline is proven.

### Preserve editable-control ownership only for standard text commands

Command or Control Select All, Cut, Copy, and Paste remain native while a text-editable control owns the event. Outside editable controls, the Tasks selection or clipboard behavior applies. Documented Tasks-specific Control commands retain precedence inside the expanded task editor, as requested.

Undo and Redo remain app-history actions throughout the Tasks route, including inside editable task fields. This matches Tasks autosave and its authoritative cross-task history. Unsupported chords remain native.

### Use ClipboardEvent data with a versioned plain-JSON envelope

Copy, Cut, and Paste will use browser clipboard events when available so menu commands and keyboard commands share behavior. The payload will be written as plain text using a discriminated envelope with a fixed kind and version. Strict parsing will distinguish a BathOS task payload from arbitrary clipboard text. Arbitrary text creates one task whose Title is the exact clipboard text after rejecting an all-whitespace value.

The envelope will contain ordered task snapshots and only reconstructible user-authored fields. It will not contain owner IDs, row IDs, mutation IDs, history, source provenance, lifecycle receipts, or terminal state.

Alternatives considered:

- Keep task objects only in React memory. Rejected because the clipboard would not survive refresh or browser restart.
- Depend only on a custom clipboard MIME type. Rejected because support and persistence are inconsistent across browser and clipboard boundaries. Plain JSON remains inspectable and portable.

### Snapshot deep editable content without cloning identity

Task snapshots include Title, Notes, Primary Link, Start, Deadline, day horizon, actionability, area/project intent, active reminder intent, recurrence intent supported by the current template-backed recurrence model, and checklist content/order/completion.

Duplicate and Paste create fresh task, checklist, reminder, recurrence, mutation, and history identities. They normalize the result to present/open lifecycle and exclude typed source provenance. Copying from Done is allowed, but reconstructing the copy creates ordinary present work.

Because recurrence is template-backed today, a recurrence copy reuses the same immutable template revision while creating a new recurrence definition. This change does not invent project-targeted recurrence beyond what the existing service can represent.

### Make Cut clipboard-first and recoverably destructive

Cut first writes the complete payload successfully. Only then does it transition the selected present tasks through the existing recoverable delete path. A clipboard write failure leaves every source task untouched. Cut from Done is rejected because a terminal record cannot be removed through the open-task recoverable-delete contract.

Copy, Cut, Paste, Duplicate, and rejected Paste/Cut outcomes show concise toasts. The visible selection clears after a successful Cut and after a successful selection-owned Duplicate.

### Apply a destination matrix before reconstruction

Paste is accepted only in Today, Anytime, Someday, an area detail, or a project detail:

- Today creates Anytime tasks with Today Inbox horizon and no Start Date.
- Anytime creates unplanned Anytime tasks with no Start Date or Today horizon.
- Someday creates Someday tasks with no Start Date or Today horizon.
- Project detail assigns the destination project and its derived area.
- Area detail assigns the destination area without a project.

Upcoming, Done, Config, Projects index, Templates, Search, and unknown destinations reject Paste without mutation. Destination planning overrides clipboard planning. Metadata that is illegal after an override is normalized rather than silently creating an invalid task. In particular, reminder intent is omitted when the destination clears Start/Today planning or when a Today reminder time has already elapsed.

Tasks are inserted at the top while retaining payload order. Creation uses explicit order keys and creates from the final payload item backward when necessary so asynchronous writes cannot reverse the requested order.

### Preflight deep reconstruction boundaries

The client loads each source snapshot before Copy, Cut, Duplicate, or structured Paste. Operations that require connected reminder or recurrence services are preflighted before task creation. An unavailable required boundary rejects the operation rather than silently dropping user-authored data.

Checklist reconstruction uses the existing hierarchy repository. No production schema or Supabase configuration changes are required.

### Sequence opening motion after a committed collapsed frame

The editor row will mount in its collapsed state, commit one visual frame, expand, and then perform focus and minimal reveal scrolling. Closing retains the existing transition. Reduced-motion mode skips visible transition and smooth scrolling while preserving focus and reveal correctness.

## Risks / Trade-offs

- [Browser clipboard permissions differ by context] → Use clipboard events for user gestures, provide a concise failure toast, and never delete Cut sources until the write succeeds.
- [Plain JSON can be edited or malformed] → Require a fixed kind and version, validate every field, bound payload size/count, and treat nonmatching text as ordinary text rather than partially trusted task data.
- [Deep reconstruction can partially fail] → Preflight required services and perform compensating recoverable deletion of newly created roots if a later child write fails.
- [Reminder intent can become illegal under destination overrides] → Apply deterministic normalization and test each destination matrix row.
- [Current recurrence targeting cannot express every future hierarchy wish] → Preserve only states supported by the existing recurrence service and record that limitation without adding schema.
- [Control shortcuts can shadow classic macOS text-navigation chords] → This is an intentional Tasks-specific contract, documented in the visible reference.
- [Windows Control+Shift+Z collision] → Assign Redo to Control+Y and reserve Control+Shift+Z for Close Task.
- [Fast focus can hide the opening animation] → Delay focus/reveal until expansion has begun and cover reduced-motion separately.

## Migration Plan

1. Replace the shortcut parser and visible command reference in one web release so documentation and runtime never expose different maps.
2. Add clipboard serialization, validation, destination transformation, and deep-copy orchestration behind existing Tasks repositories.
3. Extend selection to support clipboard-capable Done rows without enabling terminal Cut or bulk planning.
4. Refine editor opening sequencing.
5. Run focused unit/component tests, full regression tests, lint, build, OpenSpec validation, and rendered desktop/mobile keyboard QA.

Rollback is a normal web-code rollback to the prior commit. Clipboard payloads from this version remain harmless plain text to an older client. No database or Supabase rollback is required.

## Open Questions

None. Control+B is deliberately reserved until the expanded-task checklist editor is designed.
