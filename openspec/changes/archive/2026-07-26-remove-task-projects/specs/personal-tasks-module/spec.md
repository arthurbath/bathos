## ADDED Requirements

### Requirement: Project-Free Task Hierarchy
The Tasks module SHALL organize active owner work through optional Areas, tasks, and task checklist items without a Project entity, Project relationship, Project planning root, or Project-specific application surface.

#### Scenario: Organize a task directly in an Area
- **WHEN** a user assigns an owned Area to a task
- **THEN** the task stores that Area directly and every list, sort, search, clipboard, automation, and metadata projection derives organization from that Area alone

#### Scenario: Leave a task unassigned
- **WHEN** a user clears the Area from a task
- **THEN** the task becomes directly unassigned without another container relationship

#### Scenario: Retire Project surfaces
- **WHEN** a user opens Tasks after the project-free release
- **THEN** navigation, creation, editing, planning lists, Quick Find, templates, reminders, recurrence, recovery, command references, and metadata expose no Project entity or Project action

#### Scenario: Redirect a retired Project route
- **WHEN** a browser opens `/tasks/projects` or a former Project detail URL
- **THEN** Tasks replace-navigates to `/tasks/anytime` without rendering a Project view or falling through to another module

### Requirement: Project-Free Production Contraction
The production Tasks data model SHALL remove Project persistence only after a verified private backup and an exact zero-dependency audit, SHALL delete the confirmed disposable test Project and its Project-only history, and SHALL preserve all non-Project owner records.

#### Scenario: Apply the approved destructive migration
- **WHEN** production contains exactly the confirmed disposable Project and no Project task assignments, reminders, templates, recurrence occurrences, or hierarchy operations
- **THEN** the migration deletes that Project and its Project-only history, removes the Project table and active Project references, and leaves every non-Project record unchanged

#### Scenario: Fail closed on unexpected Project content
- **WHEN** the exact Project dependency assertions do not match at migration time
- **THEN** the transaction aborts before deleting or altering owner data

#### Scenario: Synchronize the contracted topology
- **WHEN** the project-free release is deployed
- **THEN** PowerSync publishes and projects exactly 20 approved Tasks tables and no client upload or read path references Projects

### Requirement: Project-Free Portable Tasks
Current Tasks exports SHALL use schema version 13 without Project collections or references, and supported legacy exports SHALL normalize Project-contained tasks into direct Area or unassigned tasks without recreating Project wrappers.

#### Scenario: Export current project-free data
- **WHEN** the user creates a Tasks backup after the migration
- **THEN** the schema-13 envelope contains no Project collection, Project identifier, Project reminder, Project recurrence root, or Project template kind

#### Scenario: Restore a legacy Project task
- **WHEN** a supported schema 3 through 12 backup contains a task assigned to a Project
- **THEN** restore preserves the task and assigns the Project's Area directly when present, otherwise leaves the task unassigned, and creates no Project

#### Scenario: Discard legacy Project-only wrappers
- **WHEN** a supported legacy backup contains Project roots or Project-only history, reminders, templates, or recurrence records
- **THEN** normalization excludes those wrapper records while reporting deterministic accepted normalization rather than recreating the retired entity

### Requirement: Task-Only Planning Roots
Tasks SHALL allow only tasks to own planning reminders, recurrence definitions, and reusable templates while retaining checklist nodes inside task templates.

#### Scenario: Save task-owned planning
- **WHEN** the user or an authorized integration saves a reminder, recurrence definition, or template
- **THEN** the root resolves to a task and no Project discriminator or identifier is accepted

#### Scenario: Reject a retired Project root
- **WHEN** a stale client or payload requests a Project reminder, recurrence, template, hierarchy transition, or organization assignment
- **THEN** the current database or application boundary rejects the unsupported Project contract without mutating owner data

## REMOVED Requirements

### Requirement: Project Planning And Lifecycle
**Reason**: Projects are removed because tasks plus checklist items provide the intended workflow without a second plannable hierarchy root.
**Migration**: Delete the confirmed disposable production Project and Project-only history; preserve ordinary tasks directly in Areas or unassigned.

### Requirement: Project Application Surfaces
**Reason**: Project index, detail, cards, search results, organization choices, reminders, templates, and commands would expose a retired entity.
**Migration**: Remove the surfaces and redirect former Project routes to Anytime.
