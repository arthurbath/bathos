# Tasks Long-session Runtime Performance Evaluation

## Question

Does the native macOS Tasks app perform unnecessary recurring work that could contribute to resource growth or sluggishness during long-running sessions?

## Evidence

- A live process snapshot during the investigation showed the Tasks host and WebKit content process idle at negligible CPU and modest resident memory. This did not establish an active leak at the moment measured.
- Source inspection found a one-second upload-queue statistics query that ran even when the queue was empty.
- Source inspection found a one-minute planning timer that invoked both Today rollover and reached-start-date activation transactions even when the owner-local planning date had not changed.
- PowerSync status changes already trigger queue-depth refreshes, making uninterrupted one-second idle polling redundant.

## Decision

Reduce steady-state work without changing user-visible synchronization or midnight behavior:

- Record the last successfully activated planning date and run activation transactions only when the resolved date changes.
- Recheck on native-app activation so waking after midnight does not wait for a timer.
- Deduplicate overlapping activation and queue-read promises.
- Poll queue depth every second only while uploads are pending and every fifteen seconds while idle.
- Preserve immediate queue reads from PowerSync status changes.

## Expected Effect

An idle connected client drops from approximately 3,600 queue-stat reads per hour to approximately 240, a 93 percent reduction. Planning transactions drop from 120 local transactions per hour to none after successful activation until the planning date changes. The change reduces wakeups and local database work. It does not guarantee that WebKit will return all transiently allocated memory to macOS.

## Validation

Focused tests cover date gating and adaptive polling. Full runtime, web, build, lint, and OpenSpec validation are required before release.
