## Why

BathOS module installations should behave like focused applications rather than browser windows into the entire platform. The shared platform top navigation currently exposes cross-module navigation and account actions that are appropriate on the web but distracting or unsafe inside standalone PWAs and native module hosts.

## What Changes

- Add a shared installed-app presentation contract that detects standalone PWA and native module-host contexts.
- Hide the platform top navigation for every module when it runs as an installed PWA or native app while preserving it in ordinary browser tabs.
- Add a shared account-actions card to the bottom of module Config views in installed contexts, exposing the current account identity, Account, Feedback, and Sign Out.
- Keep module-local desktop and bottom navigation available in installed contexts.
- Move Garage's active-vehicle selector and Snake's active-snake selector into their module page bodies when the top navigation is absent.
- Add an installed-only Wardrobe Config route and navigation item containing the account-actions card, while leaving ordinary Wardrobe web navigation unchanged.
- Constrain the native Tasks host to Tasks and required platform account/auth routes. Other BathOS modules and unrelated links open in the device's default application instead of replacing Tasks inside its WebKit host.
- Preserve the current module route after sign-out in an installed app so the module's sign-in experience remains inside its own shell rather than exposing the BathOS launcher.

## Capabilities

### New Capabilities

- `installed-module-shell`: Defines installed-context detection, conditional platform chrome, module-local configuration access, account controls, Wardrobe Config availability, Garage and Snake entity switching, and installed sign-out behavior.

### Modified Capabilities

- `tasks-ios-companion`: Narrows the native WebKit navigation boundary to Tasks and required account/auth routes while opening other BathOS modules and external destinations outside the companion.

## Impact

- Shared platform code under `src/platform/` for installed-context detection, conditional chrome, account actions, routing, and sign-out behavior.
- Module shells for Budget, Drawers, Garage, Snake, Tasks, and Wardrobe.
- Wardrobe routing and tests.
- The Tasks iOS companion navigation policy, injected native context, and native tests.
- No database schema, Supabase policy, PowerSync publication, or production data changes.
