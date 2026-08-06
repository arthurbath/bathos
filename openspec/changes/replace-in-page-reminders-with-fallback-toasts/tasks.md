## 1. Specification and Presentation Policy

- [x] 1.1 Define notification-aware fallback reminder presentation and Tasks-only scope.
- [x] 1.2 Add a forward-compatible native notification-enabled capability reader.

## 2. Shared Toast Infrastructure

- [x] 2.1 Add the semantic info toast variant.
- [x] 2.2 Allow simultaneous toasts to stack without eviction.
- [x] 2.3 Honor explicit persistent durations and compose caller dismissal callbacks.

## 3. Tasks Reminder Integration

- [x] 3.1 Remove the in-page Due Reminders panel.
- [x] 3.2 Present each due reminder as a persistent info toast with bell-prefixed Reminder title and task-summary body.
- [x] 3.3 Suppress native or browser fallback presentation without acknowledgement and acknowledge manually dismissed fallback deliveries.
- [x] 3.4 Dismiss reminder toasts outside the mounted Tasks surface and preserve retryable acknowledgement failures.

## 4. Validation

- [x] 4.1 Add shared toast reducer, renderer, and semantic variant tests.
- [x] 4.2 Add Tasks integration tests for presentation, stacking, persistence, dismissal, browser suppression, native suppression, and failure retry.
- [x] 4.3 Run focused tests, lint, build, and strict OpenSpec validation.

## 5. Blocked-surface Fallback Regression

- [x] 5.1 Preserve in-app claim eligibility after another Web Push target reports provider acceptance.
- [x] 5.2 Acknowledge persistent fallback toasts only after manual dismissal.
- [x] 5.3 Add frontend and database regression coverage for denied surfaces and cross-target provider acceptance.
- [x] 5.4 Verify the blocked settings state in the running app and the fallback presentation behavior in the rendered integration test.
