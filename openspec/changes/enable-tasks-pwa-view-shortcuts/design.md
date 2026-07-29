## Context

Tasks already maps Command+1 through Command+6 on Mac and Control+1 through Control+6 on Windows to Today, Upcoming, Anytime, Someday, Done, and Config. Safari's installed macOS web-app shell consumes Command-number before either `keydown` or `keyup` reaches the page, so the existing JavaScript handler cannot suppress or act on it there.

## Goals / Non-Goals

**Goals:**

- Provide one dependable, documented view-navigation chord across web browsers and installed PWAs.
- Preserve compatible Command-number behavior without promising it on web surfaces that reserve it.
- Keep the keyboard-command help aligned with the reliable web contract.

**Non-Goals:**

- Circumvent browser or operating-system handling through synthetic events.
- Remove existing Command-number aliases from browsers that deliver them.
- Define the presentation for a future macOS native app beyond recording that it can advertise both chords.
- Change Tasks routes, data, or non-view Control-letter commands.

## Decisions

### Make Control-number the web contract

On Mac web surfaces, an unshifted Control+1 through Control+6 chord will resolve before the existing Control-letter command map. Number keys do not collide with the current Tasks-specific Control-letter layout, and Safari delivers them to page JavaScript.

Attempting to strengthen the Command listener was rejected because diagnostics proved Safari withholds both event phases. Native manifest menu commands were also rejected for the current web contract because they require installation-specific macOS configuration rather than working immediately in every web session.

### Retain Command-number as an unadvertised alias

The current Command-number mappings remain intact for browser surfaces that deliver them. The web help shows only Control-number for both platforms so users can rely on the documented chord. A future macOS native app can explicitly advertise both Control-number and Command-number because it can own native key commands.

### Preserve capture-phase suppression

The mounted Tasks shell will continue to intercept a recognized command in the capture phase, prevent the default action, stop later keyboard handling, and navigate exactly once.

## Risks / Trade-offs

- [Risk] Control-number is less conventional on macOS. -> The keyboard-command help makes the dependable chord explicit and consistent with the module's existing Control-based command family.
- [Risk] Retaining Command-number creates an undocumented alias. -> Tests keep both paths intentional, while user-facing help avoids promising browser-dependent behavior.
