## ADDED Requirements

### Requirement: Fixed Actionability Quick Filters
The Tasks module SHALL offer exactly four predefined actionability quick filters, SHALL keep All Tasks as the unfiltered default, and SHALL persist one owner-wide active choice across primary lists, sessions, and devices without introducing custom filters or generic labels.

#### Scenario: Start without a saved filter
- **WHEN** an owner has no saved Tasks quick-filter preference
- **THEN** Today, Upcoming, Anytime, Someday, and Done present all task rows allowed by their ordinary view membership

#### Scenario: Expose the fixed filter set
- **WHEN** a user opens Quick Filters from a primary Tasks list
- **THEN** the menu offers All Tasks, Only Ready, Only Not Ready, Only Rechecking, and Only Waiting and offers no custom, combined, or advanced filter controls

#### Scenario: Filter ready work
- **WHEN** Only Ready is active
- **THEN** each primary list presents only task rows whose structured actionability is `actionable`

#### Scenario: Filter work that is not ready
- **WHEN** Only Not Ready is active
- **THEN** each primary list presents only task rows whose structured actionability is Waiting or Rechecking

#### Scenario: Filter one non-actionable state
- **WHEN** Only Waiting or Only Rechecking is active
- **THEN** each primary list presents only task rows with that exact structured actionability

#### Scenario: Preserve non-task planning content
- **WHEN** an actionability quick filter is active in a primary list that also presents project cards or deleted hierarchy roots
- **THEN** the filter changes task-row presentation without removing those non-task items

#### Scenario: Show and replace the active filter
- **WHEN** a predefined filter is active
- **THEN** its name appears in the list's top-right action row and the same control allows the user to select another filter or All Tasks

#### Scenario: Clear the active filter
- **WHEN** the user selects All Tasks
- **THEN** the current list immediately returns to its ordinary unfiltered task membership and the control returns to its inactive icon presentation

#### Scenario: Explain an empty filtered result
- **WHEN** the active quick filter matches no task rows in the current list
- **THEN** the interface presents a filter-specific no-matches message while keeping the active filter visible

#### Scenario: Reconcile selection after filtering
- **WHEN** a filter change removes a focused, open, or bulk-selected task from the visible projection
- **THEN** Tasks closes or clears incompatible task interaction state and restores focus through the established visible-list fallback order

#### Scenario: Apply one preference to every primary list
- **WHEN** the user changes between Today, Upcoming, Anytime, Someday, and Done
- **THEN** the same active quick filter remains applied until the user replaces or clears it

#### Scenario: Restore the preference in another session or device
- **WHEN** the owner opens Tasks in a later session or on another device
- **THEN** the most recent valid saved quick filter is restored and applied to every primary list

#### Scenario: Continue filtering during an offline launch
- **WHEN** a device has a valid cached quick-filter preference but cannot reach the server
- **THEN** Tasks applies the cached preference immediately and reconciles it after connectivity returns

#### Scenario: Reject an unknown saved value
- **WHEN** a cached or database preference does not match one of the five supported values
- **THEN** Tasks safely treats it as All Tasks
