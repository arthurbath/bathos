## Context

Tasks recurrence revisions currently use `start_date` as a cadence anchor even though deadline-bearing schedules interpret that anchor as the generated Deadline and subtract `deadline_offset_days` to obtain Start. The UI mirrors that historical model with conditional Next Deadline/Next Start labels and several mutually exclusive monthly/yearly shape controls. Production contains both ordinary lead-time schedules and date-significant birthday/holiday schedules whose controlling Deadline sequence must remain unchanged.

The recurrence stack crosses React preview logic, PowerSync rows, generated Supabase types, revision snapshots, database evaluators and activators, reminders, export/restore, and cached clients. The safest rollout is additive and compatibility-first: preserve legacy rows and APIs, teach every reader both models, then publish the new editor.

## Goals / Non-Goals

**Goals:**

- Make the generated-task deadline choice the first question after cadence, then present the Start- or Deadline-based anchor that matches the selected basis.
- Preserve every existing recurrence projection and occurrence identity during migration, including all birthday and holiday schedules.
- Replace fragmented monthly/yearly rule shapes with a canonical version-2 ordinal/day-type model and multi-month yearly rules.
- Keep TypeScript preview and PostgreSQL authority behavior identical for the complete Gregorian cycle.
- Make edge-to-edge shared modals square while retaining rounded corners for inset modals.

**Non-Goals:**

- Changing already generated ordinary task instances.
- Converting existing Deadline-based schedules to Start basis automatically.
- Removing legacy rule-config readers or legacy RPCs while cached clients may remain active.
- Reintroducing recurrence end controls that are not currently exposed by the Tasks editor.

## Decisions

### Store an immutable date basis on every recurrence revision

`tasks_recurrence_revisions.date_basis` is constrained to `start` or `deadline`. Existing revisions with `deadline_offset_days` become Deadline-based; all others become Start-based. New revisions are immutable, so an intentional basis change creates another revision.

Alternative considered: reinterpret every existing schedule as Start-based. Rejected because lead-time schedules such as birthdays and floating holidays cannot preserve their meaningful Deadline sequence under a Start-anchored ordinal rule.

### Keep the stored recurrence anchor and expose basis-specific anchor entry

The existing revision `start_date` column remains the stored cadence anchor for compatibility. In the editor, no-deadline and Start-basis schedules enter Next Start, while Deadline-basis schedules enter Next Deadline. The client derives `next_start_date` from the entered anchor before calling version-2 RPCs with `date_basis` and `deadline_after_start_days`. The RPC then derives the stored anchor: Start for Start basis, or Start plus the offset for Deadline basis. Responses expose enough revision data for clients to derive the same Start/Deadline pair.

The date picker treats the entered Start or Deadline as the cadence anchor. Calendar schedules disable dates that do not satisfy the selected weekday, monthly ordinal/day type, or yearly month and ordinal/day type. The chosen anchor establishes the phase for interval schedules such as every seven weeks, so no additional phase restriction exists before the first anchor is chosen. After-completion schedules impose no weekday or ordinal restriction.

Legacy RPCs remain callable. They continue creating/editing Deadline-style revisions under their historical contract. A legacy edit targeting a Start-basis revision fails with a refresh-required error rather than silently reinterpreting dates.

### Version canonical rule configuration inside JSON

New and edited rules save `version: 2`. Monthly uses `{ version: 2, position, day_type }`; yearly uses `{ version: 2, months, position, day_type }`; weekly retains weekdays but is evaluated against the selected basis. `position` is `last` or a positive integer. `day_type` is `day`, `weekday`, `weekend_day`, or an ISO weekday token.

Legacy shapes remain readable and evaluate exactly as before. Version 2 named weekday, weekday, and weekend-day rules skip an eligible month if the ordinal does not exist. Numbered Day rules clamp to month end. Yearly evaluation emits every selected month in calendar order for each eligible interval year.

### Use basis-aware generated pairs and logical keys

For Start basis, anchor is Start and Deadline is anchor plus offset. For Deadline basis, anchor is Deadline and Start is anchor minus offset. New Start-basis occurrence keys use `calendar-v2-start:<anchor>` so they cannot collide with historical `calendar:<anchor>` identities. Existing rows and keys are not rewritten.

Creating a recurrence adopts the source ordinary task as the first occurrence for both future and reached Starts. The transaction overwrites that task's prior Start and Deadline with the accepted first pair, links it to the new definition and revision, and advances a calendar prototype beyond the adopted anchor. A reached Start is retained as provenance while Today Inbox is assigned under the authoritative activation context. Editing an existing prototype to a pair whose Start is today evaluates that accepted revision inside the edit transaction, so the ordinary instance exists before the save returns and idempotent logical keys prevent duplicate same-day instances.

### Protect production date-significant schedules with a private manifest

The production preflight records owner-scoped definitions, current revisions, occurrence identities, status/prototype placement, and at least 50 projected Start/Deadline pairs. A private, uncommitted manifest explicitly lists stable recurrence IDs for every birthday, Christmas, Mother’s Day, and other identified holidays. Migration preconditions require each protected revision to remain Deadline-based and its projected Deadline sequence to remain identical.

