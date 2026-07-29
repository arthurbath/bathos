## Context

The current iOS companion is a thin `WKWebView` host with a configurable large WidgetKit extension. The authenticated web module writes a bounded, owner-scoped snapshot into an App Group through a trusted main-frame bridge, and the widget renders that cache read-only. A row is one deep link into Tasks, Primary Links are intentionally omitted, and the extension has no authority to mutate the central database.

iOS 17 interactive widgets can run an `AppIntent` without presenting the containing app. The extension can perform a bounded network request, update its App Group snapshot, and ask WidgetKit to reload the timeline. This creates a useful native-only affordance, but it must not copy the user's Supabase session or create a general native Tasks client.

## Goals / Non-Goals

**Goals:**

- Complete an open widget task without launching the containing app.
- Preserve the same authoritative lifecycle, history, recurrence, and synchronization effects as ordinary completion.
- Keep the checkbox, task-summary deep link, and optional Primary Link as independent row actions.
- Open normalized HTTP, HTTPS, Mail-message, Jira, and Obsidian Primary Links directly through the operating system.
- Use a revocable credential that can only complete open tasks owned by one authenticated user.
- Briefly acknowledge successful completion and then remove the task from active cached lists with the system's widget animation.
- Keep the existing 20-table PowerSync publication unchanged.

**Non-Goals:**

- General native task editing, creation, deletion, reopening, planning, search, or offline mutation.
- Copying Supabase access or refresh tokens, PowerSync credentials, cookies, passwords, or service-role secrets into the App Group.
- Optimistically hiding a task before the server confirms completion.
- Queuing offline widget completions.
- Background native reads or a replacement for the web/PowerSync synchronization client.
- Supporting arbitrary unvalidated URL schemes beyond the Primary Link protocols already supported by Tasks.

## Decisions

### Use an interactive `AppIntent` for the checkbox only

Each open widget row is split into three independent surfaces:

- a `Toggle(isOn:intent:)` backed by a `SetValueIntent` for the square completion control
- a `Link` on the summary that preserves the existing task deep link
- an optional trailing `Link` for the normalized Primary Link

The completion intent executes in the widget extension and does not request foreground app launch. The system-supported Toggle changes to its checked appearance optimistically while the intent is running. A failed request leaves the authoritative snapshot untouched so a subsequent render returns to unchecked. Terminal Done rows retain their noninteractive terminal symbol. This is preferred over a custom URL action because URL activation opens the app and cannot complete work directly.

The completion intent lives in shared native source with target membership in both
the containing app and widget extension, as required by WidgetKit's App Intent
execution contract. Keeping the intent only in the widget view source can render
the button without making the action discoverable to the system on a physical
device.

### Add one purpose-built widget credential rather than reusing Supabase authentication

The authenticated web companion requests a credential from a dedicated Edge Function after it has a trusted native installation identifier. The function validates the ordinary Supabase bearer token, rotates one credential for that owner and installation, stores only a SHA-256 hash in `tasks_private`, and returns the raw value once. The web page passes it through memory to the trusted native bridge, and the companion stores it in a separate App Group file protected until first device unlock.

The credential:

- is owner- and installation-bound
- authorizes only the final bounded owner widget projection and idempotent completion of an owned, present, open task
- cannot read raw task rows, select another owner, or call another mutation
- expires after 90 days and is rotated whenever the authenticated companion reprovisions it
- is revoked best-effort when the native cache is cleared or the user signs out
- is never written to the widget snapshot, logs, source control, PowerSync, or a browser persistence store

A copied Supabase session was rejected because it would create a second full authenticated client. Per-task signed capabilities were rejected because every projection would need many independently revocable secrets. An App Group credential is accepted over shared Keychain for this private direct-install build because the app and extension already share the signed App Group boundary, the credential is narrow, and file protection keeps it unavailable until first unlock without adding another provisioning capability.

### Keep privileged database work behind one Edge Function

`tasks-widget-actions` has JWT verification disabled at the platform layer because it accepts two different credential classes:

- `issue` validates the supplied Supabase access token with Auth before rotating an owner-bound credential
- `snapshot` validates the widget credential before invoking the bounded projection function
- `complete` validates the widget credential before invoking the database completion function
- `revoke` validates the widget credential before revoking it

The Edge Function holds the service-role key only in managed secrets and calls RPCs that are executable only by `service_role`. The RPCs use `SECURITY DEFINER`, a fixed `search_path`, explicit credential hashing, owner checks, expiry/revocation checks, and task-state checks. No private table is exposed to `anon` or `authenticated`.

The completion RPC applies one task revision, mutation identifier, operation identifier, `widget` mutation channel, `user` actor type, completed lifecycle, and authoritative timestamp. Existing history and recurrence triggers therefore observe the same database transition as a synchronized web completion. Repeating the same idempotency identifier returns the accepted result without adding another history event.

### Bump the native projection to schema version 2

The snapshot row adds an optional normalized object:

