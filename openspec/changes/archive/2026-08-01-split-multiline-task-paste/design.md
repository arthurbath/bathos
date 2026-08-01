## Context

Tasks already captures operating-system Paste events outside editable controls and distinguishes its versioned task-object envelope from ordinary text. Checklist inputs already model Return as a line split across adjacent item inputs, but browser paste remains native and therefore cannot represent pasted line breaks in a single-line input.

The implementation must preserve structured task Copy/Cut/Paste, native paste in Notes, Summary, URLs, and other ordinary editable controls, and the checklist's textarea-like caret behavior.

## Goals / Non-Goals

**Goals:**

- Normalize LF, CRLF, and bare CR clipboard line endings.
- Turn each nonempty ordinary-text line into one new task in source order.
- Turn multiline checklist paste into adjacent checklist items at the active selection and caret.
- Copy and cut selected checklist items through a strict versioned checklist clipboard envelope.
- Paste copied checklist items after a focused persisted item or at a focused draft row's insertion position while preserving source order and completion state.
- Match the task-level clipboard toast vocabulary and failure treatment for Copy and Cut while leaving successful Paste silent.
- Preserve native single-line paste and structured task-envelope reconstruction.
- Give batch checklist insertion deterministic order keys before optimistic state rerenders.

**Non-Goals:**

- Parsing bullets, numbering, indentation, HTML structure, Markdown, or task metadata from clipboard content.
- Changing paste behavior in Notes, Summary, Primary Link, or unrelated BathOS inputs.
- Adding a database migration, a new clipboard MIME type, or a native-only clipboard bridge.

## Decisions

### Split only ordinary task text after envelope parsing

The existing strict task-envelope parser remains authoritative. Only its ordinary-text result is normalized into trimmed, nonempty lines. This prevents formatted JSON payloads from being mistaken for multiple plain tasks and retains existing malformed-envelope rejection.

An alternative was to split the raw clipboard text before parsing. That would break pretty-printed structured payloads and is rejected.

### Treat checklist paste as one multiline text replacement

Checklist paste uses the active input value, selection start, and selection end exactly as a textarea would: the prefix joins the first pasted line, the suffix joins the final pasted line, and every intervening line becomes an adjacent item. The caret lands after the pasted text in the final affected row. Single-line paste remains browser-native.

An alternative was to append every pasted line after the current item. That loses insertion-point and selected-text semantics and is rejected.

### Add ordered batch checklist creation

The checklist hook will expose an ordered multi-item creation operation that computes each subsequent order key against a local working list. Repeatedly calling the existing single-item callback before React rerenders could reuse stale neighbors and produce tied or reversed order.

Blank checklist lines remain transient empty draft rows only where the existing editor can represent them. Persisted checklist items continue to require nonempty text and empty rows retain the existing close-time cleanup policy.

### Use plain text from rich clipboard content

Browser and native web-view paste events expose a `text/plain` representation for rich clipboard content. Tasks consumes that plain-text representation and does not import rich formatting or HTML.

### Give checklist items their own strict clipboard envelope

Selected checklist items serialize to a versioned `garden.bath.tasks.checklist.clipboard` envelope containing only the operation, item text, completion state, and source order. The payload deliberately excludes task identifiers, owner identifiers, database identifiers, and order keys so the pasted rows become ordinary children of the destination task.

An alternative was to reuse the task envelope or serialize only newline-delimited text. Reusing the task envelope would confuse list-level task reconstruction, while plain text would lose completion state and make malformed internal payloads indistinguishable from user text.

PowerSync may expose SQLite boolean columns as numeric `0` or `1` values at the runtime boundary. Checklist Copy and Cut normalize those two legal storage representations to JSON booleans before the strict envelope validator runs. Other completion values remain invalid.

### Let the focused checklist row define the structured insertion boundary

A structured checklist paste after a persisted checklist input inserts the copied rows immediately after that item. A structured paste into the transient draft inserts the rows at the draft's current list position and shifts the draft below them. When that draft already contains text, moving focus to the final pasted item commits the draft through its existing blur behavior, leaving its newly persisted row immediately after the pasted group. This makes middle insertion predictable without rewriting the destination row's text and preserves the existing multiline text replacement behavior as a separate interaction.

### Keep task and checklist clipboard ownership distinct

When checklist selection is active, the checklist editor owns Copy and Cut before the Tasks shell can interpret the same command as task-level clipboard work. Paste remains owned by the focused checklist input through its existing editable-control event path. Copy leaves checklist selection intact, while successful Cut deletes the source rows and clears their selection.

### Preserve task-level clipboard feedback conventions

Checklist-item Copy and Cut use count-bearing success toasts after clipboard write succeeds. Successful task and checklist Paste use the created items themselves as confirmation and do not show a redundant toast. Paste failures use destructive toasts, and Cut failures do not report success or delete source rows before clipboard write succeeds.

## Risks / Trade-offs

- [Whitespace-only task lines could create meaningless tasks] -> Trim each line and omit empty results while retaining source order.
- [Checklist persistence could partially fail during a batch] -> Update the existing item first only after insertion planning and surface failures through the existing task error boundary. Keep mutations ordered and covered by focused component and hook tests.
- [Browser event simulation does not reproduce every native context menu] -> Use the same Paste event path for keyboard and menu actions, add event-level tests, and run rendered browser validation where possible.
- [Task-level and checklist-level Copy or Cut could both handle one event] -> Mark active checklist selection in the rendered editor, make the shell yield clipboard ownership, and stop propagation after the checklist handler accepts the event.
- [Completed pasted rows could reorder unexpectedly] -> Create pasted rows with planned order keys and apply their completion state without invoking the user-completion behavior that moves a newly completed row to the bottom.
