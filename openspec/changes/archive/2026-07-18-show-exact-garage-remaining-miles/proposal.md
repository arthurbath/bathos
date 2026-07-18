## Why

Garage abbreviates every remaining-mile value to a rounded number of thousands, which hides the actual distance and makes a bicycle's smaller upcoming horizon appear inconsistent with the Due screen. Remaining mileage needs to stay precise enough for vehicle-specific horizons to be understandable.

## What Changes

- Display the complete remaining-mile count on Garage's Due and Upcoming service cards.
- Format remaining mileage as a comma-delimited integer with no decimal places.
- Stop using abbreviated `k` or `M` mileage labels on the Due screen.
- Preserve the existing due and upcoming classification logic and singular/plural wording.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `garage-vehicle-upcoming-horizons`: Define exact remaining-mile presentation for services classified with vehicle-specific horizons.

## Impact

- Garage Due view mileage-status formatting and focused component tests.
- No database, API, routing, dependency, or cross-module changes.
