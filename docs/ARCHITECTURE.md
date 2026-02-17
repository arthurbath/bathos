# BathOS Architecture

## Overview

BathOS is a multi-module platform where each module is a self-contained application sharing a unified authentication system, design language, and database infrastructure.

## Core Principles

1. **Module isolation**: Each module is self-contained. Removing a module should not require surgery on any other module or cause unexpected consequences. Modules communicate rarely and only through well-defined interfaces.

2. **Shared infrastructure**: Authentication, user profiles, design tokens, and UI primitives are shared across all modules. Changes to shared infrastructure affect all modules uniformly.

3. **Database prefixing**: All tables use a namespace prefix for easy identification:
   - `bathos_` — shared platform tables (profiles, user_roles, user_settings)
   - `budget_` — Budget module tables
   - Future modules use their own prefix (e.g., `inventory_`, `tracker_`)

4. **Subdomain routing**: Each module lives on its own subdomain (e.g., `budget.bath.garden`). The platform root (`bath.garden`) serves the launcher and account management. In development, path-based routing (`/budget/...`) is used as a fallback.

5. **Group entity isolation**: Each module has its own concept of a "group" (e.g., Budget has "households"). Group IDs are module-specific — sharing a group in one module does not grant access in another.

## File Structure

```
src/
  platform/           — shared platform code
    components/        — header, account page, launcher, auth forms
    hooks/             — useHostModule, useIsAdmin
    contexts/          — AuthContext
  modules/
    budget/            — Budget module (formerly Split)
      components/
      hooks/
      types/
  components/ui/       — shadcn/ui primitives (shared)
  lib/                 — shared utilities
  integrations/        — Supabase client and types
  hooks/               — legacy hooks (thin wrappers)
```

## Adding a Module

See `/docs/MODULE_GUIDE.md`.

## Security

- Row Level Security (RLS) is enforced on all tables
- Admin roles are stored in `bathos_user_roles`, never in client-side storage
- The `has_role()` function uses SECURITY DEFINER to avoid RLS recursion
- Each module's data is isolated by its group membership check function
