# Garage Vehicle Upcoming Horizons Specification

## Purpose

Define how Garage stores, configures, migrates, and applies vehicle-specific mileage and time horizons for upcoming-service status.
## Requirements
### Requirement: Every vehicle owns upcoming-service horizons

The Garage module SHALL persist a non-negative mileage horizon and a non-negative time horizon for every vehicle. New vehicles SHALL default to a 1,000-mile horizon and a 60-day horizon unless the creation request supplies other valid values.

#### Scenario: Create a vehicle without explicit horizons
- **WHEN** a Garage vehicle is created without mileage or time horizon values
- **THEN** the vehicle stores a mileage horizon of 1,000 miles and a time horizon of 60 days

#### Scenario: Create or update a vehicle with custom horizons
- **WHEN** a user saves non-negative custom horizon values for a vehicle
- **THEN** Garage stores those values on that vehicle without changing any other vehicle

#### Scenario: Reject invalid horizons
- **WHEN** a creation or update attempts to store a negative mileage or time horizon
- **THEN** the database rejects the invalid vehicle data

### Requirement: Existing account horizons migrate without changing current behavior

The Garage schema migration SHALL copy each existing account's mileage and time horizons to every Garage vehicle owned by that account before removing the account-level horizon settings.

#### Scenario: Account has custom horizons and multiple vehicles
- **WHEN** an account with custom account-level horizons owns multiple vehicles at migration time
- **THEN** each existing vehicle receives the account's mileage and time horizon values

#### Scenario: Account has no settings row
- **WHEN** an existing vehicle has no matching account-level settings row at migration time
- **THEN** the vehicle retains the 1,000-mile and 60-day defaults

#### Scenario: Migration completes
- **WHEN** all existing vehicle horizon values have been populated
- **THEN** the obsolete account-level Garage settings table is removed so the vehicle is the sole horizon source

### Requirement: Users configure horizons per vehicle

The Garage Config view SHALL expose mileage and time horizons as vehicle fields, SHALL allow them to be set when adding a vehicle, and SHALL allow each vehicle's values to be edited independently. The view SHALL NOT expose a shared account-level upcoming-threshold control.

#### Scenario: Compare vehicle horizons
- **WHEN** a user views Garage vehicle configuration
- **THEN** the mileage and time horizons are visible with each vehicle's other fields

#### Scenario: Customize different vehicle types
- **WHEN** a user gives a bicycle a smaller mileage horizon and a car a larger mileage horizon
- **THEN** both values remain associated with their respective vehicles

#### Scenario: Disable an advance-warning dimension
- **WHEN** a user sets a vehicle's mileage or time horizon to zero
- **THEN** Garage saves zero for that dimension and does not classify a service as upcoming solely through that dimension

### Requirement: Due status uses the selected vehicle's horizons

Garage SHALL classify services as upcoming using only the selected vehicle's mileage and time horizons. Due-now and past-due classification SHALL remain independent of the upcoming horizons.

#### Scenario: Service enters one vehicle's mileage horizon
- **WHEN** a service has positive remaining mileage less than or equal to the selected vehicle's mileage horizon
- **THEN** Garage classifies the service as upcoming by mileage

#### Scenario: Service enters one vehicle's time horizon
- **WHEN** a service has a non-negative number of days until due less than or equal to the selected vehicle's time horizon
- **THEN** Garage classifies the service as upcoming by time

#### Scenario: Same remaining distance on vehicles with different horizons
- **WHEN** two vehicles have different mileage horizons and otherwise equivalent services with the same remaining mileage
- **THEN** each service's upcoming status is determined by its own vehicle's horizon

#### Scenario: Service is due or past due
- **WHEN** a service reaches zero or a negative remaining interval
- **THEN** Garage classifies it as due now or past due regardless of the vehicle's upcoming horizons

### Requirement: Due screen shows exact remaining mileage

The Garage Due screen SHALL display remaining mileage as the full comma-delimited mile count with no decimal places and SHALL NOT abbreviate thousands or millions with shortened suffixes such as `k` or `M`.

#### Scenario: Upcoming service has four-digit remaining mileage

- **WHEN** an upcoming service has 1,250 remaining miles
- **THEN** the service displays `1,250 miles left`

#### Scenario: Service has one remaining mile

- **WHEN** a service has 1 remaining mile
- **THEN** the service displays `1 mile left`

#### Scenario: Service is overdue by mileage

- **WHEN** a service is 1,250 miles overdue
- **THEN** the service displays `1,250 miles overdue`

#### Scenario: Remaining mileage contains a fractional value

- **WHEN** a calculated remaining-mile value includes a fractional component
- **THEN** the service displays the value rounded to a comma-delimited integer with no decimal places
