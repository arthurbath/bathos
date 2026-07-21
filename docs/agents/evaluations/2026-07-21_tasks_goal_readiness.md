# Tasks Goal Readiness Audit

**Date:** 2026 Jul 21
**Category:** Product / Production / Trust
**Status:** Feature Complete, Bounded Trial in Progress

## Outcome

BathOS Tasks now satisfies the implemented V1 contract across the web application, offline synchronization, production PowerSync, MCP, Raycast capture, Mail capture, Web Push reminders, recovery, accessibility, and large-library behavior. The module is available for personal parallel use while Things remains authoritative.

The remaining completion gate is intentionally calendar-bound rather than implementation-bound. Inbox Manager's approved 24-hour or 10-accepted-task parallel trial remains healthy and must reach one boundary before its final production evidence can be recorded and its OpenSpec change can be archived.

## Accepted Product Surfaces

- The dark, mobile-first Tasks module provides Inbox, Today, Upcoming, Anytime, Someday, Logbook, Trash, areas, projects, headings, checklist items, templates, recurrence, reminders, search, bulk planning, undo, export, restore, and recoverable history without tags.
- One stable `/tasks/*` runtime preserves synchronization, notification state, local history, and pending work across supported route changes while invalid Tasks routes render the ordinary 404 boundary.
- PowerSync Cloud uses the exact approved 22-table owner-scoped projection. Production topology, restart, conflict, owner-isolation, cleanup, and cross-client convergence gates passed.
- Safari Web Push subscription, provider acceptance, notification opening, acknowledgement, expired-target revocation, and scheduled reminder dispatch passed in production.
- Raycast supports ordinary Inbox capture, current-browser-page capture, Finder-item capture, and AI-refined reading capture through OAuth and the production MCP function. Unreliable selected-text capture was removed from the product contract.
- Inbox Manager creates Things tasks first and conditionally mirrors only accepted new creations into BathOS Tasks during the private bounded trial. Existing tasks, edits, completions, and Mail rules remain outside that handoff.
- Native Apple surfaces and migration from Things remain deliberate future decisions rather than incomplete V1 obligations.

## Current Production Evidence

- The production MCP service advertises 42 tools, including 33 Tasks operations covering bounded reads, structured creation, updates, movement, ordering, lifecycle transitions, templates, recurrence, reminders, and Mail retirement.
- A read-only production MCP query for Today on 2026 Jul 21 returned five current to-dos, including four Mail-automation tasks, with no truncation or service error.
- The installed Inbox Manager runtime is healthy. Three tasks have been accepted since the current trial began, seven accepted-task slots remain, the handoff queue is empty, and no handoff failure is recorded.
- The current trial began at 2026 Jul 21 1:50 PM PDT and expires at 2026 Jul 22 1:50 PM PDT unless the tenth accepted task ends it first.
- The Mail workflow recovered from one stale enrichment-incident record without changing Mail rules, private mode, accepted task receipts, or scheduled success semantics. Two subsequent ordinary scheduled runs completed healthy.
- BathOS and Inbox Manager are committed, pushed, clean, and synchronized with `origin/main`.

## Remaining Completion Work

1. Let the bounded trial reach its 24-hour or 10-task boundary without artificially creating personal work for the test.
2. Confirm the runtime disabled at the intended boundary, no post-boundary credential or network work occurred, the queue is empty, and ordinary Mail and Things outcomes remain healthy.
3. Reconcile the final accepted receipts with the BathOS MCP and PowerSync projection, and record any real retry or failure evidence without exposing task content.
4. Complete Inbox Manager OpenSpec task 6.4, sync its durable specification, archive the change, validate, commit, and push.
5. Perform one final cross-repository, route, MCP, synchronization, reminder, and health audit before declaring the implementation goal complete.

Four recoverably deleted production-acceptance captures remain as roots in Tasks Trash. Permanent removal still requires explicit action-time confirmation because one setup capture originated from the user's active Safari tab. This cleanup is not a product-readiness blocker.

## Pre-Closeout Validation

The current committed `main` branch passed the following broad gates during the live trial:

- ESLint across the repository
- A production Vite build
- Strict validation of all seven durable OpenSpec specifications
- The full default Vitest suite with 687 passing tests across 117 files and nine intentional opt-in cases skipped
- The opt-in large-library performance suite with four passing tests

The performance gate derived every 10,000-record planning view below 1.4 ms at p95, built the reusable search index below 6.7 ms at p95, rendered a 1,000-row view in 904.5 ms, and opened 10,000-record search in 357.9 ms. The remaining opt-in integration suites already have stronger dated local or production acceptance evidence for offline persistence, multi-client convergence, preservation, sustained parallel use, and production topology. They are not substitutes for the still-running lived Mail handoff trial.

## Connector Discovery Note

The BathOS connector catalog attached to this long-running Codex task still exposes the older Budget, Garage, Snake, and Wardrobe tool set. A direct authenticated production `tools/list` request through the existing Raycast OAuth grant confirms that the deployed service includes the complete Tasks tool set. The discrepancy is therefore client-session discovery staleness, not a missing production deployment. A fresh Codex task or connector refresh should discover the current catalog.

## Completion Estimate

No additional large implementation tranche is evident from the durable specifications, archived OpenSpec changes, production evaluations, or source audit. Assuming the bounded trial remains healthy, the earliest honest completion point is shortly after 2026 Jul 22 1:50 PM PDT. Final evidence reconciliation, specification closeout, validation, commit, and publication should require approximately one to three focused hours after the boundary.

## Specification Impact

None. This document reconciles existing contracts and current production evidence. It does not change product behavior or introduce a new requirement.