```text
primaryLink: {
  href: string
  kind: "mail" | "link"
}
```

The web projection uses the same Primary Link normalization as the Tasks row. Nonblank `message://` values remain Mail links, `jira:` and `obsidian:` values remain application links, HTTP(S) values remain web links, and bare hosts receive HTTPS. Values that cannot form an approved absolute URL are omitted. The native validator caps each href at 8,000 characters and rejects unsupported schemes. Jira web destinations are recognized only for Jira-specific paths on Atlassian Cloud or explicitly Jira-named hosts, so Confluence links retain generic external-link iconography.

Schema version 2 also covers `credential` bridge messages and the injected installation identifier. During rollout, the web bridge detects an older companion by the absence of that identifier and continues sending its schema-version-1 snapshot and clear messages without Primary Links. The matching new companion receives schema version 2 and the credential. This preserves the installed read-only widget while the web and signed native releases are being coordinated, while each native build still rejects messages it does not understand.

### Update the cache only after authoritative success

The App Intent sends task ID and a fresh idempotency UUID to the Edge Function. The Toggle immediately shows the checked state while the request is pending. On an accepted or already-completed response, the intent keeps the checked acknowledgement visible for approximately two seconds, then atomically transforms the cached snapshot:

- remove the task from Today, Upcoming, Anytime, and Someday
- add or replace it in Done with terminal state `completed`
- update counts, truncation state, and generation time conservatively

It then calls `WidgetCenter.reloadTimelines`. Stable task IDs plus an explicit row transition let WidgetKit animate the removal within the platform's animation budget. If the request is offline, rejected, or malformed, the extension leaves the cache unchanged and reloads nothing.

The local transform is presentation reconciliation, not a second database. The next web projection replaces it with authoritative list ordering and task data.

Physical WidgetKit releases can supply the Toggle's pre-tap Boolean to a
`SetValueIntent`. Because the completion control exists only for an open task,
both Boolean values invoke the same one-way complete operation. The client
retries one transient transport or retryable HTTP failure with the same
operation and mutation identifiers so the authority remains idempotent.

### Preserve the resident web runtime when opening a widget deep link

When the companion already has loaded Tasks content, a widget deep link updates
the same-origin browser history and dispatches an in-page navigation event
instead of loading a new document. This preserves the live PowerSync OPFS
database instance. A full reload can otherwise overlap React cleanup with a new
runtime and leave the replacement waiting on the prior local database lock.

Canceled replacement navigations are not failures and do not start cold-launch
recovery. Web runtime initialization also has a bounded watchdog so an
unexpected local-database stall becomes a recoverable error with Retry rather
than an indefinite central spinner.

### Keep widget presentation native while matching canonical Tasks concepts

WidgetKit cannot render the React components used by the web module. The widget therefore draws native SwiftUI line versions of the same canonical Lucide concepts: Star for Today, CalendarRange for Upcoming, ListTodo for Anytime, and SquareDashed for Someday. These title icons use one neutral foreground treatment rather than web horizon colors.

Only Today, Upcoming, Anytime, and Someday are configurable widget lists. Done remains in the bounded snapshot because successful completion reconciliation and the companion's privacy-safe projection still require it, but it is not offered as a widget destination. Legacy Done configuration values fail safely to Today. The header omits the redundant total count, open-task controls use neutral gray, and an outer flexible spacer keeps short list contents pinned to the top of the large widget.

The large widget renders at most the first ten tasks in authoritative list order. Longer lists silently omit subsequent rows because the configured list and visible leading tasks already communicate the widget's bounded nature, and an overflow message would consume space that can display the tenth task. The separate plus action in the list header uses a bounded `bathostasks://new/<list>` route. The companion translates that route to the matching web list with a one-use `native_new_task=list` signal, and the web module reuses the list's existing floating-add placement rather than duplicating Today, Upcoming, Anytime, or Someday placement rules in Swift.

### Keep Primary Link activation entirely separate from completion and task opening

The trailing icon uses `envelope` for Mail-message links, `bolt` as the native counterpart to Lucide `Zap` for Jira links, `doc.text` as the native counterpart to Lucide `FileText` for Obsidian links, and `arrow.up.right.square` for ordinary links. It appears only when a validated Primary Link exists, is visually right-aligned, has a distinct accessibility label, and passes the URL through WidgetKit's `Link`. WidgetKit activates the containing app process for `Link` and delivers the URL to its scene. The companion therefore classifies the incoming URL before touching the web view: BathOS deep links open the requested task, validated HTTP(S), `message:`, `jira:`, and `obsidian:` Primary Links are immediately delegated to the operating system, and unsupported schemes are ignored. This system-mediated handoff avoids navigating or presenting Tasks content as the link destination even though iOS activates the containing process. The summary continues opening the task. Tapping either link never invokes completion.

## Risks / Trade-offs

