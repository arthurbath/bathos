## Context

BathOS Tasks routes keyboard events through one domain mapper before the shell dispatches commands. The current Tasks-specific Control layout is documented in the Keyboard Commands dialog, the human Tasks guide, durable OpenSpec requirements, and automated tests. The revised infographic replaces that layout and adds a Control-based Undo chord so the primary task workflow can remain on one modifier.

The Mac Tasks layer uses Control without Shift. Windows uses Control+Shift for Tasks-specific commands because unshifted Control combinations carry standard application meanings. Undo and Redo are the exception because Windows already reserves Control+Z and Control+Shift+Z for those standard operations.

## Goals / Non-Goals

**Goals:**

- Make the central command mapper match the revised Control layout exactly.
- Preserve standard undo and redo chords while adding Control+Z as a Mac Undo alias.
- Keep the Keyboard Commands dialog, human guide, durable specification, and tests synchronized with the mapper.
- Prove that displaced chords no longer invoke their former task actions.

**Non-Goals:**

- Change Command-based view navigation, clipboard, duplication, or task-selection behavior.
- Change the actions themselves, task persistence, history semantics, or Supabase behavior.
- Introduce user-configurable shortcuts.

## Decisions

### Replace the Tasks-specific map atomically

The existing task-command lookup will be replaced with the exact Q/W/E/R/T, A/S/D/F/G, and Z/X/C/V/B assignments. Updating the single lookup keeps event interpretation deterministic and avoids maintaining aliases for displaced commands.

Keeping old aliases was considered, but rejected because the user explicitly described the new layout as a complete relayout. Retained aliases would make the reference incomplete and could trigger unintended metadata changes from obsolete muscle memory.

### Resolve undo and redo before the shifted Windows task layer

On Mac, Control+Z will map through the Tasks-specific layer to Undo, while Command+Z remains Undo. On Windows, Control+Z remains Undo and Control+Shift+Z remains Redo. The mapper will continue resolving shifted application Redo before the Windows Control+Shift task layer, so the new Mac alias does not turn Windows Redo into a second Undo chord.

Assigning Windows Control+Shift+Z to the shifted task layer was considered, but rejected because it would violate the established platform convention and remove a required Redo chord.

### Keep documentation generated from explicit platform rows

The Keyboard Commands dialog and human guide will describe Mac and Windows chords explicitly. Undo will show both Command+Z and Control+Z on Mac, while Windows will show Control+Z once. This avoids implying that every Tasks-specific chord follows an identical modifier transformation.

## Risks / Trade-offs

- **Risk: Event-order changes could shadow Redo on Windows.** → Retain the existing application-level shifted-Z precedence and add direct platform tests for every Undo and Redo chord.
- **Risk: Old shortcuts remain in prose or regression fixtures.** → Search the module, durable specs, active changes, and human documentation for every displaced chord, then validate the exact current map.
- **Risk: Users with prior muscle memory trigger a different task mutation.** → Remove obsolete aliases and make the Keyboard Commands dialog the definitive visible reference.

## Migration Plan

This is a web-only behavioral release with no data migration. Deploy the mapper, reference, documentation, and tests together. Rollback consists of reverting the release as one unit.

## Open Questions

None.
