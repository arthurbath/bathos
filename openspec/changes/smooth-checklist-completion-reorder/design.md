## Context

Checklist completion currently changes visible state only after the local repository mutation resolves. The editor then infers movement from a persistent map of row positions, while PowerSync and the optimistic overlay can produce additional renders for the same mutation. A single user action can therefore appear delayed and can reuse stale or mid-animation positions during synchronization.

The checklist already owns its ordering rule: checking an incomplete item assigns it an order key after the existing rows. The correction can remain entirely within the Tasks checklist editor and hook.

## Goals / Non-Goals

**Goals:**

- Show the checked state and final checklist order immediately after activation.
- Animate every displaced row through one exact pre-layout to post-layout transition.
- Prevent repository synchronization renders from restarting or corrupting the motion.
- Restore the prior visible state if persistence rejects the completion.
- Honor the user's reduced-motion preference.

**Non-Goals:**

- Animate checklist insertion, deletion, manual drag-and-drop, or reopening.
- Change checklist ordering semantics or persistence schema.
- Add an animation dependency.

## Decisions

### Apply completion through a dedicated optimistic mutation

The checklist hook will project the completed value, completion timestamp, and final order key into its optimistic overlay before awaiting the repository write. The persisted result replaces that projection, while failure removes the projection and reveals the prior queried row.

This is preferred over waiting for the repository because immediate visual acknowledgement and ordering can occur in the same React render. It is also preferred over changing the generic update method because only completion has this reorder-and-motion contract.

### Capture one pending FLIP transaction at activation time

The editor will capture each rendered row's pre-completion top coordinate immediately before invoking completion. On the next checklist layout, it will consume that one snapshot, compare it with the final coordinates, and animate each displaced row from its exact previous position to its new position.

The snapshot is consumed once instead of maintaining a rolling position history. This prevents later PowerSync and optimistic reconciliation renders from sampling an in-progress transform or replaying the completion animation.

### Skip motion under reduced-motion preference

The optimistic completion and final order still apply, but the editor will not create Web Animations when `prefers-reduced-motion: reduce` is active.

## Risks / Trade-offs

- **Repository failure can reverse the optimistic reorder** -> Remove the failed optimistic projection so the authoritative previous row reappears, and preserve the existing error path.
- **A second completion during an active animation could overlap transforms** -> Cancel existing row animations before starting the next completion transaction and use current visual positions as the new starting snapshot.
- **DOM-based animation tests cannot prove perceptual smoothness alone** -> Test single-transaction position capture and optimistic ordering, then perform rendered browser QA when the preview connection is available.
