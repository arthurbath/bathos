## Context

Task rows already derive their contained checked-square from persisted completion state and from the transient completion-request states shared by pointer and keyboard commands. A single muted text-color class on the completion button currently suppresses semantic success color in every one of those checked states.

## Goals / Non-Goals

**Goals:**

- Restore immediate semantic-green confirmation when a to-do becomes checked.
- Keep pointer and keyboard completion visually identical by styling state rather than event source.
- Preserve neutral open boxes, hoverless completion controls, and checklist-item colors.

**Non-Goals:**

- Changing completion timing, persistence, animation, or lifecycle transitions.
- Changing task or checklist selection-mode colors.
- Changing native widget styling or checklist completion styling.

## Decisions

The task completion button will derive its text color from the same checked-state predicate that selects Lucide `SquareCheck`. This covers persisted completed tasks, deferred completion in an open editor, the pointer completion grace interval, and the terminal settling interval without duplicating event-specific styling.

The completed state will use the semantic `text-success` token. Unchecked, deleted, and canceled controls retain `text-muted-foreground`, and no hover color is introduced. The Done-specific row uses the same success color only when its lifecycle is completed.

## Risks / Trade-offs

- [A broad conditional could color a canceled or deleted task green] -> Use the existing checked-task predicate and a separate Done lifecycle check, with focused regression tests.
- [The earlier neutral checklist decision could be unintentionally reversed] -> Do not touch `TaskChecklistEditor` or its tests.
