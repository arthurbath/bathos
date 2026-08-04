## ADDED Requirements

### Requirement: Celebratory Task-List Empty States
The Tasks module SHALL present empty task-list projections with one consistent, sentence-case empty-state treatment that pairs the relevant message with a medium Lucide Sparkles icon.

#### Scenario: Show an intrinsically empty primary list
- **WHEN** Today, Upcoming, Anytime, Someday, or Done has no eligible task or recurrence content to display
- **THEN** the list area shows a relevant sentence-case message alongside the medium Sparkles icon

#### Scenario: Explain an empty quick-filter projection
- **WHEN** an active quick filter leaves a primary list with no visible matching tasks
- **THEN** the list area shows the medium Sparkles icon with the sentence-case message `No tasks match this filter`
- **AND** the active quick-filter indicator remains visible

#### Scenario: Show an empty Area task list
- **WHEN** an existing Area has no loose tasks to display
- **THEN** its task-list section shows the sentence-case message `No loose tasks` alongside the medium Sparkles icon

#### Scenario: Exclude Search empty states
- **WHEN** full Search has no entered query or its query has no matching tasks
- **THEN** Search presents its applicable sentence-case guidance without the Sparkles icon

### Requirement: Unbucketed Full Search Results
The full Tasks Search page SHALL present its single result collection without a visible task-bucket heading while retaining an accessible results region.

#### Scenario: Await a search term
- **WHEN** the user visits full Search without a nonblank query
- **THEN** the results region shows the sentence-case message `Enter a search term`
- **AND** no visible `Tasks` bucket heading appears

#### Scenario: Find no matching tasks
- **WHEN** a nonblank full Search query matches no tasks or recurrence prototypes
- **THEN** the results region shows the sentence-case message `No matching tasks`
- **AND** no visible `Tasks` bucket heading appears

#### Scenario: Present matching results
- **WHEN** a full Search query returns one or more results
- **THEN** the result rows appear directly in the results region without a visible `Tasks` bucket heading
