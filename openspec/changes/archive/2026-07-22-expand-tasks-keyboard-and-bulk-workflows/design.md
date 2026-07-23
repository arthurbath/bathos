## Context

Tasks already centralizes app-level keyboard capture in `TasksShell`, stores all active list records in the local PowerSync database, provides atomic bulk planning moves, and exposes autosaving editor controls. This change extends those existing seams without changing the database schema or remote APIs. The future-only Start Date invariant means “Today” is represented canonically as Anytime plus a null Start Date and a non-null day horizon.

## Goals / Non-Goals

**Goals:**

- Route every new application command through one capture-phase keyboard parser that suppresses matching browser behavior.
- Apply immediate commands to either the open task or the current multi-selection through one target-resolution path.
- Reuse atomic bulk moves where all targets share a placement and group heterogeneous horizon cycles by resulting placement.
- Provide focused, centered command surfaces for bulk date, organization, and reminder input.
- Make quick find lightweight while preserving a durable, live full-results route.

**Non-Goals:**

- Literal same-day values in the future-only Start Date column.
- Database migrations, new dependencies, or changes outside the Tasks module.
- Bulk completion, deletion, or source mutation.
- Replacing the existing full task-search indexing and route-selection logic.

## Decisions

1. **Canonical Today representation.** Cmd+T writes `destination=anytime`, `start_date=null`, and a Now/Next/Later `today_section`. This produces Today and Anytime membership without violating the persisted future-only Start Date contract.

2. **Target resolution at command time.** A command uses the selected task IDs when multi-selection has one or more records; otherwise it uses the open task. Commands that have no eligible target are safely consumed but make no mutation.

3. **Dialog ownership in the shell.** Single-task inline controls expose stable IDs for focus and opening. Multi-selection opens shell-owned dialogs so one date, organization, or reminder value can be applied consistently to every target.

4. **Repository-level duplication.** Duplication copies user-editable task content and planning/container placement into a newly identified task, while excluding immutable origin, automation idempotency, reminder, recurrence, and history identity. This avoids manufacturing false provenance.

5. **Two-tier search.** Quick find ranks substring matches across task, project, and area records and shows three combined results. Continue Search navigates to `/tasks/search?q=...`, where the query remains editable and the full task result set updates on each keystroke.

6. **Fixed bulk toolbar.** Selection controls render outside document flow near the viewport bottom. The page gains conditional bottom padding so the final task can scroll above the overlay and mobile navigation.

## Risks / Trade-offs

- [Grouped bulk horizon updates are multiple local transactions] → Group tasks by their resulting horizon and stop with an explicit error if any group fails; homogeneous moves remain one transaction.
- [Programmatic opening of native select controls is browser-dependent] → Center bulk organization in a dialog and focus the select; for an open task, focus the native selector and use the browser-supported picker API when available.
- [Quick find can become expensive with a large local corpus] → Reuse the current local projection, defer matching input, and cap the quick surface at three results while the full page owns the complete list.
- [Duplicated tasks could imply copied source history] → Copy only mutable user-facing fields and never copy typed source, automation, reminder, recurrence, or history identifiers.

## Migration Plan

Publish as a web-only Tasks release after unit, component, OpenSpec, lint, and production-build validation. No database migration or remote deployment is required. Rollback is a source release rollback because persisted data remains compatible.

## Open Questions

None.
