# Tasks Exclusive Start and Permanent Mail Release

**Date:** 2026 Jul 25
**Category:** Product / Production / Trust
**Status:** Complete

## Outcome

BathOS Tasks now stores Start and Today horizon as exclusive planning forms in production. Future work has a future Start and no horizon. Today work has no persisted Start and one of Inbox, Now, Next, or Later. Reached future work enters Today Next. Specialized Mail capture remains an integration-owned exception to ordinary capture and creates Today Inbox tasks.

Inbox Manager now delivers every newly accepted Mail creation to both Things and BathOS indefinitely. The workflow retains one policy and AI-refinement path, creates and verifies Things first, then asynchronously sends the same final result to BathOS. Historical Mail is not backfilled, edits and completion do not synchronize, and Mail-retirement lifecycle remains outside the handoff.

## Private Backup

The corrected production attempt refreshed the private backup immediately before mutation:

`/Users/Art/Library/Application Support/garden.bath.bathos/tasks-production-backups/2026-07-25T074858-0700-pre-exclusive-start-corrected.sql`

The owner-only directory remained mode 0700 and the file remained mode 0600. The 3,220,447-byte logical export contained 41 data inserts and its completion marker. Two independent SHA-256 reads matched:

`75eeca992ce5f6b7b510de879fb7dc46c6873d5cb4e734157966baa4350f3237`

The known data-only restore caveat for the circular recurrence-occurrence foreign key remains documented. The complete schema and recovery procedures remain available separately.

## Coordinated Release

Migration `20260725001910_enforce_exclusive_tasks_start_horizons.sql` applied successfully. Its first production attempt failed transactionally without changing data because six completed or canceled tasks retained historical past Starts. The corrected migration:

• Activates reached open present roots before replacing the planning trigger

• Clears horizons from every Start-bearing to-do and project

• Applies future-only Start validation to open present work

• Preserves terminal historical Starts

• Assigns Today Next when future work reaches its owner planning date

The approved web commit `64794f8` required one release correction. Commit `b2c3f0bf59778885abc8ce6478d469f21acd6ac3` is its direct descendant and adds the terminal-history regression contract. Lovable published that exact source through deployment `e40935e8-a34f-47ce-90c1-c4911d8251c6`. The production Tasks route returned HTTP 200 with the matching deployment header.

MCP function version 13 is active with custom OAuth verification and the matching exclusive-Start contract. Its deployed SHA-256 is:

`656a00ef8cb32df0ee0270ea9e3f0b07340379b037551179a0dac9f018719291`

Local and remote migration histories match through `20260725001910`.

## Production Invariants

Preflight found 24 to-dos, no projects, eight Start/horizon conflicts, six terminal historical Starts, no reached active roots, and no active reminders. After migration:

• All 24 to-dos remain present

• Start/horizon conflicts are zero

• Illegal active Starts are zero

• All six terminal historical Starts remain preserved

• Active reminders remain zero

• Task history contains 580 events before the natural Mail run

PowerSync remains ready with exactly the approved 21 Tasks tables. The reminder, reached-Start activation, and Done-retention jobs remain active once per minute, and each job's latest recorded run succeeded.

The owner-scoped `synthetic-exclusive-start` fixture passed the Supabase and fresh PowerSync gates. An independent cleanup query found zero synthetic users, to-dos, projects, settings, and reminders. The migration added no table or index. Current security and performance advisors contain only documented preexisting findings, including intentionally private RLS tables, signed-in SECURITY DEFINER APIs, and informational index findings.

## Permanent Mail Delivery Acceptance

The installed Inbox Manager runtime is the operational source of truth. Persistent parallel mode was enabled at `2026-07-25T14:54:43.778Z` with no expiry, acceptance baseline, or acceptance limit. The schedule was reinstalled without changing Mail rules, private receipts, the OAuth grant, or the existing OpenAI path.

The first ordinary run after activation completed at `2026-07-25T14:56:33Z`. It accepted three new parallel handoffs. Installed status then reported 12 retained receipts, including 11 parallel receipts, with zero pending requests, retries, handoff failures, item incidents, or enrichment incidents. Mail automation remained healthy and the LaunchAgent exited successfully.

A content-free reconciliation proved all three new opaque IDs:

• Each authoritative BathOS task exists as open, present, revision 1 Today Inbox work

• Each task has exactly one structured Mail-source row

• Each task has exactly one creation-history event

• A fresh disposable PowerSync client independently projected all three tasks and all three creation events

• The PowerSync database disconnected, cleared, closed, and removed its disposable files after the pass

The run used only newly selected Mail. No historical backfill, duplicate OpenAI processing, BathOS-to-Things synchronization, task-edit synchronization, completion synchronization, or Mail-retirement synchronization occurred.

## Validation

Before release, the corrected source passed:

• 50 focused database assertions

• All 635 database assertions

• All 962 default application tests with 14 intentional opt-in skips

• ESLint

• Tasks TypeScript checking

• Production build

• Strict OpenSpec validation

• MCP Edge Function bundle verification

The release correction also passed six dedicated terminal-history regressions. Final acceptance added the natural Mail run, authoritative Supabase reconciliation, and a fresh PowerSync projection rather than relying only on synthetic evidence.

## Rollback

Inbox Manager can return immediately to `things-only`. That transition stops new staging and replay before BathOS credential or network access while preserving pending work for an explicitly approved resume.

Database rollback requires restoring the prior trigger and constraints, assigning Next to future roots whose horizon is null, and redeploying the previous MCP and web versions. The verified private backup is the authoritative predeployment data recovery point.
