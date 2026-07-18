## ADDED Requirements

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