- **A copied widget credential can read the owner's widget projection or complete tasks** -> Scope reads to the final bounded projection and mutations to completion only, store only its hash centrally, bind it to one owner and installation, rotate it on authenticated use, expire it, and never log it.
- **Sign-out can happen offline before revocation reaches the server** -> Clear local task and credential files immediately, attempt revocation first when possible, and bound any unreachable credential by expiry and narrow widget authority.
- **A completion succeeds remotely but the response is lost** -> Repeating the same idempotency identifier is safe, and the next authoritative projection reconciles the widget. The UI retains the row rather than falsely claiming completion.
- **The local Done projection can be temporarily imperfect** -> Treat the transform only as immediate presentation; the next web projection replaces it with the authoritative Done ordering and retention state.
- **Interactive widget network execution is system-budgeted** -> Keep one small request with a short timeout and no nested calls or background loop.
- **Primary Links expose more task metadata on the Home Screen** -> Project only the normalized URL needed for the explicitly installed widget action, apply system privacy redaction, and continue omitting notes, checklist text, source metadata, and credentials.
- **Schema version 2 requires a coordinated native reinstall** -> Keep serving schema version 1 to the identifiable legacy bridge until the matching signed app injects its schema-version-2 installation identity.

## Migration Plan

1. Add and validate the OpenSpec delta.
2. Add the private credential table, restricted RPCs, and database tests locally.
3. Add and test the `tasks-widget-actions` Edge Function.
4. Add web credential provisioning and schema-version-2 projection behavior.
5. Add native credential storage, installation identity, completion App Intent, cache reconciliation, link rendering, and tests.
6. Run database tests, application tests, TypeScript, lint, production build, unsigned native build/tests, and strict OpenSpec validation.
7. Refresh and verify the private production Tasks backup, inspect exact zero-rewrite preflight, then request explicit production approval.
8. Apply the migration, deploy the Edge Function, publish the backward-compatible web commit, reinstall the signed companion, and run owner-scoped synthetic issue/complete/retry/revoke cleanup acceptance.
9. Verify PowerSync remains exactly 20 approved Tasks tables, cron and advisors remain healthy, and physical widget completion and link activation behave correctly.

Rollback revokes all active widget credentials, removes or disables the Edge Function, republishes the preceding web release, and reinstalls the preceding native build. Database objects can remain inert for forward recovery, or be removed in a controlled follow-up after all credentials are revoked.

## Production Preflight And Approval Boundary

Before any production mutation:

1. Refresh the existing private, owner-readable data-only Tasks dump outside the repository. Include complete `public` and `tasks_private` data, verify the PostgreSQL completion footer and expected Tasks COPY sections, record a SHA-256 digest, and prove the same digest on a second read without exposing task content or credentials.
2. Confirm the production migration ledger ends before `20260728212709_add_tasks_widget_completion_authority.sql`.
3. Record content-free counts for total Tasks rows, present open tasks, completed tasks, deleted roots, history events, recurrence definitions, and current PowerSync publication members and role grants.
4. Prove `tasks_private.widget_completion_credentials` and the three widget credential RPCs are absent before migration.
5. Reconfirm the current two mutation-channel constraints, exact 20-table PowerSync publication, three once-per-minute Tasks jobs, and current security and performance advisor baseline.
6. Confirm the target web commit is clean, pushed, and reproducibly built, the Edge Function produces a nonempty local bundle, and the unsigned companion and widget build and test against the selected iOS Simulator.

The migration performs no task-row update. It adds one private credential table, extends two existing channel constraints with `widget`, and adds three `service_role`-only functions. The private table receives no PowerSync publication membership or replication-role grant. The Edge Function uses only Supabase-managed project URL, publishable-key, and secret-key environment values, so the release introduces no new managed secret.

After approval, use one disposable owner-scoped task and fixed acceptance identifiers to prove issue, accepted completion, same-mutation retry, distinct already-completed no-op, one completion history event, recurrence observation, revocation, fresh PowerSync convergence, schema-version-2 projection, direct HTTP and Mail-message Primary Link routing, and complete cleanup. A physical widget tap remains the final device gate. Record only bounded identifiers and aggregate evidence, never the raw credential, personal task content, session material, or Primary Link value.

The exact approval request is:

> I approve refreshing and verifying the private Tasks production backup, applying migration `20260728212709_add_tasks_widget_completion_authority.sql`, deploying the `tasks-widget-actions` Edge Function with platform JWT verification disabled, publishing the matching backward-compatible BathOS Tasks web release through Lovable, rebuilding and installing the automatically signed BathOS Tasks companion and widget on my iPhone, and running and cleaning up an owner-scoped disposable production widget-completion and Primary Link acceptance fixture. I understand this creates one private credential table and three service-role-only functions, extends two mutation-channel constraints, rewrites zero Tasks records, introduces no new managed secret, and keeps PowerSync at exactly 20 approved Tasks tables.

## Open Questions

None for local implementation. Production mutation and physical acceptance remain separate approval and device gates.
