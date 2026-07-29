## 1. Shared Input Group

- [x] 1.1 Add the shared shadcn Input Group primitive adapted to BathOS input dimensions, semantic tokens, decoration support, and focus treatment

## 2. Reminder Hour Domain

- [x] 2.1 Add a pure owner-time-zone-aware helper for chronological legal whole-hour reminder options
- [x] 2.2 Cover future, Today, unplanned, final-hour, and invalid-time-zone option derivation

## 3. Start Picker Interaction

- [x] 3.1 Compose Reminder with its bell decoration and right-side alarm-clock input-group button
- [x] 3.2 Add the scrolling grouped hour menu and route direct selections through the existing reminder mutation path without closing Start
- [x] 3.3 Extend spatial focus navigation between Reminder, the alarm button, calendar, and footer while isolating nested-menu keyboard behavior
- [x] 3.4 Keep option availability and the disabled state current while Start remains open

## 4. Verification

- [x] 4.1 Add focused Start-picker tests for menu availability, exhausted Today state, pointer selection, and keyboard interaction
- [x] 4.2 Run focused unit and interaction tests, Tasks typecheck, lint, build, and strict OpenSpec validation
  - Tasks typecheck was run and remains blocked by pre-existing `recurrence_superseded_at` omissions in unrelated recurrence work in the shared dirty worktree. The focused lint, tests, production build, and strict OpenSpec validation all pass.
- [x] 4.3 Verify the rendered Start reminder input group, menu scrolling, and keyboard path in the local app
