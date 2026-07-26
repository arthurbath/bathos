## Context

The Start picker already owns the canonical reminder-time parser and display formatter, but the bulk reminder dialog bypasses them with a native `type="time"` input. The canonical spec also requires two Return presses for a changed reminder value, while the current Start-picker handler saves and closes after the first Return.

## Goals / Non-Goals

**Goals:**

- Give single-task and bulk reminder entry the same text-input appearance and accepted shorthand grammar.
- Keep parser and time-zone resolution logic in the existing Tasks domain utility.
- Make a changed value normalize on the first Return and submit or close only on the second Return.
- Preserve mouse-accessible bulk submission and the existing `Not allowed.` feedback.

**Non-Goals:**

- Changing reminder eligibility, scheduling, persistence, or notification delivery.
- Adding reminder dates, recurrence, time-zone controls, or repeated-time choices.
- Changing Start planning for bulk-selected tasks.

## Decisions

### Reuse the domain parser rather than native time-input validation

`TaskBulkCommandDialog` will call `resolveTaskReminderTimeInput` and display its normalized `displayTime`. This keeps accepted inputs and canonical `HH:mm` persistence identical to the Start picker. A native time input cannot accept strings such as `1:3p` or `130p`, so styling it alone would not satisfy the interaction contract.

### Resolve mixed bulk selections against Today when any eligible target is Today

The dialog will receive whether any eligible selected task uses a Today horizon plus the authoritative planning time zone. If any target is Today, an elapsed time is rejected for the whole bulk operation rather than partially applying a reminder. Future-only selections continue accepting any valid parsed time.

### Track a normalized confirmation separately from visible input

Changing text clears the confirmed canonical value. The first Return parses and replaces the visible value with normalized text while retaining the dialog. A second Return on the unchanged normalized text invokes the consumer action. Clicking Apply parses and submits in one pointer action so the explicit button remains usable without requiring an artificial double click.

### Bring the Start picker back into conformance

The Start picker will retain its existing autosave-on-normalization behavior, but it will no longer close after that first successful Return. The next Return on the unchanged normalized display closes the picker. This implements the already-durable specification without changing reminder persistence.

## Risks / Trade-offs

- [Risk] A mixed Today and future bulk selection could accept a time for future tasks but not Today. → Mitigation: validate the shared time against Today and apply atomically only after it is valid for every target.
- [Risk] Async reminder saving could receive repeated submissions. → Mitigation: retain the existing bulk pending state and disable the input and Apply action while persistence runs.
- [Risk] Blur after the first Return could trigger an unintended second action. → Mitigation: bulk submission remains Return- or button-owned; blur does not submit.
