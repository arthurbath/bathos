# Personal Tasks Large-Library Performance Validation

**Date:** 2026-07-20
**Category:** Performance / Interaction
**Status:** Passed

## Purpose

Measure task-view derivation, task-row rendering, search indexing, search filtering, and search-surface opening against synthetic libraries materially larger than the current Things library. The exercise uses generated records only and does not read or copy task content.

## Scale

A bounded read-only AppleScript count reported 235 current Things to-dos on 2026 Jul 20.

The performance gate uses:

- 10,000 synthetic to-dos for view derivation and search, over 42 times the observed Things count
- 100 areas, 500 projects, and 1,000 headings in the search hierarchy
- 1,000 simultaneously rendered task rows, over four times the complete observed Things count
- Mixed destinations, lifecycle states, Trash records, start dates, Today sections, actionability states, and structured source kinds

## Budgets

- Any 10,000-record view derivation: Under 100 ms p95
- Reusable 10,000-record search-index construction: Under 100 ms p95
- Text or structured search filtering: Under 50 ms p95
- Initial development-runtime render of 1,000 task rows: Under 2,000 ms
- Development-runtime search-dialog opening over 10,000 records: Under 1,000 ms

These are regression ceilings, not performance targets. The lower observed measurements remain the comparison point for later changes.

## Results

| Operation | Median | P95 / Duration |
|---|---:|---:|
| Inbox derivation | 0.64 ms | 1.06 ms p95 |
| Today derivation | 0.78 ms | 1.06 ms p95 |
| Upcoming derivation | 0.50 ms | 0.80 ms p95 |
| Anytime derivation | 0.51 ms | 0.65 ms p95 |
| Someday derivation | 0.53 ms | 0.62 ms p95 |
| Logbook derivation | 0.85 ms | 1.13 ms p95 |
| Trash derivation | 0.51 ms | 0.69 ms p95 |
| Search-index construction | 2.06 ms | 4.80 ms p95 |
| Text search | 0.30 ms | 0.32 ms p95 |
| Structured filter | 0.07 ms | 0.07 ms p95 |
| Render 1,000 task rows | - | 956.72 ms |
| Open search over 10,000 records | - | 313.23 ms |

The measurements came from a single local run in Vitest. Node measured the pure data paths. JSDOM measured the complete rendered Tasks shell and search dialog in React development mode.

## Finding and Change

The view derivation path was already comfortably inside budget. Search performed avoidable repeated work: every query lowercased all searchable fields again and scanned area, project, and heading arrays for every task.

Search now builds a reusable document index whenever task or hierarchy data changes. The index stores normalized searchable text and resolves hierarchy labels through maps. Keystrokes filter those documents without rebuilding strings or performing linear hierarchy lookups. Result rendering reuses the indexed hierarchy label.

Task-list rendering remains intentionally nonvirtualized because the current keyboard and assistive-technology contract depends on predictable DOM order. The 1,000-row development render passed its conservative budget, but its cost is linear. If parallel use produces an active view near that scale, any virtualization proposal must preserve Arrow focus, Tab order, row-removal focus restoration, screen-reader position, grouping, and inline editor expansion before adoption.

## Repeatability

The gate runs serially to reduce timing variance:

```sh
npm run test:tasks:performance
```

The harness lives under `src/modules/tasks/performance/`. Normal test runs discover it but leave the timing cases skipped unless the performance flag is set.

## Remaining Boundaries

- Browser paint, layout, and device-specific behavior are not represented by JSDOM.
- A production Safari sample on the eventual target Mac and iPhone remains appropriate before migration.
- Sustained parallel use remains task 7.8 and is required before any migration decision.
