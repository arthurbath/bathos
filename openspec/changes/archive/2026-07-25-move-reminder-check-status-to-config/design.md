## Context

Every connected Tasks client claims due in-app reminder deliveries on mount, once per minute, and whenever its tab becomes visible. A failed claim currently produces a prominent list-level warning with a manual Retry action even though the next automatic check is imminent. Config already centralizes Browser Reminders and Synchronization diagnostics.

## Goals / Non-Goals

**Goals:**

- Let transient in-app reminder checks recover automatically without interrupting task lists.
- Keep the latest reminder-check health visible in Config for deliberate diagnosis.
- Reuse the existing Synchronization Details surface and fixed content-free status language.
- Preserve the current polling, timeout, schedule-preservation, and due-item behavior.

**Non-Goals:**

- Changing Web Push, reminder scheduling, acknowledgement, RPCs, Cron, or database state.
- Adding persistent reminder incident history or a manual recheck control.

## Decisions

- Remove `TaskReminderClaimFailure` from all list routes rather than hiding it conditionally. `useTaskReminders` continues to retain `claimError` and clear it after the next successful automatic claim.
- Pass only the boolean latest-check condition into the Config-only Synchronization Details trigger. The dialog will render `In-App Reminders` as `Available` when the latest claim did not fail and `Delayed` while `claimError` is present.
- Do not expose the underlying error or a manual action. The diagnostic value describes the user-visible capability, while the one-minute polling loop owns recovery.
- Keep the status out of the global synchronization trigger because the user asked for deliberate Config diagnostics, not another persistent warning surface.

## Risks / Trade-offs

- **Risk:** A failure can persist for up to one minute without visible notice during ordinary work.
  **Mitigation:** That delay is accepted by design, and Config exposes the current condition.
- **Risk:** `Available` reflects the latest completed check rather than proving future delivery.
  **Mitigation:** Use capability language rather than claiming that every reminder was delivered.
