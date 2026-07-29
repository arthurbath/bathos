## Why

BathOS currently has a brittle native WebKit keyboard handoff, abrupt task-draft cleanup, and mobile surfaces that do not yet share one coherent installed-app visual language. These issues are especially visible on iOS, where reliable text entry, touch gestures, dark launch surfaces, and compact floating navigation are core usability expectations.

## What Changes

- Replace the Tasks companion's narrow new-task keyboard primer with a reliable native-to-WebKit responder strategy that works whenever a user begins editing a web text control.
- Animate the removal of an empty new-task draft after its editor closes.
- Restyle the shared mobile navigation as an opaque floating outer pill containing smaller pill-shaped destinations across BathOS modules.
- Unify the root application, platform header, and card backgrounds on the existing BathOS application background color, including pre-React and native WebView launch surfaces.
- Add responsive touch swipe affordances to task rows: left reveals selection intent and enters selection mode, while right reveals planning intent and opens the task's Start picker.
- Move editing focus from the end of Summary to the beginning of Notes when the user presses Right Arrow.
- Standardize generic external-link actions on Lucide `ExternalLink`, while retaining protocol-specific icons for destinations such as Mail messages.

## Capabilities

### New Capabilities

- `platform-visual-foundations`: Shared dark surface, floating mobile navigation, and canonical external-link icon behavior across BathOS.

### Modified Capabilities

- `tasks-ios-companion`: Native WebKit text fields reliably summon the iOS software keyboard and native launch surfaces remain dark.
- `personal-tasks-module`: Empty-draft removal, bidirectional touch swipes, Summary-to-Notes traversal, and task Primary Link iconography gain the requested behavior.
- `installed-module-shell`: Installed and mobile module navigation adopts the shared floating-pill presentation without changing route availability.

## Impact

The change affects the iOS Tasks companion WebView host and native tests, shared platform navigation and visual tokens, root HTML/CSS loading surfaces, Tasks list gestures and editor keyboard handling, task and native-widget link iconography, shared documentation, and focused/full web and native validation. It adds no database objects, migrations, service authority, or new runtime dependency.
