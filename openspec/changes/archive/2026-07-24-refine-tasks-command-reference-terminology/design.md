## Context

The current Tasks keyboard reference uses written modifier names, includes pointer rows the user no longer wants documented, and promises Option/Alt plus arrow keyboard reordering. User-facing Tasks copy also mixes "task" with "to-do," "Deadline" with "Due Date," and "Task's Start" with "Start Date" or bare "Start."

## Goals / Non-Goals

**Goals:**

- Make the command reference compact without widening its modal
- Remove keyboard task reordering while preserving pointer drag reordering
- Establish consistent user-facing Tasks terminology and accessible names
- Keep tests and human documentation synchronized with the visible contract

**Non-Goals:**

- Rename database columns, repository fields, or internal task-domain types
- Remove pointer drag reordering
- Implement checklist editing as part of this change
- Change synchronization, persistence, or planning semantics

## Decisions

1. Command strings use `⌘`, `⌃`, `⇧`, and `⌥` for modifier keys. Written keys and pointer gestures retain Title Case, and arrow keys use triangular glyphs when a documented command requires them.
2. Task-row Option/Alt plus arrow handling and its accessibility shortcut declaration are removed. Drag-and-drop reordering remains available but is omitted from the command reference.
3. The checklist command is labeled "Edit Checklist." Its current runtime behavior is unchanged because this change only removes implementation-status wording from the reference.
4. The visible vocabulary is "task," "Deadline," and "Task's Start." Internal schema and code identifiers retain established names to avoid an unrelated data migration.

## Risks / Trade-offs

- [Risk] Symbol-only shortcuts may be unfamiliar to some users -> Keep separate Mac and Windows columns and preserve written non-modifier key names
- [Risk] A hidden user-facing string could retain old terminology -> Use repository-wide scoped searches and rendered browser inspection
- [Risk] Removing keyboard reorder could affect an existing workflow -> Remove only the dedicated key handler and retain pointer drag reordering
