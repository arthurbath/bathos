## Context

Garage stores `upcoming_miles_default` and `upcoming_days_default` in one `garage_user_settings` row per account. `useGarageDue` passes those values into the due calculation for whichever vehicle is selected, and the Config view edits them in a standalone account-level card. This assumes all vehicles need the same warning windows.

The vehicle table already owns the other inputs used by due calculation, is protected by owner-scoped RLS, and is exposed through both the web module and the generic Garage MCP vehicle actions. Moving the horizons onto `garage_vehicles` keeps the complete due-status context with the vehicle without introducing a new relation or authorization path.

## Goals / Non-Goals

**Goals:**

- Give every vehicle independent mileage and time horizons for upcoming-service status.
- Preserve each existing account's current status behavior at migration time.
- Keep valid defaults for vehicles created through the web module, MCP, or direct authenticated API paths.
- Make the vehicle the only source of horizon values used by due calculations.

**Non-Goals:**

- Changing service cadence, due/past-due rules, or how time-based due dates are calculated.
- Inferring horizons automatically from vehicle type or age.
- Adding a new vehicle-type taxonomy.
- Changing Garage routing, authentication, or RLS ownership rules.

## Decisions

### Store non-null horizon columns on `garage_vehicles`

Add `upcoming_miles integer NOT NULL DEFAULT 1000 CHECK (upcoming_miles >= 0)` and `upcoming_days integer NOT NULL DEFAULT 60 CHECK (upcoming_days >= 0)`. Non-null values keep due classification deterministic, while database defaults protect creation paths outside the React application.

Alternative considered: a separate per-vehicle settings table. That would add a join, a second RLS surface, and missing-row fallback behavior for two small fields that are intrinsic to vehicle due status.

### Backfill from account settings before removing them

The migration will add the vehicle columns, copy matching `garage_user_settings` values to every vehicle owned by that user, and then drop `garage_user_settings`. Vehicles whose owners have no settings row retain the established 1,000-mile and 60-day defaults.

Alternative considered: retain the account-level row as a fallback. That would leave two competing sources of truth and make future vehicle creation dependent on a legacy account object.

### Configure horizons within the Vehicles grid and add form

Remove the standalone thresholds card. Add editable `Upcoming Miles` and `Upcoming Months` columns to the Vehicles DataGrid, and include the same fields in the Add Vehicle modal. The UI continues to express time in months for continuity, converting months to whole days using the existing 30-day convention. Both fields accept zero, which disables the corresponding advance-warning window without changing due-now or past-due classification.

Alternative considered: add a separate settings modal per vehicle. Inline vehicle columns make differences across vehicles visible and comparable, and match the existing configuration grid's editing model.

### Make due calculation consume vehicle horizons directly

Remove the settings argument from `useGarageDue` and the separate defaults input from `computeDueItems`. Classification will receive the selected vehicle's horizons, preventing an account-level value from being accidentally reintroduced at a call site.

## Risks / Trade-offs

- **A failed backfill could change existing upcoming status** → Perform the copy in the same transactional migration before dropping the settings table, with database defaults covering users without a settings row.
- **Dropping account settings makes rollback lossy after vehicles diverge** → Roll back application code only together with a deliberate data migration that selects an account value; retain repository history as the schema rollback source. A simple database rollback cannot represent multiple vehicle-specific values in one account row.
- **Months-to-days conversion can round fractional input** → Preserve the existing conversion rule and round to whole days before persistence.
- **More grid columns increase horizontal width** → Use the shared resizable DataGrid behavior and width persistence; mobile users retain horizontal scrolling.

## Migration Plan

1. Add constrained, defaulted horizon columns to `garage_vehicles`.
2. Backfill both columns from `garage_user_settings` by `user_id`.
3. Drop `garage_user_settings` after the copy succeeds.
4. Deploy application code that reads and edits only vehicle-level values in the same release.
5. Verify migrated values, defaults, RLS-preserving updates, and due classification with targeted tests and database migration validation.

## Open Questions

None.
