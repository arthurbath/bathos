# Evaluations

This folder contains dated agent-facing security, performance, and technology evaluations. Each document records the analysis, decision, and any changes made.

## Policy

- **Every evaluation gets its own file**, named `YYYY-MM-DD_topic.md`.
- **Date the file** with the date the evaluation was performed.
- **Record changes made** — if the evaluation leads to code, schema, or configuration changes, note them directly in the document.
- **Categories**: security audits, performance reviews, library/technology evaluations, infrastructure decisions.
- **Do not delete old evaluations.** They serve as a decision log. If a decision is reversed, create a new dated evaluation referencing the original.

## Index

| Date | File | Topic |
|---|---|---|
| 2026-07-23 | `2026-07-23_tasks_unified_start_release.md` | Unified task Start picker, explicit Primary Link clearing, private backup, and production acceptance |
| 2026-07-22 | `2026-07-22_tasks_structure_simplification_preflight.md` | Heading-free Tasks scheduling migration, private backup, content-free production preflight, and bounded release acceptance |
| 2026-07-21 | `2026-07-21_tasks_goal_readiness.md` | Tasks V1 acceptance coverage, current production evidence, and the final bounded-trial completion gate |
| 2026-07-21 | `2026-07-21_tasks_route_runtime_stability.md` | Tasks route continuity, runtime preservation, and production browser acceptance |
| 2026-07-21 | `2026-07-21_tasks_sync_reliability.md` | Tasks first-full-sync truthfulness, local degradation evidence, and privacy-bounded Sentry reporting |
| 2026-07-21 | `2026-07-21_tasks_production_topology_hardening.md` | Tasks production migrations, reminder dispatcher, RLS optimization, and PowerSync boundary acceptance |
| 2026-07-20 | `2026-07-20_tasks_reminder_delivery_readiness.md` | Personal Tasks Web Push dispatcher, secret-free Cron package, and production reminder acceptance gate |
| 2026-07-20 | `2026-07-20_tasks_product_identity.md` | Personal Tasks product-name shortlist, collision screen, and icon-direction recommendation |
| 2026-07-20 | `2026-07-20_tasks_production_sync_readiness.md` | Personal Tasks production PowerSync package, projection-drift correction, and local acceptance proof |
| 2026-07-20 | `2026-07-20_tasks_production_sync_topology.md` | Personal Tasks PowerSync Cloud and self-hosted production topology recommendation |
| 2026-07-20 | `2026-07-20_tasks_sustained_parallel_use.md` | Personal Tasks sustained local multi-client, retry, conflict, and restart endurance validation |
| 2026-07-20 | `2026-07-20_tasks_large_library_performance.md` | Personal Tasks large-library view, render, and search performance validation |
| 2026-07-20 | `2026-07-20_tasks_accessibility_validation.md` | Personal Tasks keyboard, focus, screen-reader label, dialog, and reduced-motion validation |
| 2026-07-20 | `2026-07-20_tasks_preservation_recovery.md` | Personal Tasks undo, Trash, backup, export, and catastrophic restore validation |
| 2026-07-20 | `2026-07-20_tasks_multi_client_convergence.md` | Personal Tasks overlapping web, MCP, and Raycast convergence validation |
| 2026-07-20 | `2026-07-20_tasks_offline_workflow_validation.md` | Personal Tasks complete offline workflow validation |
| 2026-07-19 | `2026-07-19_tasks_offline_sync.md` | Personal Tasks offline persistence and synchronization options |
| 2026-05-14 | `2026-05-14_supabase_data_api_grants.md` | Supabase Data API explicit grants rollout evaluation |
| 2026-02-17 | `2026-02-17_data-grid-evaluation.md` | Data grid library evaluation (TanStack Table recommended) |
