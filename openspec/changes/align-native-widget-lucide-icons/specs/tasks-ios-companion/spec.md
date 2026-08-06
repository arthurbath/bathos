## ADDED Requirements

### Requirement: Canonical Lucide Widget Iconography
The iOS Tasks widgets SHALL use the same canonical Lucide icon choices as the Tasks application for every Tasks-domain icon position that WidgetKit permits to contain custom vector content, while preserving semantic tint, accessibility, privacy, and interaction behavior.

#### Scenario: Render a configured list
- **WHEN** the list widget renders Today, Upcoming, Anytime, Someday, or Done
- **THEN** its header uses the corresponding canonical Lucide list icon

#### Scenario: Render Today horizons
- **WHEN** a Today widget row includes Inbox, Now, Next, or Later context
- **THEN** it uses the corresponding canonical Lucide horizon icon and the established semantic horizon color

#### Scenario: Render task semantics
- **WHEN** a widget row represents an ordinary, Someday, completed, deleted, or recurrence-prototype task
- **THEN** its leading icon uses the corresponding canonical Lucide task-state or recurrence icon

#### Scenario: Render a Primary Link
- **WHEN** a widget row exposes a generic, Mail, Jira, or Obsidian Primary Link
- **THEN** the link uses the same protocol-specific Lucide icon as the Tasks application and retains the native blue link treatment

#### Scenario: Render widget actions and empty state
- **WHEN** the widget renders its add action or current empty state
- **THEN** it uses the canonical Lucide Add Task or Empty State icon without changing the action or message

#### Scenario: Render an accessory widget
- **WHEN** WidgetKit applies monochrome, accented, or privacy rendering to an accessory widget
- **THEN** the Lucide geometry accepts the system rendering mode without substituting a different icon vocabulary
