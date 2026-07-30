## 1. Command and Picker Focus

- [x] 1.1 Route repeated single-task Start commands to the active Start picker while preserving existing bulk Start behavior
- [x] 1.2 Implement non-committing Inbox-through-Later and future-date focus advancement
- [x] 1.3 Page the calendar and focus the exact next date when advancement crosses a month boundary

## 2. Verification

- [x] 2.1 Add targeted tests for initial Start focus, repeated horizon advancement, and month-boundary date advancement
- [x] 2.2 Run targeted Tasks tests, TypeScript, lint, build, and strict OpenSpec validation
- [x] 2.3 Verify the rendered keyboard flow in the local Tasks application

## 3. Specification Closeout

- [x] 3.1 Keep the active change artifacts aligned with the implemented behavior and ready for later sync/archive

## 4. Mixed Navigation Correction

- [x] 4.1 Make repeated exact-date focus requests observable after manual arrow movement
- [x] 4.2 Page the shared Calendar and restore date focus when arrows enter a legal adjacent month
- [x] 4.3 Add regression coverage for previous/future month arrow paging and Arrow/Ctrl+E interleaving
- [x] 4.4 Run focused and full validation, then verify the corrected rendered keyboard flow

## 5. Direct Today Advancement

- [x] 5.1 Advance Ctrl+E from every Today horizon directly to tomorrow without changing task metadata
- [x] 5.2 Add regression coverage for Inbox, Now, Next, Later, and the unplanned Inbox fallback
