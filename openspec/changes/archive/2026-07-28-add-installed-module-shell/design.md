## Context

Every public BathOS module already publishes a standalone PWA manifest, while Tasks additionally runs inside a thin native WebKit companion. Module shells share `ToplineHeader`, but installed context detection is currently local to that component and only adjusts the iOS safe area. The header owns the platform launcher control, account menu, and, for Garage and Snake, an active-entity selector. Wardrobe is the only public module without a Config route.

The Tasks companion currently allows every HTTPS path on the trusted BathOS host to remain inside WebKit. That protects the native bridge by origin and route checks, but it can still strand the user in another BathOS module with no native browser controls.

## Goals / Non-Goals

**Goals:**

- Establish one shared definition of installed mode for standalone PWAs and native module hosts.
- Remove platform-level navigation from installed module experiences without removing module-local navigation.
- Preserve account, feedback, and sign-out access from every installed module.
- Keep module-only controls available after the shared header is hidden.
- Prevent the Tasks companion from becoming a general-purpose BathOS browser.
- Preserve ordinary browser behavior and module navigation.

**Non-Goals:**

- Redesign module-local desktop or bottom navigation.
- Add native apps for modules other than Tasks.
- Add module configuration features to Wardrobe beyond installed account controls.
- Change authentication providers, account data, feedback persistence, or Supabase schema.
- Force external navigation from ordinary browser tabs.

## Decisions

### Use one shared installed-context authority

`src/platform/installedApp.ts` will identify:

- a standalone PWA through `navigator.standalone` or the standalone display-mode media query
- a native host through a generic `window.__bathosNativeApp` descriptor injected by the companion
- the installed module from the native descriptor, current module route, or an installed-session cache established from the launch route

The existing Tasks-specific bridge remains responsible for widget projection and credentials. Platform presentation code will not import from the Tasks module.

Alternative considered: infer native mode from the Tasks bridge handler. This would couple shared platform behavior to one module and make future native hosts harder to add.

### Let `ToplineHeader` own conditional removal

Every current module shell already uses `ToplineHeader`. The component will render only a safe-area spacer in installed mode and preserve its full current behavior in ordinary web mode. This applies the rule uniformly without duplicating conditions across modules.

Account pages reached from installed Config will render their own compact Back action in page content because their shared platform header is also absent.

Alternative considered: conditionally omit the component in every module. This is more repetitive and risks drift as modules are added.

### Put installed account actions in a shared Config card

`InstalledAppAccountCard` will render only in installed mode and expose:

- the current display name
- an internal Account link that remembers the module return route
- the existing Feedback dialog
- Sign Out

Each existing Config view will append this card after module-specific settings. Wardrobe will add `/wardrobe/config`, expose it only in installed navigation, and redirect direct ordinary-web access back to Items.

Alternative considered: preserve a smaller user icon outside the hidden header. That would retain the same platform chrome pattern the change is intended to remove.

### Preserve header-only module controls in local page chrome

Garage's active-vehicle selector and Snake's active-snake selector will render in a compact module-local toolbar in installed mode. Their existing header placement remains unchanged on the ordinary web.

### Eject cross-module navigation from installed apps

A shared capture-phase installed-navigation guard will recognize same-origin links that leave the installed module. It will open those destinations in a new external browsing context while allowing:

- routes inside the installed module
- Account and required authentication/support routes

The native Tasks companion will independently enforce the same boundary at the WebKit navigation delegate, allowing `/tasks` and required platform routes while opening all other URLs through `UIApplication`.

Both layers are intentional. The web layer covers standalone PWAs, while the native delegate remains the authoritative containment boundary for the companion.

### Keep sign-out inside the installed module

The authentication context will redirect sign-out to the installed module's launch path instead of `/`. The module route can then render its existing signed-out authentication page without revealing the platform launcher. Ordinary web sign-out continues to use `/`.

## Risks / Trade-offs

- [Risk] Installed-mode detection can be unavailable before the first module route is observed → The native descriptor provides an explicit module, and standalone PWAs cache the module identity for the installed browsing session.
- [Risk] Opening a same-origin module link externally varies across PWA implementations → Use a user-initiated new browsing context in the web layer and authoritative `UIApplication` handling in the native companion.
- [Risk] Removing the header exposes notch or status-bar collisions → Preserve a safe-area-only spacer without platform controls.
- [Risk] A new header accessory could disappear in installed mode → Document that module-local actions cannot exist only in `ToplineHeader.titleAccessory`, and add coverage for current Garage and Snake selectors.
- [Risk] Account navigation loses its Back control → Add an installed-only page-local Back link using the existing `fromPath` state.

## Migration Plan

1. Ship the backward-compatible web release. Ordinary browser tabs retain the existing header and navigation.
2. Rebuild the Tasks companion so it injects the generic native descriptor and enforces the narrower route policy.
3. Validate each public module in simulated standalone mode and validate Tasks on the native test target.
4. Roll back by reverting the shared installed-mode checks and native route policy. No data migration or server rollback is required.

## Open Questions

None. The shared rule and the current module-specific exceptions are fully determined by the requested behavior and repository inventory.
