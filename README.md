# BathOS

BathOS is a shared household platform — a collection of small, focused tools for people who live together. Each tool (called a **module**) lives on its own subdomain and handles one aspect of running a home.

The platform is live at [bath.garden](https://bath.garden).

## Modules

### Budget

Split shared expenses fairly between two partners. The Budget module calculates each person's fair share by combining per-expense benefit splits with relative monthly income. Features include:

- Spreadsheet-style data entry with keyboard navigation
- Grouping by category, payer, payment method, or estimation status
- Automatic payer inheritance from assigned payment methods
- Income tracking with flexible frequency options (weekly, fortnightly, monthly, yearly, custom)
- Settlement summary showing who owes whom
- Backup and restore points for household data
- Partner invite codes for joining an existing household

Accessible at [budget.bath.garden](https://budget.bath.garden).

## Development notes

- Built with React, TypeScript, Vite, Tailwind CSS, and Supabase
- Modules are isolated under `src/modules/[name]/` — removing one should not break another
- Database tables use namespace prefixes (`budget_`, `bathos_`) for clarity
- Subdomain routing is handled client-side; path-based fallback (`/budget/...`) is used in development
- See `docs/ARCHITECTURE.md` for structure, `docs/MODULE_GUIDE.md` for adding modules, and `docs/STYLE_GUIDE.md` for design conventions

### Dev Console Bridge (Safari + Vite)

- In local dev (`npm run dev`), browser `console.log/info/warn/error/debug`, uncaught errors, and unhandled promise rejections are mirrored to the Vite terminal.
- This works for Safari and other browsers, and stays available for this repo as long as the bridge files remain in source control.
- The bridge is dev-only and does not run in production builds.
