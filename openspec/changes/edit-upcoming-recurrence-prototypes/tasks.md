## 1. Prototype Summary Projection

- [x] 1.1 Render ordinary second-row metadata for dated and waiting recurrence prototypes.
- [x] 1.2 Derive and render the next generated-instance Deadline for dated prototypes.

## 2. Prototype Editing

- [x] 2.1 Open dated and waiting prototypes into an inline metadata drawer.
- [x] 2.2 Add queued autosave for Summary, Notes, Primary Link, Area, Actionability, and Checklist prototype metadata.
- [x] 2.3 Replace temporal inputs with a full-width Edit Repeat action and preserve existing prototype actions.

## 3. Repeat Modal

- [x] 3.1 Remove ordinary prototype metadata controls from existing-recurrence edit mode.
- [x] 3.2 Preserve the latest accepted prototype content and Area when cadence changes are committed.

## 4. Verification

- [x] 4.1 Add focused tests for prototype metadata, drawer editing boundaries, and cadence-only repeat editing.
- [x] 4.2 Run focused tests, build, lint, and OpenSpec validation.

## 5. Upcoming Mixed-Row Ordering Repair

- [x] 5.1 Use one stable mixed-row ordering model for Upcoming rendering, direct row drops, and section-edge drops.
- [x] 5.2 Preserve cross-section ordinary-task placement when the target row is a recurrence prototype.
- [x] 5.3 Retry prototype rank mutations after one authoritative recurrence revision conflict without an intermediate rollback.
- [x] 5.4 Add regression coverage for mixed boundaries, prototype targets, tied keys, conflict reconciliation, and persistent optimistic placement.
- [x] 5.5 Run focused tests, build, lint, and OpenSpec validation.
- [x] 5.6 Add `upcoming_order_key` to the durable task insert and update upload contract with connector-level regression coverage.
- [ ] 5.7 Reproduce and verify an ordinary-task drop among prototypes through the live synchronized browser flow, including the post-sync delay and reload.
