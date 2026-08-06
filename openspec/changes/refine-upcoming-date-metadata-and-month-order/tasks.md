## 1. Temporal Metadata

- [x] 1.1 Update the shared relative date formatter to use signed nearby countdowns without `left` or `ago`, with singular and plural day labels.
- [x] 1.2 Render Upcoming month-bucket Start metadata with the shared desktop and mobile relative-date rules for ordinary tasks and recurrence prototypes.
- [x] 1.3 Add formatter and rendered metadata regressions for future, overdue, absolute-date, ordinary-task, and prototype cases.

## 2. Upcoming Month Ordering

- [x] 2.1 Apply effective-Start-first sorting to the mixed ordinary-task and recurrence-prototype rows in month buckets while preserving rank and identity tie-breakers.
- [x] 2.2 Apply the same ordering to keyboard and selection traversal without changing individual day-bucket manual order.
- [x] 2.3 Add regressions proving chronological month ordering, same-date grouping, stable same-date rank, and unchanged daily order.

## 3. Verification

- [x] 3.1 Run targeted Tasks tests, the full test suite, lint, build, OpenSpec validation, and diff checks.
- [x] 3.2 Verify the Upcoming desktop and mobile presentation in the rendered application, including framework and console health.
