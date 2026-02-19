# BathOS Style Guide

## Design Philosophy

Black-and-white minimalism. Clean, pragmatic, data-focused. No decorative gradients. Shadows only for functional layering (e.g., dropdowns, modals).

## Colors

Colors are semantic, not decorative:

| Token | Usage |
|---|---|
| `primary` | Near-black. Buttons, links, focus rings, text |
| `success` | Green. Confirmation, positive states |
| `warning` | Gold/amber. Caution states |
| `destructive` | Red. Errors, danger, destructive actions |
| `info` | Blue. Informational, help text |
| `admin` | Purple. Admin privilege indicators only |

Never use colors purely for decoration. Every color must carry meaning.

## Typography

- Body: Inter (system-ui fallback)
- Icons: Lucide React (inline SVGs, tree-shakable)
- No custom display fonts. Let the content speak.

## Voice

- Pragmatic and neutral
- No exclamation points, even for destructive actions
- No marketing language in the UI
- Helper text is used sparingly — prefer self-evident UI

## Icons

- All iconography uses Lucide React (`lucide-react`)
- Icons are inline SVGs — no image files, no emoji
- Use sparingly. Not every element needs an icon.

## Spacing and Sizing

- Consistent use of Tailwind spacing scale
- Mobile-first responsive design
- Max content width: `max-w-5xl` for data views, `max-w-lg` for forms
- Cards use standard `Card` component with minimal padding

## Form Modal Interaction

All form-style modals (Add/Edit dialogs) must follow one keyboard interaction model:

- Tab moves focus forward through every interactive field in top-to-bottom order; Shift+Tab moves backward.
- Inputs use native editing behavior on focus (no separate focus/edit modes).
- Selects are keyboard-usable from the trigger: Space/Enter opens, arrow keys navigate options, Enter/Space confirms.
- Checkboxes keep/receive focus when toggled so tabbing can continue naturally afterward.
- Custom controls (e.g., color pickers) must remain in the normal tab order and be keyboard operable.

This is a standing standard for all new and updated form modals.

## Shadows and Borders

- Borders: 1px, using `border` token
- Shadows: Only for elevated elements (dropdowns, modals, active tabs)
- No decorative box shadows on cards or sections

## Dark Mode

Full dark mode support via CSS variables. All semantic tokens have light and dark variants defined in `index.css`.
