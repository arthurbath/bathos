## Context

Tasks already aligns an opened ordinary task near the top of the usable viewport after its editor expands, but the separately rendered recurrence-prototype row does not share that behavior. Touch task action menus and drag targets also have edge cases where a scroll gesture can be mistaken for a tap and where the last task in a Today horizon loses a useful return target. Separately, the shared toast inset and switch-thumb transforms are centralized styling decisions that can be corrected without local variants.

## Goals / Non-Goals

**Goals:**

- Give ordinary tasks and recurrence prototypes the same best-effort open-row alignment.
- Give ordinary tasks and recurrence prototypes one shared drawer-motion lifecycle.
- Preserve direct prototype-to-prototype editor replacement without competing outside-dismissal work.
- Preserve native touch scrolling when a gesture begins on a task ellipsis trigger.
- Let a single dragged Today task return to its own source position even when it is the last task in its horizon.
- Position wide-screen toast stacks relative to the viewport.
- Balance the shared switch thumb against both ends of its track.
- Protect the task-row metadata line from avoidable truncation at mobile widths without reducing information available to assistive technology or wider layouts.
- Make a generic Upcoming month bucket reveal the effective day on which every row will surface, regardless of whether that day is explicit or implied.

**Non-Goals:**

- Change task ordering persistence, bucket membership rules, or multi-task drag semantics.
- Introduce a new toast system or switch variant.
- Change database, API, native-wrapper, or recurrence data behavior.

## Decisions

### Share the ordinary open-row alignment calculation

The editor expansion duration, staged mount state, delayed unmount state, and sticky-header-aware alignment helper will live in a small shared Tasks utility. Ordinary rows and recurrence prototypes will use that same lifecycle and the same grid-row, opacity, and padding transition surface. This keeps both the motion and final alignment from drifting between the two row implementations.

### Let prototype title activation own replacement

The document-level outside-pointer handler will recognize recurrence-prototype title controls as direct replacement interactions and leave them alone. The target row's activation handler will then flush and close the current prototype before opening the requested prototype through the existing serialized state transition. Ellipsis controls and unrelated outside presses retain their existing dismissal behavior.

### Treat vertical touch movement as scroll intent

Task ellipsis menus will remain normal tap targets. Their triggers will observe a touch pointer that begins on the control without preventing its default behavior. Once movement passes a small threshold and is predominantly vertical, the controlled menu closes and the pending click is suppressed. Non-modal menu presentation lets the underlying page retain its native scrolling behavior.

### Represent a same-row Today drop as a legal no-op

When exactly one Today task is being dragged, hovering above or below its own row may produce the normal drop indicator. Dropping on that indicator performs no mutation because it represents returning the task to its existing position. Self-targeting remains unavailable to multi-selection drags and outside the Today view.

### Use viewport insets for shared toast stacks

The shared desktop toast right-offset token will become a fixed viewport inset. Both Radix toasts and Sonner already consume that token, so one token change preserves parity between the systems.

### Adjust the shared switch transforms by one pixel

The unchecked thumb will translate one pixel from the left edge, and the checked thumb will translate one pixel farther right than today. Track size, thumb size, focus treatment, and semantic colors remain unchanged.

### Use mobile-only compact metadata copy

At widths below the shared `sm` breakpoint, a scheduled reminder will retain its bell but hide its visible time, while its accessible name continues to include the time. Start and Deadline values that render as calendar dates will use unpadded numeric month-day copy such as `8-31`. Nearby signed Deadline offsets will use `d` in place of `day` or `days`, such as `1d` and `-1d`. Tablet and desktop copy, semantic color, metadata order, and full accessible labels remain unchanged.

### Derive month-bucket Start metadata from the Upcoming projection

Ordinary tasks will use the same controlling date that places them in Upcoming: a future explicit Start takes precedence, while a future Deadline supplies the implicit Start when no future explicit Start exists. Calendar recurrence prototypes will use their scheduled occurrence date. Start metadata appears only when that effective date belongs to an Upcoming `month` group, so nearby date-specific buckets retain their nonredundant rows. Ordinary tasks and recurrence prototypes share one Start metadata component to keep iconography, responsive copy, and accessibility wording identical.

## Risks / Trade-offs

- A very short touch move may still be interpreted as a tap. The movement threshold deliberately favors normal tapping until the gesture clearly becomes a scroll.
- Prototype title controls need the same explicit direct-replacement marker as ordinary task title controls so the outside-dismissal listener cannot race their activation.
- The recurrence row aligns after a fixed expansion interval, matching ordinary rows. Material future animation changes must update the shared duration rather than one row locally.
- A closing editor remains mounted but inert until the shared collapse interval finishes, matching ordinary to-do behavior and avoiding an abrupt disappearance.
- A self-target drop indicator communicates a valid return point but produces no persistence call. Tests must protect that intentional no-op.
- Compact mobile copy intentionally favors horizontal fit over natural-language date wording; full wording remains available to assistive technology and at wider breakpoints.
- Calling a deadline-only task's controlling date Start metadata is intentional: it exposes the implicit day on which that task will enter Today without mutating or misrepresenting the stored `start_date` field.

## Migration Plan

No data migration or rollout ordering is required. The change can be reverted by restoring the prior frontend interaction handlers and shared CSS transforms.
