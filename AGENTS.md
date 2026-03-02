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
- **Layout**: Mobile-first. `max-w-5xl` for data views, `max-w-lg` for forms.
- **Theming**: All colors via CSS custom properties in `index.css` with HSL values. Use Tailwind semantic tokens, never raw color values in components.
- **Theme mode**: BathOS is dark-only. Do not introduce light-mode variants or runtime theme switching.
- **Form modal keyboard policy**: For all form-style modals, support full Tab/Shift+Tab traversal through all controls; inputs edit directly on focus; focused Select triggers open with Space/Enter and are fully keyboard selectable; checkboxes retain focus after toggle so tab navigation continues naturally.
- **DataGrid resize policy**: All DataGrids (card and full-view) must resize columns in 20px increments and must persist column widths through the shared localStorage + `bathos_user_settings.grid_column_widths` mechanism (`useGridColumnWidths`). The trailing actions/ellipsis column is a fixed-width special case: `40px`.
- **DataGrid add-button policy**: Use the Budget-style compact green outline icon button for adding grid rows (`variant="outline-success"`, `size="sm"`, `className="h-8 w-8 p-0"`, plus icon, and an `aria-label`), opening a modal form.
- **DataGrid filter-controls policy**: When grid cards expose filters/grouping, use the Budget Expenses control pair: `Filters` button (`variant="outline"`, `size="sm"`, `className="h-8 gap-1.5"`, `Filter` icon) plus a conditional clear button when active (`variant="outline-warning"`, `size="sm"`, `className="h-8 w-8 p-0"`, `FilterX` icon, clear-filters aria-label).
- **Grouped DataGrid header policy**: For grouped tables, render the first group-header cell as `Label (count)` so row counts are visible in-situ for every group.
- **Link behavior policy**: Any UI that navigates to another in-app route must be coded as a real link (`href`) and preserve default browser modified-click behavior (CMD/CTRL-click and middle-click open new tab); only plain left click should be intercepted for SPA navigation.

## Development Policies

- **Evaluations**: Security, performance, and technology evaluations go in dated files (`docs/evaluations/YYYY-MM-DD_topic.md`). Never delete old evaluations — they serve as a decision log.
- **README.md**: Keep updated whenever modules are added, changed, or removed. Only document modules visible to general users (not behind admin-only feature flags).
- **Public `.env` policy**: This repository is public, and `.env` is intentionally committed for Lovable workflows. Treat `.env` as public and only store client-safe values there. Never commit secrets (for example: service role keys, SMTP passwords, API secrets, private tokens). Store real secrets in managed secret stores (Supabase/hosting environment secrets), not in the repo.
- **Adding a module**: See `docs/MODULE_GUIDE.md` for the full checklist (namespace, tables, files, routes, launcher registration).
- **Testing**: Run existing tests before submitting changes. Write tests for new logic when practical.

## File References

- `docs/ARCHITECTURE.md` — detailed architecture
- `docs/MODULE_GUIDE.md` — step-by-step module creation
- `docs/STYLE_GUIDE.md` — full design conventions
- `docs/evaluations/` — decision log
