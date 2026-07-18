## Why

Garage currently applies one account-level mileage horizon and one account-level time horizon to every vehicle. That makes upcoming-service status unsuitable for mixed vehicle types and ages, where a bicycle may need a few hundred miles of warning while a car may need a few thousand.

## What Changes

- Store upcoming mileage and time horizons on each Garage vehicle.
- Migrate every existing vehicle to the owning account's current horizons so existing due-status behavior is preserved at migration time.
- Configure horizons as part of each vehicle rather than through a shared account-level settings card.
- Calculate upcoming service status using the selected vehicle's horizons.
- Give new vehicles the current Garage defaults when no migrated values exist.
- Remove the obsolete account-level Garage horizon settings data and application paths after migration.

## Capabilities

### New Capabilities

- `garage-vehicle-upcoming-horizons`: Defines vehicle-specific upcoming-service horizons, their configuration, migration behavior, and use in due-status calculation.

### Modified Capabilities

None.

## Impact

- **Garage module:** Vehicle types, vehicle query/mutations, configuration UI, due-status hook, and focused tests.
- **Supabase:** `garage_vehicles` gains constrained horizon columns; existing `garage_user_settings` values are copied to vehicle rows and the obsolete settings table is removed. Existing vehicle RLS continues to govern the new fields.
- **Generated API types:** Supabase table types are updated for the vehicle columns and removed settings table.
- **Shared/platform code:** No shared component, routing, auth, or cross-module behavior changes.
- **Dependencies:** No new runtime dependencies.
