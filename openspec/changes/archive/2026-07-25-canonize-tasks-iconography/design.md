## Context

Tasks currently imports Lucide components directly in each UI file. Most choices are approved, but repeated concepts such as Project, Someday, Done, and task creation can diverge because their relationship is implicit. The BathOS launcher also presents Tasks, but platform code must not import from the isolated Tasks module.

## Goals / Non-Goals

**Goals:**

- Give recurring Tasks concepts one named Lucide component.
- Apply the user's explicit overrides everywhere those concepts are rendered.
- Preserve current approved icons for concepts not overridden.
- Make the mapping easy to discover in source, durable specifications, and human documentation.
- Keep labels and accessible names authoritative because icons remain supplemental.

**Non-Goals:**

- Redesign generic browser, dialog, navigation, ordering, or confirmation chrome.
- Change color semantics, icon dimensions, labels, task behavior, persistence, or synchronization.
- Introduce custom SVGs, raster assets, or another icon dependency.
- Make another BathOS module depend on Tasks source.

## Decisions

### Use a module-local semantic registry

Create a typed registry in `src/modules/tasks/components/taskIconography.ts` whose keys name product concepts rather than icon glyphs. Tasks components will import semantic entries from this registry instead of independently selecting Lucide components for recurring concepts.

This keeps the contract close to the module and avoids a shared-platform abstraction for vocabulary that belongs only to Tasks. The BathOS launcher will continue importing `SquareCheckBig` directly because platform code cannot import upward from a module; a focused launcher test will preserve that matching choice.

### Separate product concepts from generic interaction chrome

The registry will cover entities, planning views and horizons, durable metadata and states, source types, creation actions, and module-level utilities. Transient mechanics such as Back, Next, Close, Confirm, move arrows, and ellipsis remain ordinary component-local Lucide choices because their semantics come from standard UI behavior rather than the Tasks domain.

This boundary keeps the registry useful instead of turning it into a re-export of the complete Lucide package.

### Keep a complete human-readable reference

Add `docs/human/TASKS_ICONOGRAPHY.md` with the canonical concept, Lucide export name, and usage notes. The explicit override list and every currently established registry concept will be represented there. The OpenSpec requirement protects the behavioral contract, while a source test protects exact component identity.

### Preserve accessibility independently from glyph choice

Icons remain `aria-hidden` when adjacent text or a programmatic control name already communicates the action. Icon-only controls retain their existing nonempty accessible labels. No user-facing meaning will depend on recognizing a glyph alone.

## Risks / Trade-offs

- **[Risk] A later component bypasses the registry** → Document the rule, export semantic names, and test the registry's exact mapping so future reviews have one clear reference.
- **[Risk] A Lucide export changes in a dependency update** → TypeScript and the registry test fail at build time instead of silently changing the UI.
- **[Risk] Platform and module icons drift because module isolation prevents one import** → Keep the launcher mapping explicit in documentation and preserve its existing launcher test coverage.
- **[Risk] Broad replacement collides with current uncommitted Tasks work** → Edit only semantic icon imports and affected JSX, preserve surrounding changes, and validate the complete working tree after focused tests pass.
