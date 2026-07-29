## Context

BathOS date fields share a React DayPicker-based `Calendar` primitive with custom day rendering, month/year switching, paging limits, and spatial keyboard navigation. The primitive currently accepts DayPicker's default Sunday-first and variable-week layout, and a disabled previous-month button becomes invisible at the minimum month. When keyboard activation causes that transition, the browser can leave focus on the disabled, visually absent button.

## Goals / Non-Goals

**Goals:**

- Establish Monday as the shared first weekday.
- Keep the day view at six week rows for every month.
- Preserve adjacent-month dates in unused cells and all existing minimum-date rules.
- Move keyboard focus to the month-and-year control when backward paging reaches the minimum month.
- Apply the behavior through the shared primitive to Tasks, Garage, Snake, and future consumers.

**Non-Goals:**

- Change date storage, parsing, time-zone behavior, selection eligibility, or month-picker layout.
- Add a new calendar dependency or per-module calendar behavior.
- Move focus after pointer-based paging.

## Decisions

1. Configure Monday-first ordering and fixed weeks at the shared `Calendar` boundary. This keeps every consumer consistent and avoids duplicating DayPicker options in module code. A consumer-by-consumer configuration was rejected because it would allow behavior drift.
2. Use DayPicker's fixed-week rendering with outside days enabled. This produces exactly six seven-day rows while retaining the existing adjacent-month visual treatment and hit targets. A CSS-only minimum height was rejected because it would stabilize only the outer box, not provide the extra calendar row or stable internal geometry.
3. Detect backward paging that began while the previous-month control held keyboard focus, then restore focus after the month rerender. If the updated previous control is disabled at the minimum month, focus goes to the centered caption. Otherwise focus remains on the renewed previous control so repeated paging still works. Moving focus for every month change was rejected because it would disrupt pointer users and controlled programmatic month changes.

## Risks / Trade-offs

- [Risk] Six week rows expose more adjacent-month dates than some months did previously. → Mitigation: preserve the existing outside-day muted styling and selection semantics.
- [Risk] React DayPicker replaces navigation buttons during month changes. → Mitigation: resolve the post-render target from the calendar root rather than retaining a stale element reference.
- [Risk] A controlled Calendar consumer might update its month asynchronously. → Mitigation: tie the pending focus restoration to the rendered display month and clear it after one post-render attempt.
