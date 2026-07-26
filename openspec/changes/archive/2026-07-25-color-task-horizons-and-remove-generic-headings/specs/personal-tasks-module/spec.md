## ADDED Requirements

### Requirement: Semantic Today Horizon Identity
The Tasks module SHALL use a consistent icon-and-color identity for each Today horizon wherever the horizon is presented as a symbol: blue Inbox, yellow Now, red-orange Next, and reddish-purple Later.

#### Scenario: Color Today bucket symbols
- **WHEN** Today presents an Inbox, Now, Next, or Later bucket
- **THEN** the bucket's Lucide horizon symbol uses the horizon's semantic color while retaining its visible horizon name

#### Scenario: Color horizon markers outside Today
- **WHEN** an Anytime task or another planning row presents an Inbox, Now, Next, or Later horizon marker
- **THEN** the marker uses the same semantic color and Lucide icon as that horizon uses in Today

#### Scenario: Color Start-picker choices
- **WHEN** the Start picker presents the Inbox, Now, Next, and Later choices
- **THEN** each choice's Lucide symbol uses the same semantic horizon color without relying on color as its only label

### Requirement: Ungrouped Primary Task Lists
The Tasks module SHALL render ordinary task rows directly in Anytime, Someday, and Done without a redundant visible Tasks bucket heading.

#### Scenario: Browse Anytime without a generic bucket heading
- **WHEN** Anytime contains ordinary tasks
- **THEN** the task rows appear directly beneath the view's other applicable content without a visible nested Tasks heading

#### Scenario: Browse Someday without a generic bucket heading
- **WHEN** Someday contains ordinary tasks
- **THEN** the task rows appear directly beneath the view's other applicable content without a visible nested Tasks heading

#### Scenario: Browse Done without a generic bucket heading
- **WHEN** Done contains terminal tasks
- **THEN** the task rows appear without a visible nested Tasks heading while meaningful Deleted and project group headings remain available when applicable

#### Scenario: Preserve accessible list structure
- **WHEN** a generic Tasks heading is omitted
- **THEN** the route retains its named view landmark and the task rows remain inside an accessible task-list region
