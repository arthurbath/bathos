# Installed Module Shell Specification

## Purpose

Define the shared shell, account controls, module-local control placement, and navigation containment used when a BathOS module runs as a standalone PWA or inside a declared native host.

## Requirements

### Requirement: Shared Installed-App Context
BathOS SHALL identify standalone PWAs and declared native module hosts as installed-app contexts and SHALL associate each installed context with exactly one BathOS module.

#### Scenario: Run a module in an ordinary browser tab
- **WHEN** a user visits a BathOS module without standalone display mode or a native host declaration
- **THEN** BathOS treats the session as an ordinary web context

#### Scenario: Run an installed module PWA
- **WHEN** a module launches with standalone PWA display mode
- **THEN** BathOS treats the session as installed and binds it to the module represented by its launch route

#### Scenario: Run a declared native module host
- **WHEN** a native host injects a valid BathOS native-app descriptor with a supported module identifier
- **THEN** BathOS treats the session as installed and binds it to that declared module

### Requirement: Conditional Platform Navigation
BathOS SHALL show the platform top navigation in ordinary browser contexts and SHALL remove it from installed module contexts without removing module-local navigation.

#### Scenario: View any module on the web
- **WHEN** Budget, Drawers, Garage, Snake, Tasks, or Wardrobe runs in an ordinary browser tab
- **THEN** its existing platform top navigation, module switcher access, user controls, and module-local navigation remain available

#### Scenario: View any module while installed
- **WHEN** Budget, Drawers, Garage, Snake, Tasks, or Wardrobe runs as a standalone PWA or declared native app
- **THEN** the platform top navigation and module switcher are absent while the module's desktop or bottom navigation remains available

#### Scenario: Respect an installed-device safe area
- **WHEN** the platform top navigation is absent in an installed context with a nonzero top safe area
- **THEN** module content remains clear of the device status area without rendering platform controls

### Requirement: Installed Account Actions
Every installed public BathOS module SHALL expose the current account identity, Account, Feedback, and Sign Out from a shared card at the bottom of its Config view, and SHALL omit that card in ordinary web contexts.

#### Scenario: Open an installed module Config view
- **WHEN** a signed-in user opens Config in an installed Budget, Drawers, Garage, Snake, Tasks, or Wardrobe module
- **THEN** the final Config card shows the current display name and actions for Account, Feedback, and Sign Out

#### Scenario: Open a Config view on the web
- **WHEN** a user opens a module Config view in an ordinary browser tab
- **THEN** the installed account card is absent because the platform user controls remain in the top navigation

#### Scenario: Open Account from an installed module
- **WHEN** the user activates Account from the installed account card
- **THEN** BathOS opens the account screen inside the installed app and provides a local route back to the originating module Config view

#### Scenario: Sign out from an installed module
- **WHEN** the user signs out through the installed account card
- **THEN** BathOS returns to that installed module's launch route and presents its signed-out authentication experience without exposing the platform launcher

### Requirement: Installed-Only Wardrobe Config
Wardrobe SHALL provide a Config view containing the installed account card only when Wardrobe is running in an installed context.

#### Scenario: Navigate installed Wardrobe
- **WHEN** Wardrobe runs as a standalone PWA
- **THEN** Config appears in Wardrobe module navigation and `/wardrobe/config` renders the installed account card

#### Scenario: Navigate Wardrobe on the web
- **WHEN** Wardrobe runs in an ordinary browser tab
- **THEN** its navigation contains only Items and direct access to `/wardrobe/config` returns the user to `/wardrobe/items`

### Requirement: Installed Module-Local Header Actions
Module controls that remain necessary in installed use SHALL have a module-local location outside the removed platform top navigation.

#### Scenario: Switch Garage vehicles while installed
- **WHEN** an installed Garage session has multiple vehicles
- **THEN** the active-vehicle selector is available in Garage's page body and changes the active vehicle using the existing behavior

#### Scenario: Switch Snake entities while installed
- **WHEN** an installed Snake session has one or more snakes
- **THEN** the active-snake selector is available in Snake's page body and changes the active snake using the existing behavior

#### Scenario: Use Garage or Snake on the web
- **WHEN** Garage or Snake runs in an ordinary browser tab
- **THEN** its selector retains the existing top-navigation placement and is not duplicated in the page body

### Requirement: Installed Cross-Module Containment
An installed module SHALL retain same-module and required account/auth navigation inside its application context and SHALL open other BathOS modules and unrelated destinations outside that context.

#### Scenario: Follow a same-module link
- **WHEN** a user activates a link whose destination belongs to the installed module
- **THEN** the destination remains inside the installed app

#### Scenario: Follow an Account or authentication support link
- **WHEN** a user activates an Account, sign-in, sign-up, password recovery, terms, or help route required by the installed module
- **THEN** BathOS may keep that route inside the installed app

#### Scenario: Follow another BathOS module
- **WHEN** a user activates a link from the installed module to a different BathOS module, Administration, or the platform launcher
- **THEN** BathOS opens the destination in an external browser context and leaves the installed module at its current route

#### Scenario: Follow an unrelated external destination
- **WHEN** a user activates an HTTP, HTTPS, or application-protocol destination outside the installed module
- **THEN** the operating system or external browser handles the destination instead of replacing the installed module

### Requirement: Installed module navigation uses the shared floating mobile presentation
Installed BathOS modules SHALL retain their module-local mobile destinations inside the shared floating-pill bottom navigation, including safe-area spacing and overflow access, while the platform top navigation remains absent.

#### Scenario: Use an installed module on a rounded mobile viewport
- **WHEN** a module runs in native or standalone installed mode on a mobile viewport
- **THEN** its local navigation floats above the bottom safe area inside the shared rounded outer pill without touching the viewport edges

#### Scenario: Open an overflow destination
- **WHEN** a module has more direct destinations than the floating navigation presents
- **THEN** the shared overflow control remains keyboard- and touch-accessible from its nested pill
