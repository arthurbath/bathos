## ADDED Requirements

### Requirement: Authoritative Upcoming Rank
Tasks SHALL persist one Upcoming-specific rank for every ordinary task and dated recurrence prototype, SHALL scope that rank to each visible controlling-date bucket, and SHALL use it independently from Today, Anytime, Someday, or checklist order.

#### Scenario: Reorder ordinary work inside Upcoming
- **WHEN** a user moves an ordinary task before or after any ordinary task or recurrence prototype in the same Upcoming bucket
- **THEN** Tasks updates only its Upcoming rank and preserves its ordering in other lists

#### Scenario: Reorder a recurrence prototype inside Upcoming
- **WHEN** a user moves a recurrence prototype before or after any ordinary task or recurrence prototype in its current Upcoming bucket
- **THEN** Tasks updates the definition's Upcoming rank without changing cadence, prototype content, next occurrence date, or recurrence revision

#### Scenario: Keep a recurrence prototype in its cadence bucket
- **WHEN** a drag would place a recurrence prototype in another Upcoming bucket
- **THEN** Tasks rejects the move and leaves its rank and recurrence data unchanged

#### Scenario: Promote Upcoming order into Today
- **WHEN** multiple ordinary tasks or spawned recurrence instances reach the owner-local planning date together
- **THEN** activation appends them to Today Inbox in their final Upcoming-rank order after unfinished rolled-over work

#### Scenario: Preserve authoritative widget order
- **WHEN** the web bridge or native credential endpoint projects Upcoming for an Apple-platform widget
- **THEN** ordinary tasks and virtual recurrence prototypes are ordered by controlling date and Upcoming rank before the leading ten rows are selected

### Requirement: Open Task Inline Summary Composition
An open ordinary task SHALL replace its closed-row title, metadata, trailing actions, and duplicate editor Summary field with the live Summary input beside its completion control.

#### Scenario: Open a task
- **WHEN** an ordinary task metadata drawer opens
- **THEN** its Summary input occupies the summary row beside the completion control, receives the existing autosave and undo behavior, and no second Summary input or row ellipsis is rendered

#### Scenario: Close a task
- **WHEN** the ordinary task metadata drawer closes
- **THEN** the row restores its closed Summary, metadata, links, and eligible trailing actions

#### Scenario: Reveal an opened destination
- **WHEN** a task opens through direct interaction, keyboard traversal, creation, or Quick Find
- **THEN** Tasks smoothly positions its summary row about one collapsed task-row below the visible content boundary when available scroll range permits

### Requirement: Quick Find Destination Semantics
Quick Find SHALL derive both its label and activation route from the task's natural planning route and SHALL use one whole-row preliminary focus style while retaining text-cursor focus in the query.

#### Scenario: Label an Upcoming-only task
- **WHEN** an ordinary result belongs only to Upcoming
- **THEN** its secondary label is `Upcoming` and activation opens that task in Upcoming

#### Scenario: Label a Today and Anytime task
- **WHEN** an ordinary result belongs to both Today and Anytime
- **THEN** its secondary label is `Anytime` and activation opens that task in Anytime

#### Scenario: Navigate result focus
- **WHEN** the user moves Quick Find's preliminary selection with Up or Down
- **THEN** the complete active result row uses the standard subdued blue task focus without receiving a white browser focus ring or moving text focus out of the query input

#### Scenario: Place the compact palette
- **WHEN** Quick Find opens with zero or more results
- **THEN** it appears near the top of the visual viewport, grows downward, uses balanced empty-state padding, and presents a transparent dark backdrop that consumes outside dismissal

#### Scenario: Reveal a regular result
- **WHEN** an ordinary Quick Find result is activated
- **THEN** Tasks opens it on the derived route and positions it with about one collapsed task-row of context above it without scrolling past that target

#### Scenario: Reveal a recurrence result
- **WHEN** a recurrence-definition Quick Find result is activated
- **THEN** Tasks opens Upcoming, keeps repeat management closed, scrolls the prototype to the same contextual offset, and applies the whole-row blue focus style

### Requirement: Installed Task Navigation Boundaries
Installed Tasks surfaces SHALL preserve vertical content scrolling and task-owned drag gestures while preventing native web-view history swipe navigation where the host exposes that control.

#### Scenario: Use the iOS native companion
- **WHEN** the user vertically scrolls or drags a reorderable task in the iOS companion
- **THEN** the WKWebView preserves native-feeling vertical movement and task drag ownership without enabling back/forward history swipes

#### Scenario: Use an installed PWA
- **WHEN** the browser permits page CSS to contain horizontal overscroll
- **THEN** Tasks suppresses horizontal overscroll propagation without rewriting browser history or weakening vertical scroll and task drag behavior

### Requirement: Retired Template Sync Boundary
Active Tasks sync configuration SHALL omit the retired Template tables and SHALL preserve exactly 17 approved Tasks publication tables.

#### Scenario: Provision PowerSync after Template removal
- **WHEN** Tasks sync rules are generated or verified
- **THEN** `tasks_templates`, `tasks_template_revisions`, and `tasks_template_instantiations` are absent and the approved Tasks table count is exactly 17

#### Scenario: Reconnect an older client
- **WHEN** a client reconnects after the rules no longer reference retired Template tables
- **THEN** ordinary Tasks data synchronizes without recreating compatibility tables or treating the retired-table warning as a task-data failure
