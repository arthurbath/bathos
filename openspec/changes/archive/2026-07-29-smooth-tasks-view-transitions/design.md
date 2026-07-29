## Context

Tasks keeps one owner-bound PowerSync runtime alive across its routes. Each planning list supplies different SQL and parameters to the same watched-query hook. When the route changes, the page heading updates immediately, but the watched query can retain the prior result while reporting that it is fetching the destination result. The shell currently exposes only initial loading state, so it can briefly derive and paint a destination projection from the prior view's rows before replacing it with the settled destination rows.

## Goals / Non-Goals

**Goals:**

- Prevent stale or partially projected task rows from painting during list-to-list route changes.
- Preserve fast SPA navigation and the existing authenticated Tasks runtime.
- Use the existing Tasks loading presentation for a short, deliberate transition.
- Make pointer and keyboard navigation converge on the same route-driven behavior.
- Avoid spinner flashes during background synchronization or edits that remain in the same view.

**Non-Goals:**

- Do not delay navigation until all Tasks subsystems or remote synchronization are idle.
- Do not recreate the Tasks runtime, database, or watched query per route.
- Do not add skeleton rows, cross-fades, new dependencies, or database changes.
- Do not conceal ordinary same-view mutations behind a loading state.

## Decisions

1. **Expose watched-query fetching separately from initial loading.** `useTaskList` will return PowerSync's `isFetching` status in addition to `isLoading`. Initial loading continues to cover first render, while fetching supplies the destination-query settlement signal.

2. **Gate only list-to-list route changes.** `TasksShell` will identify changes among Today, Upcoming, Anytime, Someday, and Done. A layout effect will enter transition state before the browser paints the route-change commit, preventing the prior result from appearing under the new heading. Config, Search, Templates, and Area routes retain their existing presentation.

3. **Use a short minimum presentation interval.** Once the destination query is no longer loading or fetching, the shell will retain the spinner only long enough to avoid a single-frame flash. This interval is presentation polish, not an artificial data delay.

4. **Do not bind the spinner directly to every fetch.** PowerSync may re-evaluate the current query during synchronization and local mutations. Those same-view fetches keep the existing task list visible. Only an active route transition consumes `isFetching` as a completion signal.

5. **Keep transition state local to the shell.** This is a Tasks presentation concern and does not belong in the shared platform router or PowerSync runtime.

## Risks / Trade-offs

- **A destination query never settles** → Existing query error and loading behavior remains authoritative, and transition state clears when fetching stops so the normal error presentation can render.
- **A very fast query produces spinner flicker** → A short minimum interval makes the transition read as one deliberate state.
- **Rapid consecutive navigation leaves an obsolete timer** → Each destination change replaces the active transition token and cancels its prior timer.
- **Background sync accidentally hides the list** → Fetching alone never activates transition state; the route must change between planning lists.
