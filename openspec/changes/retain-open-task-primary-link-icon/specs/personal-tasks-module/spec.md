## MODIFIED Requirements

### Requirement: Open task retains a summary-row drag handle
Tasks SHALL keep the ordinary rendered summary row visible while its metadata drawer is open, SHALL retain any valid Primary Link icon and action in that summary row, and SHALL limit task-level drag initiation to that summary row.

#### Scenario: Reorder an open task from its summary
- **WHEN** a user presses and drags the rendered summary region of an open task
- **THEN** Tasks closes the metadata drawer as dragging begins and reorders the task among its eligible peers

#### Scenario: Edit Summary without initiating drag
- **WHEN** a user interacts with the Summary input inside the open metadata drawer
- **THEN** the input edits the task title normally and does not act as a task-level drag source

#### Scenario: Reveal an opened destination
- **WHEN** a task opens through direct interaction, keyboard traversal, creation, or Quick Find
- **THEN** Tasks smoothly positions its summary row about one collapsed task-row below the visible content boundary when available scroll range permits

#### Scenario: Retain Primary Link in an open summary
- **WHEN** a task with a valid Primary Link opens its metadata drawer
- **THEN** the protocol-derived Primary Link icon remains visible and actionable in the ordinary summary row

## ADDED Requirements

### Requirement: Primary Link external action styling
Tasks SHALL present the button appended to a disclosed Primary Link field with the semantic blue info-outline treatment used for external destinations.

#### Scenario: Display an actionable Primary Link field
- **WHEN** an open task has a nonblank Primary Link value
- **THEN** the appended external-link action uses the shared blue info-outline button style while retaining its external-link icon and destination behavior
