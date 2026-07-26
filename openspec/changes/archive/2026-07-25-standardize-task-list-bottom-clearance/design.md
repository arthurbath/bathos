## Context

The Tasks shell currently switches between the shared card-page bottom padding and a larger bulk-mode padding. Floating creation, bulk-selection, and mobile-navigation surfaces occupy different portions of the lower viewport, so the smaller mode can leave the final task beneath an overlay. The Title disclosure padding is already animated with the editor and only needs to increase from four to six pixels.

## Goals / Non-Goals

**Goals:**

- Use one responsive bottom-clearance token for every Tasks view and selection state.
- Include mobile safe-area clearance.
- Size the token for the largest current floating Tasks surface.
- Increase the ordinary animated Title inset to six pixels without changing motion ownership.

**Non-Goals:**

- Changing the placement or size of floating controls.
- Changing shared page-layout constants used by other BathOS modules.
- Changing task list sorting, grouping, or persistence.

## Decisions

- Define a Tasks-local bottom-clearance class rather than changing the shared card-page constant. Tasks has a denser stack of fixed controls than other modules, so the larger clearance is module-specific.
- Use `calc(env(safe-area-inset-bottom) + 11rem)` on mobile and 9rem at desktop widths. These values preserve the existing bulk-mode allowance, add explicit mobile safe-area protection, and comfortably clear the floating New Task button when bulk mode is absent.
- Apply the same class unconditionally to the Tasks main surface. View and bulk-state conditionals are removed, making the clearance uniform across Today, Upcoming, Anytime, Someday, Done, Search, Config, Templates, area, and project surfaces.
- Change the disclosure's expanded padding class from four to six pixels while leaving the zero-to-expanded padding transition synchronized with the grid row and opacity.

## Risks / Trade-offs

- Lists without floating creation controls will retain additional blank space at the end. This is intentional uniformity and prevents mode or route changes from altering scroll clearance.
- The padding uses a Tasks-local Tailwind arbitrary value. A named constant and regression tests prevent divergence among routes or modes.
