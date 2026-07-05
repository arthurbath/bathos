# AGENTS.md — BathOS Project Instructions

This file contains shared project conventions for any AI agent working on BathOS. All agents should read and follow these rules.

## What is BathOS?

BathOS is a shared household platform — a collection of small, focused tools ("modules") for people who live together. Modules are served with path-based routing (for example, `/budget/...`) and each handles one aspect of running a home.

## Architecture

- **Stack**: React, TypeScript, Vite, Tailwind CSS, Supabase
- **Module isolation**: Each module is self-contained under `src/modules/[name]/`. Removing a module should require only deleting its files, routes, DB tables, and launcher entry. Never import from one module into another.
- **Shared code**: `src/platform/` (auth, layout, launcher), `src/components/ui/` (shadcn primitives), `src/lib/` (utilities)
- **Database prefixes**: All tables use a namespace prefix — `bathos_` for platform tables, `budget_` for Budget, future modules use their own (e.g., `tracker_`)
- **Routing**: Client-side module detection via `useHostModule` using the URL path prefix (`/budget/...`, `/drawers/...`, `/garage/...`).
- **Security**: RLS on all tables. Admin roles in `bathos_user_roles`. SECURITY DEFINER functions for RLS checks to avoid recursion.

## Modules

### Budget (`/budget/...`)
Split shared expenses fairly between two partners. Combines per-expense benefit splits with relative monthly income to calculate each person's fair share. Features: spreadsheet-style data entry, category/payer/payment-method grouping, income tracking with flexible frequency, settlement summary, backup/restore points, partner invite codes.

## Style Guide

- **Design philosophy**: Black-and-white minimalism. Clean, pragmatic, data-focused. No decorative gradients or shadows.
- **Colors are semantic**: `primary` (near-black), `success` (green), `warning` (gold), `destructive` (red), `info` (blue), `admin` (purple). Never use color purely for decoration.
- **Typography**: Inter with system-ui fallback. No custom display fonts.
- **Icons**: Lucide React only. Inline SVGs, no image files, no emoji. Use sparingly.
- **Voice**: Pragmatic and neutral. No exclamation points. No marketing language. Prefer self-evident UI over helper text.
- **Label casing**: Buttons, card titles, modal titles, input labels, and section titles use Title Case.
- **Modal headers**: Form-style modals use a title-only header by default. Do not add modal header subtext unless the task explicitly asks for it.
- **Required field treatment**: In form-style modals, indicate required fields with a red asterisk immediately to the right of the field label. Do not show required-field validation text underneath a field on initial modal open when the Save action is already disabled until required fields are complete. Reserve inline validation messages for actionable input problems such as duplicate values, invalid formats, or failed submit attempts.
- **Layout**: Mobile-first. `max-w-5xl` for data views, `max-w-lg` for forms.
- **Theming**: All colors via CSS custom properties in `index.css` with HSL values. Use Tailwind semantic tokens, never raw color values in components.
- **Theme mode**: BathOS is dark-only. Do not introduce light-mode variants or runtime theme switching.
- **Form modal keyboard policy**: For all form-style modals, support full Tab/Shift+Tab traversal through all controls; inputs edit directly on focus; focused Select triggers open with Space/Enter and are fully keyboard selectable; checkboxes retain focus after toggle so tab navigation continues naturally.
- **Date input policy**: For form-style modals and non-grid date inputs, use the shared `DatePickerField` button-plus-calendar popover. Do not use native text/date inputs for dates unless a task explicitly requires typed date entry. DataGrid inline date cells may use grid-specific controls only when they preserve the shared DataGrid keyboard navigation contract.
- **DataGrid resize policy**: All DataGrids (card and full-view) must resize columns in 20px increments and must persist column widths through the shared localStorage + `bathos_user_settings.grid_column_widths` mechanism (`useGridColumnWidths`). The trailing actions/ellipsis column is a fixed-width special case: `40px`.
- **DataGrid focus/scroll policy**: All DataGrids must use the shared `DataGrid` keyboard navigation and focus-restoration behavior. Blur/save must not cause extra scroll judder; the only allowed scroll adjustment is what is needed to keep the focused cell fully visible after keyboard navigation or async save restoration. Visibility calculations must account for sticky headers, sticky grouped rows, sticky footers, and pinned side columns so focused cells are never partially hidden under sticky grid chrome.
- **DataGrid async-save display policy**: While a grid row is in its disabled saving state after a commit, the cells must continue showing the user’s just-committed value rather than snapping back to the pre-edit value. Grid data hooks should use optimistic updates or equivalent state so the visible row data matches the committed value until the save either succeeds or rolls back.
- **DataGrid delete-reset policy**: Focused grid controls must use the shared delete/backspace reset convention. `Delete`/`Backspace` should only reset a field when that control explicitly declares an allowed reset target through the shared grid helpers/props. Allowed resets are: clear to empty string for nullable text/number fields, reset to `0` for zeroable required numeric fields, reset checkboxes to unchecked, and reset selects only when they expose a real null/none option. Required fields that cannot accept empty/`0`/null must ignore the key entirely.
- **DataGrid add-button policy**: Use the Budget-style compact green outline icon button for adding grid rows (`variant="outline-success"`, `size="sm"`, `className="h-8 w-8 p-0"`, plus icon, and an `aria-label`), opening a modal form.
- **DataGrid filter-controls policy**: When grid cards expose filters/grouping, use the Budget Expenses control pair: `Filters` button (`variant="outline"`, `size="sm"`, `className="h-8 gap-1.5"`, `Filter` icon) plus a conditional clear button when active (`variant="outline-warning"`, `size="sm"`, `className="h-8 w-8 p-0"`, `FilterX` icon, clear-filters aria-label).
- **Grouped DataGrid header policy**: For grouped tables, render the first group-header cell as `Label (count)` so row counts are visible in-situ for every group.
- **Link behavior policy**: Any UI that navigates to another in-app route must be coded as a real link (`href`) and preserve default browser modified-click behavior (CMD/CTRL-click and middle-click open new tab); only plain left click should be intercepted for SPA navigation.

