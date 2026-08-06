## ADDED Requirements

### Requirement: Recurrence prototypes align like opened tasks
Tasks SHALL apply the ordinary opened-task viewport alignment to a recurrence prototype when the prototype editor opens in Upcoming.

#### Scenario: Open an Upcoming recurrence prototype
- **WHEN** a user opens a recurrence prototype in the Upcoming list
- **THEN** the prototype expands in place
- **AND** after expansion its summary row is aligned near the top of the usable viewport below shared sticky chrome using the ordinary task offset
- **AND** reduced-motion preferences avoid animated scrolling

### Requirement: Recurrence prototype drawers animate like ordinary task drawers
Tasks SHALL use the same staged mount, grid-row expansion, opacity, padding, duration, reduced-motion handling, and delayed unmount lifecycle for recurrence-prototype metadata drawers and ordinary to-do metadata drawers.

#### Scenario: Open a recurrence prototype drawer
- **WHEN** a user opens a recurrence prototype in Upcoming
- **THEN** its metadata drawer mounts in the collapsed opening state
- **AND** expands with the same transition surface and duration as an ordinary to-do drawer

#### Scenario: Close a recurrence prototype drawer
- **GIVEN** a recurrence prototype metadata drawer is open
- **WHEN** the user closes it or opens another row
- **THEN** the drawer enters the ordinary closing state
- **AND** remains mounted and non-interactive until the shared collapse duration completes
- **AND** is then unmounted

### Requirement: Recurrence prototypes replace one another directly
Tasks SHALL coordinate a recurrence-prototype title activation as one close-and-open transition when another recurrence prototype is already open.

#### Scenario: Open one recurrence prototype from another
- **GIVEN** one recurrence prototype editor is open in Upcoming
- **WHEN** the user activates the title of a different recurrence prototype
- **THEN** Tasks flushes and closes the first prototype editor
- **AND** opens the requested prototype editor from the same interaction
- **AND** does not leave both prototype editors closed

### Requirement: Touch scrolling does not activate task action menus
Tasks SHALL distinguish an intentional tap on a task ellipsis trigger from a touch gesture that becomes page scrolling.

#### Scenario: Tap a task ellipsis trigger
- **WHEN** a touch pointer presses and releases a task ellipsis trigger without meaningful movement
- **THEN** the task action menu opens normally

#### Scenario: Begin scrolling from a task ellipsis trigger
- **WHEN** a touch pointer begins on a task ellipsis trigger and moves predominantly vertically beyond the shared movement threshold
- **THEN** an opened task action menu is dismissed or prevented from remaining open
- **AND** the gesture does not activate a menu action
- **AND** native page scrolling remains available

### Requirement: A dragged Today task retains its source return target
Tasks SHALL allow a single dragged Today task to return to its existing position when it is the final task in its horizon bucket.

#### Scenario: Return the final task to its own Today horizon
- **WHEN** a user drags the only task from a Today horizon toward another bucket
- **AND** then drags over the task's own source row before dropping
- **THEN** Tasks shows the ordinary before-or-after blue drop indicator around that row
- **AND** dropping there preserves the task's original horizon and order without issuing a reorder mutation

#### Scenario: Drag multiple selected tasks
- **WHEN** the active drag contains more than one selected task
- **THEN** dragged rows do not become self-target drop zones

### Requirement: Mobile task rows compact time and date metadata
Tasks SHALL use compact visible reminder and date treatments in the second metadata row below the shared mobile breakpoint while retaining full accessible descriptions and the established tablet and desktop copy.

#### Scenario: Show a reminder on a mobile task row
- **WHEN** a task with a reminder renders below the shared `sm` breakpoint
- **THEN** the second metadata row shows the reminder bell without visible time copy
- **AND** the reminder metadata accessible name still includes the scheduled time

#### Scenario: Show a calendar date on a mobile task row
- **WHEN** a Start or Deadline value is presented as a calendar date below the shared `sm` breakpoint
- **THEN** its visible copy uses unpadded numeric month-day form such as `8-31`
- **AND** the full established date wording remains in the accessible name and at tablet and desktop widths

#### Scenario: Show a nearby Deadline countdown on a mobile task row
- **WHEN** a Deadline uses the nearby signed countdown treatment below the shared `sm` breakpoint
- **THEN** its visible copy uses the signed number followed immediately by lowercase `d`, such as `1d` or `-1d`
- **AND** Today remains labeled `Today`

### Requirement: Upcoming month buckets expose every effective Start date
Tasks SHALL show the effective Start date in the second metadata row of every ordinary task and calendar recurrence prototype rendered in a generic Upcoming month bucket.

#### Scenario: Show an explicit Start in a month bucket
- **WHEN** an ordinary task with a future explicit Start renders in an Upcoming month bucket
- **THEN** its second metadata row shows that Start date

#### Scenario: Show a deadline-only task's implicit Start in a month bucket
- **WHEN** an ordinary task has no future explicit Start and its future Deadline places it in an Upcoming month bucket
- **THEN** its second metadata row shows the Deadline date as the task's effective Start
- **AND** the task's stored Start remains unset

#### Scenario: Show a recurrence prototype's scheduled Start in a month bucket
- **WHEN** a calendar recurrence prototype renders in an Upcoming month bucket
- **THEN** its second metadata row shows the scheduled occurrence date as its Start

#### Scenario: Keep date-specific buckets concise
- **WHEN** an ordinary task or recurrence prototype renders in a date-specific Upcoming bucket
- **THEN** Tasks does not add redundant Start metadata for the bucket's date