Name matching is used only to help build and audit the private manifest. Runtime behavior and migration assertions use stable IDs, avoiding fragile classification by mutable Summary.

### Derive recurrence names from prototype Summary

The v2 create/edit path does not accept an independently editable recurrence name. The database derives the definition name from the normalized prototype snapshot Summary. The editor shows that Summary as static context and uses `New Task` for a blank Summary.

### Implement responsive modal geometry in shared primitives

Shared Dialog and AlertDialog content use square, borderless edges at the existing edge-to-edge mobile breakpoint and rounded bordered corners when inset. Width-constrained desktop modals retain viewport margins, so rounded corners never meet a viewport edge. Popovers, sheets, and native quick-entry window chrome are unaffected.

### Present date basis as part of the date sentence

The repeat editor expresses basis through the generated-date sentence instead of a separate Schedule Based On field. Without deadlines the sentence is Next Starts on plus its date. With deadlines, Next is followed by a Starts or Due Select, the lowercase preposition on, and the corresponding anchor date. The offset sentence then reads With Deadlines N Days After for Start basis or And Starts N Days Prior for Deadline basis. The stored basis and derivation rules remain unchanged.

Reminder entry reuses the visual and menu paradigms of the Start picker reminder control. Preview dates use the stable `YYYY Mon D` display, independent of relative-date labels.

The repeat-modal content body uses equal top and bottom padding so its first and last controls retain the same separation from the surrounding header and footer. Committing an empty or unparseable reminder-time value disables reminders and removes the now-inapplicable field instead of restoring a previous value.

### Present scheduled cadence as one phrasal concept

The repeat type and cadence controls read as one compact Mad Libs-style phrase. The first line is `Repeat` plus an `On a Schedule` or `After Completion` Select. Calendar cadence continues with `Every` plus interval and frequency. Weekly schedules add `On` before the weekday buttons, monthly schedules read `On the` before ordinal and day type, and yearly schedules read `In` before the month multi-select followed by `On the` before ordinal and day type. Lines within the cadence phrase and within the two-line deadline phrase use tighter spacing than the larger separation between major form concepts.

Selected weekdays use the filled Success treatment. All seven weekday buttons divide the available weekday-row width evenly at every breakpoint, including when tablet-and-wider labels use three-letter abbreviations. The yearly month trigger summarizes one through seven selected months as comma-separated three-letter names and shortens selections of eight or more after the seventh name with an ellipsis while retaining full month names in the menu.

The interval-count input retains its raw editing string while focused so the user can replace its final digit without fighting an eager minimum-value clamp. Domain preview and save logic consume a normalized positive whole number, and blur writes that normalized value back to the field, defaulting empty, fractional, nonnumeric, or nonpositive input to `1`.

The Tasks Have Deadlines row uses the same major-concept separation beneath it as above it so the toggle feels centered between the cadence phrase and generated-date phrase.

## Risks / Trade-offs

- [Risk] Client and database recurrence evaluators diverge on rare dates → Share exhaustive fixtures, add a generated 400-year parity corpus, and compare output in Vitest and pgTAP.
- [Risk] Cached clients reinterpret a new Start-basis revision → Preserve legacy RPC signatures and explicitly reject legacy edits of Start-basis rows with a refresh-required error.
- [Risk] A production migration changes a meaningful holiday cadence → Require exact preflight counts, a stable-ID protected manifest, 50-pair before/after comparison, and transactional abort assertions.
- [Risk] Adding a synchronized column breaks local schemas → Update PowerSync schema, generated types, hydration, portability, and schema tests in the same release.
- [Risk] Multi-month yearly rules create ambiguous interval semantics → Interval applies to eligible years; every selected month in each eligible year emits in calendar order.
- [Risk] Rollback after clients create Start-basis revisions → Database compatibility must remain deployed. Roll back only the web client while keeping additive schema/functions until all Start-basis data has been explicitly migrated or the feature is retired.
- [Risk] A cadence save adopts or generates the first pair twice → Perform source adoption and same-day edit evaluation in the versioned database transaction and rely on mutation receipts plus recurrence logical-key uniqueness for idempotency.

## Migration Plan

1. Preserve the unrelated checklist undo work without editing or staging it as part of this change.
2. Refresh the private production backup and generate the owner-scoped preflight and protected recurrence manifests.
3. Deploy an additive compatibility migration containing `date_basis`, v2 evaluators, v2 RPCs, legacy guards, and portability updates.
4. Backfill existing deadline-bearing revisions to Deadline basis and all other existing revisions to Start basis inside the same transaction, without rewriting dates, rules, occurrences, keys, or task instances.
5. Run migration assertions and independent post-migration readback. Compare every recorded projection and identity.
6. Publish the new web client only after the database readback succeeds.
7. Monitor Supabase function/database logs and Sentry recurrence events.

Rollback before client publication is a database restore or forward migration that removes only unused additive functions/columns. After Start-basis revisions exist, keep the compatibility schema and roll back the client only.

## Open Questions

None. Missing ordinal behavior is skip-month, existing date-significant schedules remain Deadline-based, and new schedules default Start-based.
