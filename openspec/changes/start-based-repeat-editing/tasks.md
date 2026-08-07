## 1. Preflight and contracts

- [x] 1.1 Preserve the unrelated checklist undo work and validate the new OpenSpec artifacts
- [x] 1.2 Refresh a private production backup and generate exact owner-scoped recurrence and protected birthday/holiday manifests

## 2. Recurrence domain and persistence

- [x] 2.1 Add version-2 recurrence rule types, legacy normalization, basis-aware pair derivation, and exhaustive domain tests
- [x] 2.2 Create the additive Supabase migration with date basis, canonical evaluators, v2 RPCs, legacy guards, lifecycle integration, portability integration, and protected migration assertions
- [x] 2.3 Update generated Supabase types, PowerSync schema, recurrence hydration, portability, and client service calls
- [x] 2.4 Add pgTAP regression coverage for dual bases, ordinal rules, compatibility, idempotency, reminders, portability, and historical preservation
- [x] 2.5 Adopt the original ordinary task as the first v2 occurrence and atomically generate a prototype edit whose accepted Start is today

## 3. Interface

- [x] 3.1 Redesign TaskRepeatDialog around static Summary, full-width repeat type, Next Start, basis-aware deadlines, canonical monthly/yearly controls, preview ordering, and singular labels
- [x] 3.2 Add a shared multi-select month control using established BathOS behavior and test yearly multi-month entry
- [x] 3.3 Square shared Dialog and AlertDialog corners only when edge-to-edge and add responsive tests
- [x] 3.4 Reorient deadline controls around Tasks Have Deadlines, basis-specific anchor entry, and cadence-restricted date selection
- [x] 3.5 Refine repeat-editor spacing, responsive weekday labels, sentence-style date basis controls, preview date formatting, and reminder entry
- [x] 3.6 Remove shared modal borders when edge-to-edge and normalize shared date-picker trigger typography
- [x] 3.7 Present weekly, monthly, and yearly schedule controls as tightly grouped phrasal rows with filled weekday selection and abbreviated yearly month summaries
- [x] 3.8 Allow temporary empty or invalid repeat intervals and normalize them to one on blur
- [x] 3.9 Fold repeat type into the cadence phrase and preserve equal-width weekday buttons at tablet and wider breakpoints
- [x] 3.10 Balance repeat-modal body padding and disable reminders when an empty or unparseable reminder time is committed
- [x] 3.11 Add `on` between the repeat anchor type and date so both deadline and non-deadline date phrases read as natural sentences
- [x] 3.12 Balance the vertical separation above and below the Tasks Have Deadlines row
- [x] 3.13 Allow an existing prototype's first accepted pair to start today without advancing the editor to the following cadence

## 4. Verification and rollout

- [x] 4.1 Run targeted recurrence, modal, service, synchronization, and portability tests
- [x] 4.2 Run the full Vitest, lint, build, OpenSpec validation, Supabase database tests, and database lint suites
- [ ] 4.3 Apply the database-first production rollout only after exact preflight approval, independently read back projections and protected definitions, then prepare the matching web release and monitoring handoff
- [x] 4.4 Run targeted repeat-editor and shared date-picker tests for the refined basis-specific anchor flow
- [x] 4.5 Run targeted responsive styling, sentence-flow, reminder-control, and shared modal/date-picker verification
- [x] 4.6 Run targeted phrasal cadence, month-summary, selected-weekday, and rendered responsive verification
- [x] 4.7 Run targeted repeat-interval editing and normalization verification
- [x] 4.8 Run targeted and rendered verification for the complete repeat phrase and responsive weekday distribution
- [x] 4.9 Run targeted and rendered verification for balanced repeat-modal padding and reminder-time normalization
- [x] 4.10 Run focused repeat-editor verification for the `Starts on` and `Due on` anchor phrases
- [x] 4.11 Run focused and rendered verification for the balanced deadline-toggle spacing
- [x] 4.12 Run focused client and pgTAP regression coverage for source adoption, same-day Start basis, and Deadline basis with an implied same-day Start

Focused dialog tests and rendered Upcoming verification confirmed that deadline-based schedules read `Next Due on [date]`, Start-based deadline schedules read `Next Starts on [date]`, and schedules without deadlines read `Next Starts on [date]`. The live verification was canceled without saving changes.

Same-day first-pair verification passed 19 focused repeat-dialog tests, 24 source-adoption and same-day pgTAP assertions, and 31 existing recurrence date-basis assertions. `npm run spec:validate`, `npm run build`, and `npm run lint` completed successfully; lint retains one unrelated Fast Refresh warning in `TaskQuickFind.tsx`. The complete frontend suite retains two unrelated calendar boundary-focus failures in untouched code, and the complete database suite was stopped after the pre-existing `tasks_daily_rollover` test spent more than four minutes activating its 2099 fixture. Database lint reported only existing pgTAP-extension diagnostics and pre-existing warnings outside the replaced v2 recurrence RPCs.
