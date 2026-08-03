## Context

The watch already posts captures and reads Today progress directly from `tasks-widget-actions` with the same expiring, owner-scoped opaque capability used by native widgets. The paired iPhone issues that capability only after authenticated web content bridges it into the native App Group, then publishes it with `updateApplicationContext`. A newly installed or reset watch can therefore be online yet lack the capability and currently stops with a manual instruction.

The complication currently uses SwiftUI's `.accessoryCircular` gauge, whose system styling adds visual structure beyond the requested single track and stroke. The shared Icon Composer source already declares a watchOS circular rendering and is referenced by the watch target.

## Goals / Non-Goals

**Goals:**

- Render a deterministic single-track circular progress ring with a centered checkmark.
- Keep the capture control spatially stable while transient confirmation feedback appears.
- Recover a missing or expired watch capability without requiring the user to foreground Tasks on iPhone.
- Keep the task summary on the watch and send it directly to the existing HTTPS Edge Function.
- Preserve the existing private credential table, narrow RPCs, endpoint, and icon source.

**Non-Goals:**

- Add independent sign-in UI to watchOS.
- Give the watch general Tasks API access.
- Relay task summaries through Watch Connectivity.
- Add persistent task fields, tables, or managed secrets.
- Force complication refreshes beyond WidgetKit's system budget.

## Decisions

### Draw the ring explicitly

Use two `Circle` strokes with the progress stroke trimmed and rotated by -90 degrees: a muted full track and a high-contrast progress arc with a round cap. Use an explicitly bold center checkmark. Accessory complications render in accented or vibrant modes and can discard explicit RGB colors, so encode the track/progress contrast in alpha rather than relying on gray versus white. This preserves the visible incomplete portion under the watch face's template tint treatment without inheriting the system accessory gauge's extra labels or capacity styling.

### Calculate progress from activated Today semantics

BathOS normalizes a reached Start by moving the task into a Today horizon and clearing the explicit `start_date`. A server aggregate that only tests `start_date = planning_date` therefore undercounts the actual Today set and loses completed tasks from the ring. The Watch authority instead counts current open Today-horizon tasks plus Today-horizon tasks completed on the owner's current planning date. Canceled and deleted tasks remain outside the metric.

This changes only the service-role-only aggregate function. It does not rewrite task rows or expand Watch authority.

### Overlay transient capture feedback

Use a fixed-size circular `TextFieldLink` centered in a `ZStack`. Status text is independently overlaid near the bottom of the Watch view. Successful confirmation owns a cancellable two-second dismissal task so repeated captures replace the prior timer cleanly and never alter the plus control's frame.

### Treat the phone as an authority broker, not a capture relay

When the watch lacks a valid capability, it sends an authority-only request through Watch Connectivity. The request contains a schema version and request identifier, never the summary. The iPhone coordinator responds from its existing App Group credential store using both current application context and a guaranteed queued user-info transfer. The watch stores the capability, then performs the capture itself over HTTPS.

This avoids watch sign-in and preserves owner scoping. An account cannot be inferred securely on a fresh watch without one authenticated companion credential, so the paired app remains the trust bootstrap while no longer carrying user task content or requiring foreground interaction.

### Keep one pending summary in memory

If submission begins before authority arrives, the watch keeps only that normalized summary in process memory, shows a bounded connecting state, and automatically retries once. It does not persist uncommitted task content or enqueue it through the phone. If recovery does not complete within a short timeout, the user receives a retryable failure.

### Reuse the Icon Composer asset

The watch target continues to set `ASSETCATALOG_COMPILER_APPICON_NAME` to `Tasks Apple Native Icon` and includes the shared `.icon` folder as a resource. The source's `supported-platforms.circles` entry remains `watchOS`, so no raster watch icon fork is introduced.

### Advance the embedded Watch build identity

Installing a rebuilt containing iPhone app does not reliably replace an already-installed watchOS app or complication extension when every embedded bundle retains the same `CFBundleVersion`. Native releases that change the Watch app or its WidgetKit extension therefore advance the shared Xcode project build number before installation. This gives watchOS an unambiguous newer bundle to synchronize even when the direct developer tunnel to the paired Watch is unavailable.

## Risks / Trade-offs

- **[The companion has no valid credential]** -> The watch cannot securely identify an owner, so it reports that Tasks must be signed in on iPhone rather than sending content to the phone or accepting anonymous capture.
- **[Watch Connectivity delivery is delayed]** -> Use immediate messaging when reachable plus guaranteed queued user info as fallback, and bound the watch wait state.
- **[Duplicate delivery paths]** -> Authority responses are idempotent and contain no mutation. Captures keep their existing unique client mutation identifier.
- **[Custom ring differs across watch faces]** -> Use WidgetKit foreground styles and a fixed inset so the system continues tinting and clipping the accessory family correctly.

## Migration Plan

1. Replace the existing service-role-only Watch progress function without rewriting task rows.
2. Ship the iOS and watchOS companion changes together.
3. Existing watch credentials continue to work without reissuance.
4. Newly missing credentials self-heal after the paired session can respond.
5. Rollback can restore the prior aggregate and Watch presentation without credential rotation.
6. Install the companion with a newer build number so the paired Watch synchronizes the repaired app and complication extension rather than retaining build 1.

## Open Questions

None.
