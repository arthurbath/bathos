## 1. Search Result Model and Navigation

- [x] 1.1 Build one ranked full-search result model that includes ordinary tasks and active recurrence prototypes with their natural route and native row variant.
- [x] 1.2 Add roving keyboard focus from the Search input through results and back, with pointer and Return activation navigating to the native list destination.

## 2. Canonical Row Integration

- [x] 2.1 Render ordinary Search results through the canonical task row with natural-list metadata, reminders, lifecycle controls, and ellipsis actions while preventing inline drawers.
- [x] 2.2 Render dated and waiting recurrence Search results through their canonical Upcoming prototype rows and native ellipsis actions.
- [x] 2.3 Keep Search rows non-draggable and non-selectable, and bypass Tasks Control-key commands while Search is active.

## 3. Verification

- [x] 3.1 Add component coverage for Anytime, Upcoming, Someday, Done, and recurrence row parity plus native-list activation.
- [x] 3.2 Add keyboard coverage for query-to-results traversal, Return activation, and prohibited Search interactions.
- [x] 3.3 Run targeted Tasks tests, lint/build checks, and OpenSpec validation.
