## Context

Tasks currently has two related date presentation paths. The Start field owns a custom summary, while Deadline uses the shared `DatePickerField` trigger's fixed calendar format. Collapsed task rows use the Tasks domain relative-date formatter and a fixed 64-pixel header. This creates inconsistent nearby-date copy and leaves routine lists looser than desired.

## Goals / Non-Goals

**Goals:**

- Give Start and Deadline controls the same owner-local Yesterday, Today, and Tomorrow vocabulary.
- Keep task-row relative wording compact and numeric.
- Emphasize due-today and past-due metadata with the existing semantic destructive token.
- Reduce the collapsed task header to a denser uniform layout without shrinking its interactive controls below their current size.

**Non-Goals:**

- Change date selection, persistence, planning, reminder, or sorting behavior.
- Change project, area, Done, deleted-record, or editor-form layouts.
- Introduce new colors, dependencies, data migrations, or responsive breakpoints.

## Decisions

1. Keep two intentional date-label contexts. Input triggers use a dedicated Tasks formatter that maps only the immediate three-day window to Yesterday, Today, and Tomorrow and otherwise uses the existing short calendar-date format. Task-row metadata retains directional language such as `1 day ago`, `In 2 days`, and `2 days left`.
2. Let the shared `DatePickerField` accept an optional already-formatted display value. This avoids teaching a shared UI primitive about Tasks planning dates while preserving its default formatting for every other caller.
3. Determine urgent Due styling from the stable owner-local calendar strings: a valid deadline at or before `planningDate` receives `text-destructive`. The accessible Due label keeps the same complete wording.
4. Reduce only the canonical collapsed task-row header from 64 to 56 pixels, reduce its horizontal padding and internal gaps, and tighten the metadata offset. Expanded editor content remains outside that fixed header and is unaffected.

## Risks / Trade-offs

- [A custom display override could drift from the actual selected value] -> Derive it directly from the same controlled date value and cover updates in component tests.
- [Dense rows could crowd touch controls] -> Preserve the existing 40-pixel checkbox and action controls inside the 56-pixel row.
- [Lexicographic deadline comparison could misclassify malformed dates] -> Apply urgent styling only to values accepted by the existing calendar-date validator.
