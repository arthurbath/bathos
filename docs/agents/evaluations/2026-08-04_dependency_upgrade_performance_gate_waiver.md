# Dependency Upgrade Performance Gate Waiver

**Date:** 2026-08-04
**Category:** Performance / Dependency Maintenance
**Status:** Expired after final assessment

## Decision

Performance budgets remain durable BathOS standards, but a performance-budget
failure is advisory rather than blocking while the current dependency-hardening
plan updates React Router, Vite, PostCSS, the browser Supabase client, and pinned
Edge Function dependencies.

This temporary waiver does not change the performance requirements in
`openspec/specs/personal-tasks-module/spec.md`. It permits the upgrade program to
continue after recording a performance failure so security and dependency
support improvements are not prevented by a noisy local wall-clock sample.

Functional correctness, security, data integrity, type checking, lint, builds,
strict OpenSpec validation, dependency-graph inspection, and applicable
integration failures remain blocking. Edge Function deployment and repository
pushes still require separate explicit authorization.

## Evidence Behind the Waiver

The React Router phase's development-runtime 1,000-row JSDOM render crossed the
2,000 ms ceiling intermittently. Exact pre-upgrade and upgraded Router variants
both passed and failed under the contended test environment, so the failure did
not establish a package-caused regression. A later run also produced a large
spike in an unrelated pure task-view derivation, showing that the same process's
wall-clock measurements were not stable enough to attribute the render result
to React Router.

Every performance run will still be executed and reported. A failure will be
carried into the final assessment rather than treated as a phase acceptance
failure.

## Final Performance Assessment Contract

After all dependency phases are implemented, compare the exact pre-upgrade
baseline with the final dependency state using equivalent clean temporary
worktrees and dependency installations. Alternate baseline and final runs to
reduce time-order bias and record host conditions.

The final assessment must include:

- At least ten cold serial runs per revision of the opt-in Tasks performance
  suite, reporting arithmetic mean, median, p95, range, pass frequency, and the
  final-to-baseline percentage change for each metric.
- The 10,000-record task-view derivations, search-index construction, text
  filtering, 1,000-row Tasks-shell render, and 10,000-record search opening.
- Production build time, emitted JavaScript size, and changed chunk sizes.
- Repeated Safari development and production-preview samples for initial
  application startup, authentication routing, launcher navigation, and every
  registered module route, with console and network errors recorded.
- A practical Tasks sample at the owner's expected visible-row scale in
  addition to the synthetic 1,000-row stress case.
- A clear separation between package-attributable changes, test-runtime noise,
  host scheduling or garbage-collection outliers, and existing linear
  nonvirtualized rendering cost.

Treat performance as seriously degraded when repeated equivalent runs show both
an arithmetic-mean and median regression of at least 25 percent on a
user-facing metric, when a durable ceiling is breached in at least 20 percent
of final samples but not baseline samples, or when Safari testing shows a
repeatable material interaction delay. Report smaller regressions as moderate
or minor rather than hiding them.

If serious degradation is found, provide an evidence-backed theory of cause and
ranked remediation options. Preserve keyboard navigation, assistive-technology
DOM order, focus restoration, and inline editing when considering row
virtualization or other Tasks rendering changes.

## Expiration

The waiver expires after the final dependency-upgrade performance assessment.
Any subsequent product or dependency change is again subject to the durable
performance gates unless separately authorized.

The final assessment is recorded in
`docs/agents/evaluations/2026-08-04_dependency_upgrade_final_performance.md`.
It found no serious average degradation, so this waiver is now expired.
