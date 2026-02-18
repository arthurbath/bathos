# AGENTS.md — BathOS Project Instructions

This file contains shared project conventions for any AI agent working on BathOS. All agents should read and follow these rules.

## What is BathOS?

BathOS is a shared household platform — a collection of small, focused tools ("modules") for people who live together. Each module lives on its own subdomain (e.g., `budget.bath.garden`) and handles one aspect of running a home. The platform root (`bath.garden`) serves the launcher and account management.

## Architecture

- **Stack**: React, TypeScript, Vite, Tailwind CSS, Supabase
- **Module isolation**: Each module is self-contained under `src/modules/[name]/`. Removing a module should require only deleting its files, routes, DB tables, and launcher entry. Never import from one module into another.
- **Shared code**: `src/platform/` (auth, layout, launcher), `src/components/ui/` (shadcn primitives), `src/lib/` (utilities)
- **Database prefixes**: All tables use a namespace prefix — `bathos_` for platform tables, `budget_` for Budget, future modules use their own (e.g., `tracker_`)
- **Routing**: Client-side subdomain detection via `useHostModule`. Path-based fallback (`/budget/...`) is used in development and preview environments.
- **Security**: RLS on all tables. Admin roles in `bathos_user_roles`. SECURITY DEFINER functions for RLS checks to avoid recursion.

## Modules

### Budget (`budget.bath.garden`)
Split shared expenses fairly between two partners. Combines per-expense benefit splits with relative monthly income to calculate each person's fair share. Features: spreadsheet-style data entry, category/payer/payment-method grouping, income tracking with flexible frequency, settlement summary, backup/restore points, partner invite codes.

## Style Guide

- **Design philosophy**: Black-and-white minimalism. Clean, pragmatic, data-focused. No decorative gradients or shadows.
- **Colors are semantic**: `primary` (near-black), `success` (green), `warning` (gold), `destructive` (red), `info` (blue), `admin` (purple). Never use color purely for decoration.
- **Typography**: Inter with system-ui fallback. No custom display fonts.
- **Icons**: Lucide React only. Inline SVGs, no image files, no emoji. Use sparingly.
- **Voice**: Pragmatic and neutral. No exclamation points. No marketing language. Prefer self-evident UI over helper text.
- **Layout**: Mobile-first. `max-w-5xl` for data views, `max-w-lg` for forms.
- **Theming**: All colors via CSS custom properties in `index.css` with HSL values. Use Tailwind semantic tokens, never raw color values in components.
- **Dark mode**: Fully supported via CSS variable variants.

## Development Policies

- **Evaluations**: Security, performance, and technology evaluations go in dated files (`docs/evaluations/YYYY-MM-DD_topic.md`). Never delete old evaluations — they serve as a decision log.
- **README.md**: Keep updated whenever modules are added, changed, or removed. Only document modules visible to general users (not behind admin-only feature flags).
- **Adding a module**: See `docs/MODULE_GUIDE.md` for the full checklist (namespace, tables, files, routes, launcher registration, subdomain).
- **Testing**: Run existing tests before submitting changes. Write tests for new logic when practical.

## File References

- `docs/ARCHITECTURE.md` — detailed architecture
- `docs/MODULE_GUIDE.md` — step-by-step module creation
- `docs/STYLE_GUIDE.md` — full design conventions
- `docs/evaluations/` — decision log
