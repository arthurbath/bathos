## 1. Reminder Eligibility and Presentation

- [x] 1.1 Add one shared client predicate for reminder-eligible Start planning
- [x] 1.2 Hide the Start-picker Reminder row for unplanned and Someday tasks
- [x] 1.3 Make Ctrl+Y show a warning toast without opening Start when reminder planning is ineligible
- [x] 1.4 Add focused client tests for Reminder visibility, shortcut feedback, and eligible planning

## 2. Authoritative Reminder Lifecycle

- [x] 2.1 Add a forward migration that cancels reminders when Start becomes ineligible or an elapsed time is rebound to Today
- [x] 2.2 Retire reminder intent after in-app acknowledgement or accepted Web Push delivery while preserving failed-delivery retries
- [x] 2.3 Update reminder projections optimistically after an alert retires the reminder
- [x] 2.4 Add database and integration regression coverage for planning changes and one-shot alert delivery

## 3. Midnight Ordering

- [x] 3.1 Make activation use the displayed mixed row identity when equal Upcoming keys tie
- [x] 3.2 Add pgTAP coverage for equal-key ordinary tasks and recurrence prototypes entering Today Inbox

## 4. Native Presentation

- [x] 4.1 Draw the Inbox widget marker with the shared horizon stroke system used by the clock markers
- [x] 4.2 Apply the darker-green fill and lighter-green outline to the Watch capture control
- [x] 4.3 Compile the shared widget and Watch targets with both visual contracts

## 5. Verification

- [x] 5.1 Run focused Tasks, reminder dispatcher, native, and database tests
- [x] 5.2 Run lint, build, OpenSpec validation, and review the complete diff for unrelated changes
