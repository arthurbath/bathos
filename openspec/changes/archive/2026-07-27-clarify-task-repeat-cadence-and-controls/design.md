## Context

The repeat dialog currently stores monthly rules in the existing JSON `rule_config`, but derives either a month day or ordinal weekday from the selected schedule date. The client preview and PostgreSQL recurrence evaluator implement the same two implicit modes. The dialog also contains four native `<select>` controls with local styling instead of the shared Radix-based BathOS Select.

Task-row metadata already derives optional indicators from task content and checklist projection state, with canonical icons centralized in `taskIconography.ts`.

## Goals / Non-Goals

**Goals:**

- Make the saved monthly cadence explicit and expressive enough for a numbered date, last calendar day, ordinal weekday, and ordinal weekday/weekend-day group.
- Keep client preview dates and authoritative server dates identical.
- Preview exactly three next instances and expose both Start and Deadline when the recurrence is Deadline-driven.
- Use shared Select controls throughout the repeat dialog and make that choice the default contract for new ordinary dropdowns.
- Add a quiet canonical Notes-presence indicator immediately before Checklist.

**Non-Goals:**

- Replacing the remaining legacy native selects outside the repeat dialog.
- Changing recurrence table shape, PowerSync publication membership, or recurrence identity.
- Adding arbitrary recurrence expressions or natural-language rule parsing.

## Decisions

### Extend the JSON rule configuration without changing table shape

Monthly rules retain `day_of_month` and `ordinal_weekday`, and add `last_day` plus `ordinal_day_type` with `day_type` equal to `weekday` or `weekend_day`. This keeps revisions forward-compatible and avoids adding sparse recurrence columns.

Alternative considered: encode last-day and weekend-day concepts as sentinel numeric weekdays or month days. Rejected because sentinel values make persisted rules opaque and validation fragile.

### Use one explicit monthly pattern selector followed by pattern-specific controls

The dialog first asks whether the rule targets a Date, Weekday Position, or Day-Type Position. Date offers 1 through 31 plus Last Day. Weekday Position offers First through Fifth or Last plus a named weekday. Day-Type Position offers the same ordinal choices plus Weekday or Weekend Day.

The current recurrence anchor supplies initial defaults only. Once displayed, every controlling value is visible and independently editable.

### Treat ordinal day types as ordered matching days

For positive ordinals, the evaluator counts calendar days satisfying the selected type from the beginning of each month. For Last, it scans backward. Thus Last Weekend Day means the final Saturday or Sunday in the month, and Last Weekday means the final Monday through Friday.

### Derive paired preview dates from the schedule anchor

The recurrence engine continues to return schedule dates. When Add Deadlines is active, each schedule date is labeled Deadline and the corresponding Start is calculated by subtracting the configured offset. The dialog displays three paired instances. Otherwise it displays three Start instances.

### Centralize Notes iconography

`NotepadText` becomes the canonical `Notes` task icon. A task row renders it when Notes contain at least one character and positions it immediately before the checklist indicator.

### Make shared Select the default dropdown primitive

The repeat dialog uses `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem`. The project agent instructions, human style guide, and form-control specification explicitly prohibit new native or locally styled ordinary selects unless a documented specialized exception applies.

## Risks / Trade-offs

- **Older clients encounter new monthly rule values** -> Existing persisted revisions remain valid; rollout must publish the web release and database evaluator together before users create the new variants.
- **A fifth ordinal weekday does not occur every month** -> The evaluator preserves the existing behavior of omitting a month whose requested fifth weekday does not exist, and previews expose that outcome before save.
- **Native-select audit invites unrelated scope** -> Record exact remaining production locations, but make no replacement outside `TaskRepeatDialog`.
- **Preview and server logic drift** -> Add matching client and database tests for last day, ordinal weekday, weekday group, and weekend-day group.

## Migration Plan

1. Add a forward-only migration replacing `tasks_private.recurrence_date_for_step` with support for the two new monthly kinds.
2. Publish the matching web code only after the migration is approved and applied in production.
3. Rollback by reverting the web UI first so no new rules can be created, then restoring the previous evaluator only after confirming no saved revisions use the new kinds.

## Open Questions

None. The user supplied all required cadence examples and explicitly limited the legacy-control replacement scope.
