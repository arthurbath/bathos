## Context

Closed ordinary tasks currently remain reversibly checked for three seconds before their established settle and exit animations begin. The grace interval is controlled by one Tasks constant and covered by lifecycle tests for cancellation, undo reservation, reduced motion, failure restoration, and focus transfer.

## Goals / Non-Goals

**Goals:**

- Change only the reversible completion grace interval from three seconds to two seconds.
- Preserve all behavior before and after that interval.
- Keep timing tests aligned with the visible contract.

**Non-Goals:**

- Changing completion animation durations.
- Changing open-task deferred completion, persistence, undo, or focus behavior.
- Changing widget completion timing.

## Decisions

- Update the single `TASK_COMPLETION_GRACE_DELAY_MS` constant to 2,000 milliseconds rather than introducing a configurable setting. The user has established one desired product-wide value.
- Shift assertions that represent the end of the grace interval by exactly one second while leaving settle and exit animation assertions unchanged.

## Risks / Trade-offs

- [Risk] A shorter interval gives less time to cancel an accidental completion. -> Mitigation: two seconds still provides an explicit reversible checked state and the completion remains undoable after persistence.
- [Risk] Timing tests could accidentally absorb animation time into the grace period. -> Mitigation: retain separate assertions at the grace, settle, and exit boundaries.
