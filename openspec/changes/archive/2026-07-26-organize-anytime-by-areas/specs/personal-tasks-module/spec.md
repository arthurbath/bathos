## ADDED Requirements

### Requirement: Area-Aware Task Planning
The Tasks module SHALL use name-only Areas to organize ongoing responsibilities, SHALL derive a Project task's Area from its Project, and SHALL keep Area organization separate from temporal planning.

#### Scenario: Keep Areas name-only
- **WHEN** a user creates or edits an Area
- **THEN** the Area exposes a name and manual order without completion, Start, Deadline, destination, or day-horizon state

#### Scenario: Identify Area work in Today
- **WHEN** a Today task belongs directly to an Area or belongs to a Project in an Area
- **THEN** Today presents the Area name in the task's secondary metadata while continuing to group and manually order the task only within Inbox, Now, Next, or Later

#### Scenario: Leave Today work intermingled
- **WHEN** Today contains tasks from different Areas and tasks with no Area
- **THEN** the user can order them together inside one day horizon without an Area bucket changing membership or rank

#### Scenario: Put unassigned Anytime work first
- **WHEN** Anytime contains tasks with no direct Area and no Project whose Area can be derived
- **THEN** it presents those tasks at the top in manual order without rendering a No Area or generic Tasks heading

#### Scenario: Group Anytime work by effective Area
- **WHEN** Anytime contains a task assigned directly to an Area or assigned to a Project in an Area
- **THEN** it presents the task beneath a bucket named for that effective Area and does not add a competing direct Area assignment to a Project task

#### Scenario: Order Area buckets manually
- **WHEN** multiple Area buckets contain visible Anytime tasks
- **THEN** the interface orders the buckets by the manual Area order maintained in Config, after the unlabelled unassigned region

#### Scenario: Omit an empty Area bucket
- **WHEN** an Area has no task visible under ordinary Anytime membership and the active Quick Filter
- **THEN** Anytime omits that Area's heading and does not render an empty bucket

#### Scenario: Group Someday work by effective Area
- **WHEN** Someday contains unassigned work and work associated directly or through a Project with an Area
- **THEN** it presents unassigned work first without a heading, followed by nonempty Area buckets in the manual Area order maintained in Config

#### Scenario: Reorder inside one effective Area
- **WHEN** a user drags an Anytime task before or after another task in the same effective Area bucket
- **THEN** Tasks changes the destination-wide manual planning order without changing the dragged task's direct Area or Project membership

#### Scenario: Move a task to another Area
- **WHEN** a user drags an Anytime task from one effective Area region into another Area bucket
- **THEN** Tasks assigns the target Area directly, clears an incompatible Project assignment, preserves planning metadata and identity, and saves the requested visible order as one undoable mutation

#### Scenario: Remove Area membership by drag
- **WHEN** a user drags an Anytime task from an Area bucket into the unlabelled unassigned region
- **THEN** Tasks clears direct Area and Project membership, preserves planning metadata and identity, and saves the requested visible order as one undoable mutation

#### Scenario: Create inside an Area bucket
- **WHEN** a user activates an Area bucket heading in Anytime or Someday
- **THEN** Tasks opens one new task in that view assigned directly to that Area at the top of the bucket

#### Scenario: Create generic Anytime work
- **WHEN** a user activates the floating New Task action in Anytime
- **THEN** Tasks opens one unassigned Anytime task at the top of the unlabelled region

#### Scenario: Manage Areas in Config
- **WHEN** a user opens Tasks Config
- **THEN** one Areas section allows the user to add, rename, reorder, or recoverably delete Areas

#### Scenario: Keep Area administration out of Projects
- **WHEN** a user opens the Projects destination
- **THEN** the page presents Project creation and management without controls that add, rename, reorder, delete, or open an Area-administration surface

#### Scenario: Preserve Area context for Projects
- **WHEN** a user creates or edits a Project
- **THEN** the Projects surface may assign the Project to an existing Area without offering Area administration

#### Scenario: Name the Projects destination
- **WHEN** Tasks presents the `/tasks/projects` navigation destination, page title, error copy, or Project-detail return breadcrumb
- **THEN** the user-facing name is Projects and the destination uses the canonical Project icon

#### Scenario: Return from an Area detail
- **WHEN** an Area detail presents a return breadcrumb
- **THEN** the breadcrumb returns to Config and Area renaming remains available only in Config

## MODIFIED Requirements

### Requirement: Canonical Tasks Iconography
The Tasks module SHALL maintain and consistently reuse a documented Lucide icon for every established Tasks product concept, while preserving accessible text or programmatic names independently from the icon.

#### Scenario: Use canonical entity icons
- **WHEN** Tasks represents a Task, Project, Area, Task Checklist, or Attachment concept with an icon
- **THEN** it uses Lucide `SquareCheckBig`, `CopyCheck`, `Layers3` (the Stack glyph), `ListTree`, or `Paperclip`, respectively

#### Scenario: Use canonical lifecycle view icons
- **WHEN** Tasks represents Someday or Done with an icon
- **THEN** it uses Lucide `SquareDashed` or `ListChecks`, respectively

#### Scenario: Use canonical creation icons
- **WHEN** Tasks presents an icon for Add Task, Add Project, or Add Area
- **THEN** it uses Lucide `SquarePlus`, `Layers3` (the Stack glyph), or `SquarePlus`, respectively

#### Scenario: Preserve approved existing concepts
- **WHEN** Tasks renders an established concept that is not explicitly overridden
- **THEN** it uses the canonical Lucide component recorded in the Tasks iconography reference rather than choosing a new icon independently at the rendering site

#### Scenario: Reuse one concept across surfaces
- **WHEN** one established Tasks concept appears in navigation, search, a list, a picker, a dialog, or another module surface
- **THEN** every occurrence uses the same canonical icon unless the iconography reference explicitly defines a distinct action concept
