## Production Boundary

The user authorized reconciliation of the preexisting migration-ledger
divergence and deployment of the resulting release to production on July 29,
2026. The rollout remains bounded to the verified backup, the two genuinely
pending migrations, the matching Edge Function and web release, the signed
companion and widget installation, and owner-scoped disposable acceptance.

## Current Migration Ledger

The read-only linked migration inspection on July 29, 2026 found production
ending at remote version `20260729060532`. The apparent divergence at
`20260729054101`, `20260729054133`, and `20260729060532` was reconciled by
recovering the production statements and proving that each is byte-equivalent
to the matching local SQL, apart from the local files' trailing newline where
applicable. The local files now use the canonical production timestamps, and
the linked ledger is one-to-one through `20260729060532`.

The only genuinely pending migrations are:

- `20260729194843_refine_upcoming_recurrence_projections.sql`
- `20260729212429_add_tasks_widget_background_snapshot_authority.sql`

## Exact Preflight

Before any production mutation:

1. Refresh the private owner-readable, data-only Tasks backup outside the
   repository. Verify its PostgreSQL completion footer, expected Tasks COPY
   sections, SHA-256 digest, and a second-read digest match without exposing
   task content or credentials.
2. Re-run the linked migration ledger inspection and complete the migration
   reconciliation described above.
3. Record content-free counts for Tasks rows, open tasks, terminal tasks,
   deleted roots, areas, settings, history events, recurrence definitions,
   recurrence occurrences, widget credentials, and current PowerSync
   publication members and replication-role grants.
4. Prove
   `tasks_private.build_widget_list_projection(uuid,text,date,boolean,text)`
   and `public.tasks_read_widget_snapshot(text)` are absent.
5. Reconfirm the existing widget credential table and issue, complete, and
   revoke functions retain their expected owner, installation, expiry,
   revocation, hashing, and `service_role`-only boundaries.
6. Reconfirm PowerSync is ready with exactly 20 approved Tasks tables, no
   private widget credential objects are published, all Tasks cron jobs are
   active at their approved schedules, and the current security and performance
   advisor baseline is unchanged.
7. Prove the intended Git commit is clean and pushed, the web production build
   is reproducible, the Edge Function makes a nonempty local bundle, and the
   automatically signed companion and widget build with the selected Xcode.

## Migration Effects

`20260729212429_add_tasks_widget_background_snapshot_authority.sql`:

- creates one private projection function and one public
  `service_role`-only credential-authenticated snapshot function
- creates no table, index, trigger, cron job, publication member, replication
  grant, or managed secret
- rewrites zero Tasks rows
- keeps the existing widget credential format and lifecycle
- keeps PowerSync at exactly 20 approved Tasks tables
- returns no notes, checklist content, reminder records, Mail source metadata,
  credentials, or unrelated BathOS data

## Deployment Order

1. Complete the verified backup and exact migration-ledger reconciliation.
2. Apply every separately approved pending migration in timestamp order,
   ending with `20260729212429_add_tasks_widget_background_snapshot_authority.sql`.
3. Deploy `tasks-widget-actions` with platform JWT verification disabled and
   verify the custom widget credential remains the only snapshot authority.
4. Publish the matching backward-compatible BathOS web release if the release
   commit contains the coordinated documentation or bridge changes.
5. Rebuild and install the automatically signed BathOS Tasks companion and
   widget on the owner's iPhone.
6. Run and clean up the owner-scoped acceptance fixture.
7. Re-run PowerSync, cron, advisor, migration-parity, function-grant, and
   rendered-device checks.

## Owner-Scoped Acceptance

Use one disposable synthetic owner with fixed acceptance identifiers. Prove:

- the credential snapshot returns exactly the synthetic owner
- all five list projections use the expected membership and ordering
- durable quick filtering, area ordering, and automatic sorting apply
- bare web Primary Links normalize safely and unsupported explicit protocols
  remain absent
- the projection is capped at 50 rows per list and below 512 KiB
- notes, checklist text, reminder data, Mail source data, and credentials are
  absent
- an invalid, expired, revoked, or cross-owner credential returns no content
- existing widget completion, idempotent retry, and revocation still work
- the signed widget obtains fresh remote content without opening Tasks
- airplane-mode or server failure retains the last accepted cache
- cleanup returns all synthetic owner-scoped tables to zero rows

The raw widget credential, session material, Primary Link values, and personal
task content must never enter logs or rollout evidence.

## Rollback

Reinstall the preceding signed companion and widget, redeploy the preceding
`tasks-widget-actions` bundle, and republish the preceding web release if one
was included. The two additive database functions may remain inert because
older clients never call them. If removal is later required, first prove no
installed widget uses snapshot reads, then remove them through a separately
approved forward migration. Do not rewrite migration history.

## Approval Request

After the migration ledger is reconciled and any genuinely pending preceding
migrations are named, use this request with the exact resulting list:

> I approve refreshing and verifying the private Tasks production backup,
> applying the reconciled pending migrations in order ending with
> `20260729212429_add_tasks_widget_background_snapshot_authority.sql`, deploying
> the matching `tasks-widget-actions` Edge Function with platform JWT
> verification disabled, publishing the matching backward-compatible BathOS
> Tasks web release through Lovable, rebuilding and installing the automatically
> signed BathOS Tasks companion and widget on my iPhone, and running and cleaning
> up an owner-scoped disposable production widget-background-refresh,
> completion, and Primary Link acceptance fixture. I understand the widget
> migration creates two functions, rewrites zero Tasks rows, creates no table or
> managed secret, and keeps PowerSync at exactly 20 approved Tasks tables.
