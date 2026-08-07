## Context

The shared `getToastDurationMs` utility estimates title and description line counts and currently multiplies every line by one second. All shared toasts pass through this utility unless their caller supplies an explicit duration.

## Goals / Non-Goals

**Goals:**

- Give every automatically timed toast a two-second first-line duration.
- Add 1.5 seconds for every estimated line after the first.
- Preserve line estimation, explicit durations, and renderer-owned dismissal behavior.

**Non-Goals:**

- Change toast layout, placement, stacking, animation, or wording.
- Change persistent or explicitly timed reminder toasts.

## Decisions

- Keep the existing line estimator and replace the multiplier formula with `2,000 + max(0, lines - 1) * 1,500`. This directly models a two-second base and a 1.5-second increment for each additional line.
- Treat toasts without readable text as one line for timing, preserving a finite minimum rather than creating a special zero-content duration.
- Continue honoring caller-supplied durations at the shared renderer boundary.

## Risks / Trade-offs

- [Risk] Long toasts remain visible substantially longer. → Duration still scales predictably with estimated content and the user can dismiss a toast immediately.
- [Risk] A formula change could unintentionally alter persistent reminders. → Retain focused renderer coverage proving explicit durations bypass automatic calculation.
