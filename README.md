# BathOS

BathOS is a shared household platform — a collection of small, focused tools for people who live together. Each tool (called a **module**) lives under its own path prefix and handles one aspect of running a home.

The platform is live at [os.bath.garden](https://os.bath.garden).

## Modules

### Budget

Split shared expenses fairly between two partners. The Budget module calculates each person's fair share by combining per-expense benefit splits with relative monthly income. Features include:

- Spreadsheet-style data entry with keyboard navigation
- Grouping by category, payer, payment method, or estimation status
- Automatic payer inheritance from assigned payment methods
- Income tracking with flexible frequency options (weekly, fortnightly, monthly, yearly, custom)
- Simple and averaged line items (monthly or yearly averaged records)
- Settlement summary showing who owes whom
- Backup and restore points for household data
- Partner invite codes for joining an existing household
- Household membership controls: view members, rotate invite code, remove members, leave household, and delete household

Accessible at [os.bath.garden/budget/summary](https://os.bath.garden/budget/summary).

### Drawers

Plan and label Kallax-style cubby layouts across one or more named units in a shared household space. Features include:

- Multiple named units with configurable width/height (1-6 by 1-6)
- Insert planning with `Black`, `Wicker`, and `White` insert types
- Limbo staging area for unplaced inserts
- Click-to-move workflow for placing and relocating inserts
- Household invite code flow for sharing the same drawer layout
- Household membership controls: view members, rotate invite code, remove members, leave household, and delete household

Accessible at [os.bath.garden/drawers/plan](https://os.bath.garden/drawers/plan).

### Garage

Track vehicle maintenance schedules and service history for each user account. Features include:

- Vehicle profiles with odometer and in-service date tracking
- Configurable recurring maintenance services by miles and/or months
- CSV bulk import for services with a downloadable template and overwrite preview
- Due and upcoming service views based on mileage and time intervals
- Service visit logging with outcomes and notes
- Receipt attachments with editable names listed in service history

Accessible at [os.bath.garden/garage/due](https://os.bath.garden/garage/due).

### Snake

Track snake weight records and growth expectations in a shared household. The first growth profile supports ball pythons. Features include:

- One or more snake profiles per household
- Snake facts such as name, birthday, species, morph, sex, and notes
- Weight records by snake with date and grams
- Automatic previous-record detection from weigh-in dates
- Derived monthly growth rate, age at weigh-in, expected growth range, and growth status
- Household invite code flow and membership controls for co-owners

Accessible at [os.bath.garden/snake/weights](https://os.bath.garden/snake/weights).

### Tasks

Plan and complete personal tasks through a private-first, keyboard-focused workflow. Features include:

- Inbox, Today, Upcoming, Anytime, Someday, Logbook, and Trash views
- Areas, projects, headings, checklists, templates, reminders, and recurrence
- Structured actionability and source provenance without generic tags
- Offline local operation, recoverable deletion, history, export, and restore
- Narrow task-domain MCP tools and Raycast capture commands

Accessible at [os.bath.garden/tasks/today](https://os.bath.garden/tasks/today). Production synchronization and browser reminder delivery are active.

See the [Tasks Guide](docs/human/TASKS_GUIDE.md) for setup, daily workflow, keyboard commands, reminders, backup, recovery, and the current parallel-use boundary.

### Wardrobe

Track clothing items for a personal wardrobe. Features include:

- Full-width data grid for wardrobe item records
- Optional category and status fields with predefined system values
- Status filtering and grouping by category, brand, or status
- URL field validation with open-link support
- Row duplication and deletion from the item actions menu

Accessible at [os.bath.garden/wardrobe/items](https://os.bath.garden/wardrobe/items).

## Development notes

- Built with React, TypeScript, Vite, Tailwind CSS, and Supabase
- Modules are isolated under `src/modules/[name]/` — removing one should not break another
- Database tables use namespace prefixes (`bathos_`, `budget_`, `drawers_`, `garage_`, `snake_`, `tasks_`, `wardrobe_`) for clarity
- Module path routing is handled client-side using path prefixes (`/budget/...`, `/drawers/...`, `/garage/...`, `/snake/...`, `/tasks/...`, `/wardrobe/...`)
- OpenSpec is used for non-trivial behavior, UI paradigm, shared component, routing, auth, data, and database changes; validate specs with `npm run spec:validate`
- See `docs/agents/ARCHITECTURE.md` for structure, `docs/agents/MODULE_GUIDE.md` for adding modules, and `docs/human/STYLE_GUIDE.md` for design conventions

### Dev Console Bridge (Safari + Vite)

- In local dev (`npm run dev`), browser `console.log/info/warn/error/debug`, uncaught errors, and unhandled promise rejections are mirrored to the Vite terminal.
- This works for Safari and other browsers, and stays available for this repo as long as the bridge files remain in source control.
- The bridge is dev-only and does not run in production builds.
