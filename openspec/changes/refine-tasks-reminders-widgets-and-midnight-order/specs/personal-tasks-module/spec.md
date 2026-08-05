## ADDED Requirements

### Requirement: Reminder intent follows active Start planning
Tasks SHALL expose and retain reminder intent only for an open present task whose Start is today through a Today horizon or whose explicit Start date is in the future.

#### Scenario: Hide Reminder before planning
- **WHEN** a task has no Start date and no Today horizon, or is planned for Someday
- **THEN** the Start picker omits the entire Reminder row, including its input, clear action, and alarm menu

#### Scenario: Explain an ineligible reminder shortcut
- **WHEN** the user invokes the reminder keyboard command on a task without a Today horizon or future Start date
- **THEN** Tasks keeps Start closed, changes no task or reminder, and shows a warning toast explaining that a start date must be set before a reminder

#### Scenario: Clear Reminder when planning becomes ineligible
- **WHEN** a task with an active reminder moves to horizon-free Anytime or Someday
- **THEN** Tasks cancels the reminder and every still-pending occurrence or delivery as part of the accepted planning change

#### Scenario: Clear an elapsed Reminder when moving to Today
- **WHEN** a future-starting task has a reminder time that has already elapsed on the owner-local current date and its Start changes to Today
- **THEN** Tasks accepts the Today planning change and cancels the elapsed reminder instead of rebinding it to a past instant

### Requirement: Reminder alerts are one-shot
Tasks SHALL retire active reminder intent after an in-app or enabled notification channel successfully triggers the alert.

#### Scenario: Retire an in-app alert
- **WHEN** a due in-app reminder is presented and its delivery is acknowledged
- **THEN** Tasks cancels the active reminder and prevents it from affecting the task again

#### Scenario: Retire an accepted Web Push alert
- **WHEN** the configured Web Push provider accepts a reminder delivery
- **THEN** Tasks cancels the active reminder and remaining scheduled deliveries for that reminder

#### Scenario: Preserve Reminder after failed delivery
- **WHEN** a reminder delivery fails before any alert channel accepts or acknowledges it
- **THEN** Tasks retains active reminder intent for the existing retry and fallback behavior

### Requirement: Midnight activation preserves displayed mixed Upcoming order
Tasks SHALL preserve the exact displayed order of ordinary tasks and recurrence prototypes from one reached Upcoming date bucket when their work enters Today Inbox, including when two rows share an Upcoming ordering key.

#### Scenario: Preserve equal-rank mixed rows
- **WHEN** ordinary tasks and recurrence prototypes in one reached Upcoming bucket share an ordering key and the visible list resolves them by stable row identity
- **THEN** their activated ordinary tasks appear in Today Inbox in that same visible sequence

#### Scenario: Keep existing Inbox work ahead
- **WHEN** a mixed Upcoming batch activates while Today Inbox already contains retained work
- **THEN** Tasks appends the complete mixed batch after retained Inbox work without changing either sequence

## REMOVED Requirements

### Requirement: Reminder-Initiated Today Planning
**Reason**: Reminder intent now depends on an existing Today horizon or future Start date, so entering a reminder must not silently create Today Inbox planning.

**Migration**: Set the task's Start before entering a reminder. Existing active reminders are retired automatically when their task no longer has eligible Start planning.
