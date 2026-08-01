## MODIFIED Requirements

### Requirement: Contextual Task Creation Affordances
The Tasks module SHALL expose pointer and touch creation affordances on active planning lists and SHALL place each resulting draft at the top of the planning context from which creation was invoked.

#### Scenario: Present the primary floating creation action
- **WHEN** a user views Today, Upcoming, Anytime, or Someday outside bulk selection mode
- **THEN** Tasks presents one compact circular New Task button fixed near the bottom-right edge of the bounded Tasks list with a slightly translucent solid-green surface, backdrop blur where supported, a thin opaque green border, and a persistent white Plus, clear of mobile navigation and safe-area insets, and does not present the former New Task action in the view header

#### Scenario: Create in the first Today bucket
- **WHEN** a user invokes the floating action from Today
- **THEN** Tasks opens a blank draft at the top of the first visible Inbox, Now, Next, or Later task bucket and assigns that horizon, falling back to Today Now when no Today task bucket is visible

#### Scenario: Create in the first Upcoming bucket
- **WHEN** a user invokes the floating action from Upcoming
- **THEN** Tasks opens a blank draft at the top of the first visible Upcoming task bucket and assigns that bucket's canonical Start, falling back to tomorrow when Upcoming has no visible bucket

#### Scenario: Create in an ungrouped planning list
- **WHEN** a user invokes the floating action from Anytime or Someday
- **THEN** Tasks opens a blank draft at the top of the Tasks section with the ordinary Anytime or Someday destination

#### Scenario: Create from a Today bucket heading
- **WHEN** a user clicks an Inbox, Now, Next, or Later task-bucket heading
- **THEN** Tasks opens a blank draft at the top of that bucket and assigns the represented Today horizon

#### Scenario: Create from an Upcoming bucket heading
- **WHEN** a user clicks a day, month, or year task-bucket heading in Upcoming
- **THEN** Tasks opens a blank draft at the top of that bucket and assigns the section's canonical day, first day of month, or first day of year as Start

#### Scenario: Present a quiet bucket creation target
- **WHEN** a creatable bucket heading is presented
- **THEN** the heading uses a pointer cursor and the complete heading control remains the activation target without displaying an Add Task Plus icon

#### Scenario: Keep pointer and keyboard creation contracts distinct
- **WHEN** the established keyboard new-task command is invoked
- **THEN** Tasks preserves its existing view defaults and single-draft behavior rather than requiring a visible pointer bucket
