## 1. Authoritative Activation

- [x] 1.1 Add a forward migration that collects newly generated recurrence roots into the reached-task activation batch
- [x] 1.2 Allocate fresh Today Inbox order keys for the mixed batch from controlling date and Upcoming rank while preserving recurrence Start semantics
- [x] 1.3 Preserve retry idempotency and pre-existing or rolled-over Inbox placement

## 2. Foreground Convergence

- [x] 2.1 Make local ordinary-task activation append reached tasks in their Upcoming order
- [x] 2.2 Add focused repository tests for local order allocation

## 3. Verification

- [x] 3.1 Add pgTAP coverage for mixed ordinary and recurrence ordering, existing Inbox placement, and retry stability
- [x] 3.2 Run focused Tasks tests, database tests, build, lint, and OpenSpec validation
