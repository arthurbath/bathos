## ADDED Requirements

### Requirement: Native quick entry accepts only task metadata shortcuts

The Tasks module SHALL allow the macOS Global Quick Entry draft to use the same Control-based metadata commands as an ordinary open task while suppressing Tasks commands whose list, lifecycle, or history meaning is ambiguous in the overlay.

#### Scenario: Apply supported metadata commands to the quick-entry draft

- **WHEN** Global Quick Entry is active and the user invokes Control+E, Control+R, Control+T, Control+Y, Control+D, Control+F, Control+G, Control+C, or Control+V
- **THEN** the command SHALL apply its ordinary Start, clear Start, Today horizon, Reminder, Deadline, actionability, Someday, checklist, or Area behavior to the quick-entry draft
- **AND** the command SHALL work even while a text-entry control owns keyboard focus

#### Scenario: Ignore ambiguous task and list commands in quick entry

- **WHEN** Global Quick Entry is active and the user invokes a Tasks Control command for task open or close, task navigation, new-task capture, undo history, completion, bulk selection, or view navigation
- **THEN** the command SHALL be consumed without performing that action
- **AND** it SHALL NOT close, create, complete, select, navigate away from, or apply account history to the quick-entry draft
