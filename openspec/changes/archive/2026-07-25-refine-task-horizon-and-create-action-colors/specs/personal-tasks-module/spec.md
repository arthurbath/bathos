## MODIFIED Requirements

### Requirement: Semantic Today Horizon Identity
The Tasks module SHALL use a consistent icon-and-color identity for each Today horizon wherever the horizon is presented as a symbol: green Inbox, yellow Now, red-orange Next, and reddish-purple Later.

#### Scenario: Color Today bucket symbols
- **WHEN** Today presents an Inbox, Now, Next, or Later bucket
- **THEN** the bucket's Lucide horizon symbol uses the horizon's semantic color while retaining its visible horizon name

#### Scenario: Color horizon markers outside Today
- **WHEN** an Anytime task or another planning row presents an Inbox, Now, Next, or Later horizon marker
- **THEN** the marker uses the same semantic color and Lucide icon as that horizon uses in Today

#### Scenario: Color Start-picker choices
- **WHEN** the Start picker presents the Inbox, Now, Next, and Later choices
- **THEN** each choice's Lucide symbol uses the same semantic horizon color without relying on color as its only label

### Requirement: Contextual Task Creation Affordances
The Tasks module SHALL expose pointer and touch creation affordances on active planning lists and SHALL place each resulting draft at the top of the planning context from which creation was invoked.

#### Scenario: Present the primary floating creation action
- **WHEN** a user views Today, Upcoming, Anytime, or Someday outside bulk selection mode
- **THEN** Tasks presents one large circular New Task button fixed near the bottom-right of the screen with a green outline, green plus, and dark background, clear of mobile navigation and safe-area insets, and does not present the former New Task action in the view header

#### Scenario: Omit creation from non-planning views
- **WHEN** a user views Done, Search, Config, Templates, Projects, an area, or a project
- **THEN** Tasks does not present the floating or task-bucket creation affordances

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

#### Scenario: Reveal a bucket add affordance
- **WHEN** a pointer or keyboard user hovers or focuses a creatable bucket heading
- **THEN** the heading uses a pointer cursor and reveals a small Lucide Plus to the right of its label while the complete heading control remains the activation target

#### Scenario: Keep pointer and keyboard creation contracts distinct
- **WHEN** the established keyboard new-task command is invoked
- **THEN** Tasks preserves its existing view defaults and single-draft behavior rather than requiring a visible pointer bucket
