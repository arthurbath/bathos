# Snake Module Specification

## Purpose

Define the public Snake module's household sharing, snake configuration, weight tracking, and ball-python growth evaluation behavior.

## Requirements

### Requirement: Public Snake Module Registration
The system SHALL expose Snake as a normal authenticated BathOS module, not as an admin-only module.

#### Scenario: Launcher availability
- **WHEN** an authenticated non-admin user opens the launcher
- **THEN** the launcher lists Snake with a launch path under `/snake`

#### Scenario: Route detection
- **WHEN** the current path starts with `/snake`
- **THEN** platform module detection identifies the active module as Snake

### Requirement: Snake Household Sharing
The system SHALL provide Snake households with invite-code collaboration and member management equivalent to existing household modules.

#### Scenario: Create Snake household
- **WHEN** an authenticated user without a Snake household creates one
- **THEN** the system creates a Snake household, adds the user as a member, and returns the household name and invite code

#### Scenario: Join Snake household
- **WHEN** an authenticated user enters a valid Snake household invite code
- **THEN** the system adds the user to that Snake household and loads its shared Snake data

#### Scenario: Manage Snake household
- **WHEN** a Snake household member opens household configuration
- **THEN** the system shows members and supports invite rotation, member removal, leaving the household, and deleting the household through the shared household-management pattern

### Requirement: Snake Entity Configuration
The system SHALL allow a Snake household to manage one or more snake entities from a config view.

#### Scenario: Add snake
- **WHEN** a household member adds a snake with required basic characteristics
- **THEN** the snake appears in the household config list and can be selected for weight tracking

#### Scenario: Edit snake facts inline
- **WHEN** a household member updates a snake's name, birthday, species, morph, sex, or notes
- **THEN** future growth calculations use the updated snake facts without requiring weight-record edits

#### Scenario: Select current snake
- **WHEN** a household member chooses a snake from the top-navigation snake selector
- **THEN** the chosen snake becomes the current snake for weight-record views and is persisted as the household's active snake

### Requirement: Snake Weight Records
The system SHALL allow household members to create, edit, and delete dated weight records for the selected snake.

#### Scenario: View full weight grid
- **WHEN** a household member opens `/snake/weights` with an active snake
- **THEN** the system shows a full-view DataGrid of that snake's records sorted newest first

#### Scenario: Save weight record inline
- **WHEN** a household member adds or edits a weight record
- **THEN** the system persists the date and weight in grams for the selected snake

#### Scenario: Add weight record with shared date picker
- **WHEN** a household member opens the add weight record modal
- **THEN** the Date field uses the shared BathOS date-picker field
- **AND** the date value is selected from the calendar picker rather than typed into a native date input

#### Scenario: Delete weight record
- **WHEN** a household member deletes a weight record
- **THEN** the system removes that record and recalculates derived values for remaining records

### Requirement: Derived Growth Evaluation
The system SHALL derive previous-record and growth-evaluation fields from stored snake facts, expectation ranges, and weight records.

#### Scenario: Previous record selection
- **WHEN** a record has another record for the same snake with an earlier date
- **THEN** the previous record is the same snake's record with the greatest date before the current record date
- **AND** the user is not required to select or view a previous-record field in the weight-record grid

#### Scenario: Monthly growth rate
- **WHEN** a record has a previous record
- **THEN** the system calculates grams changed and grams per month using the date gap between the two records

#### Scenario: Age band expectation
- **WHEN** a record has a snake birthday and a ball-python expectation range for its age in months
- **THEN** the system shows the expected lower and upper growth values for that age band

#### Scenario: Growth status below range
- **WHEN** the monthly growth rate is below the expected lower threshold
- **THEN** the system displays `<rounded gap> g/mo Below Expectations`

#### Scenario: Growth status above range
- **WHEN** the monthly growth rate is above the expected upper threshold
- **THEN** the system displays `<rounded gap> g/mo Above Expectations`

#### Scenario: Growth status within range
- **WHEN** the monthly growth rate is within the expected lower and upper thresholds
- **THEN** the system displays `Within Expectations`

#### Scenario: Growth status expectation tooltip
- **WHEN** a household member hovers or focuses a non-empty growth status value in the weight-record grid
- **THEN** the system shows the expected growth thresholds for the selected snake's growth profile by age band
- **AND** the age band that applies to that record is bolded

#### Scenario: First record has no comparison
- **WHEN** a record has no previous record
- **THEN** the system leaves growth-rate and growth-status values blank

### Requirement: Babylon Seed Data
The system SHALL import the existing Babylon Airtable records for `art@bath.garden` when that user exists during migration.

#### Scenario: Seed user exists
- **WHEN** the migration runs and `art@bath.garden` exists in Auth
- **THEN** the system creates a Snake household for that user, creates a snake named `Babylon`, sets birthday `2024-11-27`, and imports the 17 Airtable weight records

#### Scenario: Seed user missing
- **WHEN** the migration runs and `art@bath.garden` does not exist in Auth
- **THEN** the system still creates the Snake schema and ball-python expectation ranges without failing the migration
