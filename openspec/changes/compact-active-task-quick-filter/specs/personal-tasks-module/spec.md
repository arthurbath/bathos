## MODIFIED Requirements

### Requirement: Fixed Actionability Quick Filters
The Tasks module SHALL expose Ready, Waiting, and Rechecking as a constrained actionability multi-select, SHALL treat all three selected as the unfiltered default, SHALL prevent an empty selection, and SHALL persist the resulting owner-wide selection across primary lists, sessions, and devices.

#### Scenario: Start without a saved filter
- **WHEN** an owner has no saved Tasks quick-filter preference
- **THEN** Today, Upcoming, Anytime, Someday, and Done present all task rows allowed by their ordinary view membership

#### Scenario: Expose the actionability states
- **WHEN** a user opens Quick Filters from a primary Tasks list
- **THEN** the menu offers checked Ready, Rechecking, and Waiting options in that order and offers no separate All Tasks, Not Ready, custom, or advanced filter controls

#### Scenario: Hide one actionability state
- **WHEN** the user unchecks one actionability state
- **THEN** each primary list hides task rows with that structured actionability and continues to show rows matching either remaining checked state

#### Scenario: Show one actionability state
- **WHEN** the user leaves only one actionability state checked
- **THEN** each primary list presents only task rows with that structured actionability

#### Scenario: Reject an empty actionability selection
- **WHEN** the user attempts to uncheck the final checked actionability state
- **THEN** Ready, Waiting, and Rechecking all become checked and each primary list returns to its ordinary unfiltered membership

#### Scenario: Show a two-state filtered subtitle
- **WHEN** Ready and Waiting remain checked while Rechecking is unchecked
- **THEN** `Only Ready & Waiting` appears directly beneath the current list title

#### Scenario: Show a one-state filtered subtitle
- **WHEN** only Rechecking remains checked
- **THEN** `Only Rechecking` appears directly beneath the current list title

#### Scenario: Show the active filter control
- **WHEN** fewer than all three actionability states are checked
- **THEN** the icon-sized Quick Filters trigger uses the same active visual treatment as Select Tasks and its accessible name includes the active subtitle

#### Scenario: Keep the action row compact while filtered
- **WHEN** a predefined filter is active at any supported viewport width
- **THEN** the Quick Filters trigger does not expand with a visible text label and the list-level action controls remain in their single compact row

#### Scenario: Restore the unfiltered presentation
- **WHEN** all three actionability states are checked
- **THEN** the current list shows its ordinary membership, the active filter subtitle disappears, and the control returns to its inactive icon presentation

#### Scenario: Explain an empty filtered result
- **WHEN** the active quick filter matches no task rows in the current list
- **THEN** the interface presents a filter-specific no-matches message while keeping the active filter visible

#### Scenario: Reconcile selection after filtering
- **WHEN** a filter change removes a focused, open, or bulk-selected task from the visible projection
- **THEN** Tasks closes or clears incompatible task interaction state and restores focus through the established visible-list fallback order

#### Scenario: Abandon focus after closing a temporarily revealed task
- **GIVEN** Quick Find opened a task that does not match the active quick filter
- **WHEN** the user closes the task and it returns to being hidden by that filter
- **THEN** Tasks preserves the active filter and leaves the list without a keyboard-focused task

#### Scenario: Apply one preference to every primary list
- **WHEN** the user changes between Today, Upcoming, Anytime, Someday, and Done
- **THEN** the same active quick filter remains applied until the user replaces or clears it

#### Scenario: Restore the preference in another session or device
- **WHEN** the owner opens Tasks in a later session or on another device
- **THEN** the most recent valid saved quick filter is restored and applied to every primary list

#### Scenario: Continue filtering during an offline launch
- **WHEN** a device has a valid cached quick-filter preference but cannot reach the server
- **THEN** Tasks applies the cached preference immediately and reconciles it after connectivity returns

#### Scenario: Read a legacy not-ready preference
- **WHEN** a cached or database preference contains the legacy `non_actionable` value
- **THEN** Tasks restores Waiting and Rechecking as checked and Ready as unchecked

#### Scenario: Reject an unknown saved value
- **WHEN** a cached or database preference does not match one of the seven supported non-empty combinations
- **THEN** Tasks safely treats it as All Tasks
