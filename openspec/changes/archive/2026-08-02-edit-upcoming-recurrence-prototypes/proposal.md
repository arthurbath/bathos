## Why

Upcoming recurrence prototypes currently expose less context than ordinary to-dos and send users directly into an oversized repeat modal for every edit. This obscures the prototype metadata that future instances will inherit and makes ordinary edits feel inconsistent with the rest of Tasks.

## What Changes

- Render the applicable second-row Area, Actionability, deadline, Notes, and Checklist metadata on dated and waiting recurrence prototypes in Upcoming.
- Let users open recurrence prototypes inline and edit their ordinary inherited metadata using the established task-drawer interaction.
- Replace the prototype drawer's Start and Deadline controls with one full-width Edit Repeat button.
- Keep cadence, reminder, and generated-instance deadline settings in an atomic Edit Repeat modal.
- Remove ordinary prototype metadata fields from the Edit Repeat modal while preserving that metadata when cadence changes are saved.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Recurrence prototypes gain ordinary summary metadata and an inline metadata editor while the repeat modal becomes cadence-only.

## Impact

- Tasks Upcoming prototype rows and their keyboard/pointer behavior.
- Recurrence prototype editing and optimistic synchronization through the existing recurrence service.
- The Tasks repeat dialog and its tests.
- No database schema, PowerSync table set, or external API changes.
