## ADDED Requirements

### Requirement: Multiline Task And Checklist Paste
Tasks SHALL interpret normalized plain-text clipboard lines as ordered task or checklist-item boundaries when the corresponding Tasks surface owns Paste, while preserving structured task payloads and native single-line text editing.

#### Scenario: Paste multiline text into a task list
- **WHEN** Paste in a supported task-list destination receives ordinary plain text or the plain-text representation of rich text containing LF, CRLF, or bare CR line boundaries
- **THEN** Tasks creates one open task per nonempty trimmed line in source order at the destination's normal paste position and applies the destination's planning and organization rules to every created task

#### Scenario: Ignore empty task lines
- **WHEN** ordinary multiline task clipboard text contains blank or whitespace-only lines
- **THEN** Tasks creates no task for those lines and preserves the relative source order of every nonempty line

#### Scenario: Preserve structured and single-line task paste
- **WHEN** Paste receives a valid supported task envelope or ordinary text with no line boundary
- **THEN** Tasks retains the existing structured reconstruction or single-task plain-text behavior respectively

#### Scenario: Confirm task paste through created rows
- **WHEN** task Paste succeeds
- **THEN** Tasks renders the created task rows without showing a redundant success toast

#### Scenario: Paste multiline text into a checklist item
- **WHEN** a user pastes plain text or the plain-text representation of rich text containing line boundaries into a persisted or draft checklist-item input
- **THEN** Tasks replaces the active selection as one multiline insertion, keeps the current prefix on the first affected item, places each subsequent line in an adjacent item, appends the current suffix to the final affected item, preserves source order, and keeps the task editor open

#### Scenario: Focus the final checklist paste line
- **WHEN** multiline checklist paste completes
- **THEN** Tasks focuses the final affected checklist input and places the caret immediately after the pasted text and before any suffix retained from the original item

#### Scenario: Preserve native paste in other editable controls
- **WHEN** an editable control other than a checklist item owns Paste
- **THEN** Tasks leaves the control's existing native or specialized paste behavior unchanged and does not create task objects from its clipboard text

#### Scenario: Commit checklist drafts while creating a task
- **WHEN** a user adds a checklist while creating a task, enters a nonempty checklist item, and presses Return
- **THEN** Tasks persists that checklist item, inserts and focuses a following draft item, and retains the saved checklist after the task editor closes

#### Scenario: Flush the final checklist draft when closing
- **WHEN** a task editor closes while its checklist contains a nonempty transient draft
- **THEN** Tasks waits for that draft to persist before unmounting the editor and does not lose the checklist item

#### Scenario: Persist checklist completion locally
- **WHEN** a user checks or reopens a persisted checklist item
- **THEN** Tasks writes the completion state, completion timestamp, revision, and undo-operation metadata to the local PowerSync database and retains that state across rerender and application restart

#### Scenario: Upload checklist completion operation metadata
- **WHEN** PowerSync uploads a persisted checklist completion or reopening mutation
- **THEN** Tasks accepts the mutation's undo-operation identifier as checklist metadata and applies the mutation remotely instead of rejecting and reverting it

### Requirement: Checklist Item Clipboard Transfer
Tasks SHALL let users copy, cut, and paste selected checklist items between task checklists through a strict versioned clipboard payload while preserving item order, text, and completion state.

#### Scenario: Copy selected checklist items
- **WHEN** one or more checklist items are selected and the user invokes Copy
- **THEN** Tasks writes the selected items in visible order to the checklist clipboard payload, preserves their text and completion state, leaves the source items and selection unchanged, and shows a count-bearing success toast

#### Scenario: Cut selected checklist items
- **WHEN** one or more checklist items are selected and the user invokes Cut
- **THEN** Tasks first writes the selected items in visible order to the checklist clipboard payload, then removes those items from the source checklist, clears their selection, and shows a count-bearing success toast

#### Scenario: Preserve source rows when checklist Cut cannot write
- **WHEN** Tasks cannot write a selected checklist Cut payload to the operating-system clipboard
- **THEN** Tasks keeps every selected source item in place and shows a destructive failure toast

#### Scenario: Paste checklist items after a focused item
- **WHEN** a persisted checklist-item input has text-cursor focus and the user pastes a valid checklist clipboard payload
- **THEN** Tasks inserts the copied items immediately after the focused item in source order, preserves each completion state, keeps the destination task editor open, focuses the final pasted item, and does not show a redundant success toast

#### Scenario: Paste checklist items at a draft position
- **WHEN** a transient checklist draft input has text-cursor focus and the user pastes a valid checklist clipboard payload
- **THEN** Tasks inserts the copied items at the draft's current list position in source order, preserves each completion state, moves an empty draft below the pasted group or commits a nonempty draft there through its existing blur behavior, focuses the final pasted item, and does not show a redundant success toast

#### Scenario: Reject a malformed checklist clipboard payload
- **WHEN** a checklist input receives text identifying itself as a checklist clipboard payload but its version, operation, item count, title, or completion state is invalid
- **THEN** Tasks creates no checklist items, leaves the destination checklist unchanged, and shows a destructive failure toast

#### Scenario: Checklist selection owns Copy and Cut
- **WHEN** checklist-item selection is active within an open task and the user invokes Copy or Cut
- **THEN** the checklist editor handles the command and Tasks does not also copy or cut the enclosing task or task-list selection
