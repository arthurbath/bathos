## Context

The shared Button primitive already exposes a `ghost` variant whose transparent border and background create the borderless treatment used in several BathOS surfaces. The variant is not represented in the Admin component showcase, while DataGrid row-action ellipsis triggers repeat the Outline variant across multiple modules and visually box every row action.

## Goals / Non-Goals

**Goals:**

- Canonize the existing `ghost` variant as the Borderless button treatment without duplicating button APIs.
- Make every trailing DataGrid row-action ellipsis visually borderless while retaining its existing dimensions, alignment, focus treatment, accessible name, and menu behavior.
- Make the style discoverable in the Admin component showcase and durable documentation.

**Non-Goals:**

- Redesign dropdown menus or non-DataGrid ellipsis buttons.
- Change DataGrid action-column width, navigation, focus restoration, or row-action contents.
- Add hover-only styling or new semantic colors.

## Decisions

1. **Use `ghost` as the implementation variant and “Borderless” as its design-system label.** The existing shared variant already provides a transparent border/background through the Button base styles. Adding a second equivalent `borderless` variant would create two APIs for one visual concept.
2. **Update DataGrid consumers directly.** Row-action triggers currently live in their owning grids because their accessible names and navigation props depend on row context. Replacing only their variant keeps those contracts intact without introducing a new wrapper abstraction.
3. **Retain transparent border geometry.** The Button base keeps a transparent border so focus can replace it with the shared focus border without changing control size. “Borderless” describes the resting visual treatment, not removal of the box-model border slot.
4. **Verify representative grids and audit every shared navigation trigger.** Focused tests cover variant output and DataGrid trigger classes, while visual QA covers the Admin showcase and at least one full DataGrid.

## Risks / Trade-offs

- **Risk: A DataGrid consumer is missed because action cells are locally implemented.** → Audit every `MoreHorizontal` trigger paired with DataGrid navigation helpers and add source-level regression coverage for the known consumers.
- **Risk: Border removal weakens focus visibility.** → Keep the shared `GRID_CONTROL_FOCUS_CLASS` and Button focus-ring behavior unchanged.
- **Risk: The icon blends into some grid backgrounds.** → Preserve inherited foreground color and disabled opacity rather than adding a module-specific color.
