## MODIFIED Requirements

### Requirement: Directly recoverable Done task controls
Done SHALL present retained completed, canceled, and deleted tasks as fully inspectable, editable, selectable, and recoverable task states, grouped by their owner-local terminal-entry day and never drag-reorderable. Done MUST NOT present deleted checklist items as list entries, while their deletion history remains available to undo.

#### Scenario: Delete a task from its menu
- **WHEN** a user activates Delete in a task's ellipsis menu
- **THEN** Tasks recoverably deletes the task hierarchy and presents its root in Done as trashed

#### Scenario: Delete an open task
- **WHEN** a task is open and the user presses Command+Delete on Mac or the corresponding Windows shortcut
- **THEN** Tasks closes and recoverably deletes that task while unmodified Delete remains field-local

#### Scenario: Delete a focused task
- **WHEN** a closed whole-task-focused task receives Delete or the platform Command+Delete equivalent outside a text-entry control
- **THEN** Tasks recoverably deletes that task

#### Scenario: Delete selected tasks
- **WHEN** a user presses Delete with one or more tasks explicitly selected
- **THEN** Tasks applies the guarded recoverable deletion transition to every selected task and retains each accepted deletion in task history

#### Scenario: Reopen a completed task by unchecking it
- **WHEN** Done presents a completed present task
- **THEN** its leading control is a semantic-green Lucide `SquareCheck`, and activating that control reopens the task according to its current planning metadata

#### Scenario: Reopen a canceled task
- **WHEN** Done presents a canceled present task
- **THEN** its leading control communicates cancellation and activating it reopens the task through the same guarded lifecycle path

#### Scenario: Reopen a deleted task from its terminal control
- **WHEN** Done presents a recoverably deleted task root
- **THEN** its leading icon-only control persistently shows a neutral-gray Lucide `SquareX`, is labeled `Reopen`, and reopens the task through the existing hierarchy-safe transition according to its current planning metadata

#### Scenario: Offer the same recovery action in task menus
- **WHEN** a user opens the ellipsis menu for a completed, canceled, or deleted task in Done
- **THEN** the recovery action is labeled `Reopen`

#### Scenario: Hide deleted checklist items
- **WHEN** checklist-item deletion history remains available for undo
- **THEN** Done does not render those checklist items, a deleted checklist section, or a non-empty state based only on those hidden records

#### Scenario: Open and edit a terminal task
- **WHEN** a retained completed, canceled, or deleted task appears in Done
- **THEN** the user can open its ordinary drawer and edit every ordinarily editable metadata field without implicitly recovering it

#### Scenario: Select terminal tasks together
- **WHEN** Done contains completed, canceled, or deleted tasks
- **THEN** whole-task focus, single selection, multi-selection, and eligible bulk recovery treat them as peer task rows

#### Scenario: Present terminal bulk actions
- **WHEN** one or more completed, canceled, or deleted tasks are selected in Done and the user opens Edit
- **THEN** Tasks offers Area, Actionability, and Reopen, keeps the Area and Actionability submenus operable, omits Delete, and does not offer terminal-ineligible Start or Deadline actions

#### Scenario: Reopen a mixed terminal selection
- **WHEN** the user chooses Reopen for a selection containing any mix of completed, canceled, and deleted tasks
- **THEN** Tasks reopens completed and canceled tasks, restores deleted task hierarchies, clears the terminal metadata that kept every successful task in Done, and treats the bulk request as one user operation

#### Scenario: Bulk edit terminal organization metadata
- **WHEN** the user chooses an Area or Actionability value for selected Done tasks
- **THEN** Tasks applies the value atomically to every selected task without reopening it or removing it from Done

#### Scenario: Preserve task-row interaction in Done
- **WHEN** a retained task appears in Done
- **THEN** its title, source link, terminal date, whole-task focus, selection behavior, and direct recovery control remain operable without exposing permanent deletion

#### Scenario: Group terminal work by day
- **WHEN** Done presents retained terminal tasks
- **THEN** it buckets them by the owner-local date on which each task was completed, canceled, or deleted and orders the newest bucket first

#### Scenario: Prohibit Done reordering
- **WHEN** a user views Done
- **THEN** Tasks exposes no single-task or multi-task drag reordering

#### Scenario: Retain terminal work for purge
- **WHEN** a task is completed, canceled, or deleted
- **THEN** its existing completion, cancellation, or deletion timestamp remains the Done grouping and 31-day retention timestamp until the task is recovered or purged