## Development Policies

- **OpenSpec workflow**: BathOS uses OpenSpec as the change-contract layer. Non-trivial product, behavior, UI paradigm, shared component, routing, auth, data, Supabase, or database work requires an OpenSpec change before implementation. Start unclear work with `/opsx:explore`, start scoped implementation with `/opsx:propose <change-id>`, implement from `/opsx:apply`, keep artifacts current when discoveries change behavior, validate with `npm run spec:validate`, and archive completed changes with `/opsx:archive` or `openspec archive <change-id> --yes`.
- **OpenSpec scope**: Do not bulk-backfill specs for untouched existing modules. Create or update specs piecemeal as modules, views, shared components, or global paradigms are touched. Existing docs remain source material; durable behavior contracts live in `openspec/specs/`. Future broad implementation plans should use `openspec/changes/`; `docs/agents/plans/` is historical.
- **OpenSpec skip policy**: Trivial typo, comment, docs-only, or tooling-only changes may skip OpenSpec only with an explicit "no spec impact" note in the final response or change summary.
- **Evaluations**: Security, performance, and technology evaluations go in dated files (`docs/agents/evaluations/YYYY-MM-DD_topic.md`). Never delete old evaluations — they serve as a decision log.
- **README.md**: Keep updated whenever modules are added, changed, or removed. Only document modules visible to general users (not behind admin-only feature flags).
- **Public `.env` policy**: This repository is public, and `.env` is intentionally committed for Lovable workflows. Treat `.env` as public and only store client-safe values there. Never commit secrets (for example: service role keys, SMTP passwords, API secrets, private tokens). Store real secrets in managed secret stores (Supabase/hosting environment secrets), not in the repo.
- **Adding a module**: See `docs/agents/MODULE_GUIDE.md` for the full checklist (namespace, tables, files, routes, launcher registration).
- **Testing**: Run existing tests before submitting changes. Write tests for new logic when practical.

### Common Local Commands

- `npm run dev` — Start the Vite dev server. Browser console logs/errors are mirrored to the terminal in local dev.
- `npm run test` — Run the full Vitest suite once.
- `npm run test:watch` — Run Vitest in watch mode during iterative work.
- `npm run lint` — Run ESLint across the repo.
- `npm run build` — Produce a production build with Vite.
- `npm run spec:validate` — Validate OpenSpec changes and durable specs.

## File References

- `openspec/config.yaml` — OpenSpec BathOS context and artifact rules
- `openspec/changes/` — active OpenSpec proposals, specs, designs, and tasks
- `openspec/specs/` — durable behavior specs grown from archived changes
- `docs/agents/ARCHITECTURE.md` — detailed architecture
- `docs/agents/MODULE_GUIDE.md` — step-by-step module creation
- `docs/human/STYLE_GUIDE.md` — full design conventions
- `docs/agents/evaluations/` — decision log
- `docs/agents/plans/` — historical agent-authored implementation plans
- `docs/human/terms/` — human-facing policy documents
