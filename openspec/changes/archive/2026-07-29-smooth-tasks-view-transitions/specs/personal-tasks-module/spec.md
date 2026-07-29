## ADDED Requirements

### Requirement: Settled Task List Transitions
The system SHALL conceal stale or partially projected task rows while navigating from one Tasks planning list to another and SHALL reveal the destination list only after its watched query has settled.

#### Scenario: Navigate between planning lists
- **WHEN** a user navigates from Today, Upcoming, Anytime, Someday, or Done to a different one of those planning lists
- **THEN** the destination route and navigation state update immediately
- **AND** the list content presents a brief loading state instead of rows derived from the previous list's query result
- **AND** the destination rows appear together after the destination query settles

#### Scenario: Use any navigation input
- **WHEN** a user changes planning lists by a navigation link, pointer action, or supported keyboard shortcut
- **THEN** the same route-driven settled transition behavior applies

#### Scenario: Refresh the current planning list
- **WHEN** PowerSync re-evaluates the watched query without a planning-list route change
- **THEN** the currently rendered rows remain visible unless the query enters its existing initial-loading or error state
