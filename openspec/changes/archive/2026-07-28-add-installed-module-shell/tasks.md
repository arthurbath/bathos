## 1. Shared Installed Context

- [x] 1.1 Add shared installed-app and installed-module detection with native and standalone PWA coverage
- [x] 1.2 Hide `ToplineHeader` controls in installed contexts while preserving safe-area clearance and ordinary web behavior
- [x] 1.3 Add the installed cross-module navigation guard and installed-module sign-out destination

## 2. Shared Installed Account Controls

- [x] 2.1 Add the shared installed-only Account card with display identity, Account, Feedback, and Sign Out
- [x] 2.2 Add an installed-only local Back action to the Account page
- [x] 2.3 Append the shared card to Budget, Drawers, Garage, Snake, and Tasks Config views

## 3. Module-Specific Integration

- [x] 3.1 Add installed-only body placement for Garage's vehicle selector and Snake's snake selector
- [x] 3.2 Add the installed-only Wardrobe Config route, navigation item, and Account card
- [x] 3.3 Prove ordinary Wardrobe web navigation omits Config and redirects direct Config access

## 4. Tasks Native Containment

- [x] 4.1 Inject a generic native module descriptor from the Tasks companion
- [x] 4.2 Restrict native in-WebKit navigation to Tasks and required platform routes and open every other destination through the operating system
- [x] 4.3 Add native policy tests for same-module, account/auth, cross-module, launcher, and external destinations

## 5. Validation and Delivery

- [x] 5.1 Add focused React tests for installed detection, conditional header, navigation containment, Account card, sign-out, selectors, and Wardrobe Config
- [x] 5.2 Run focused and full application tests, TypeScript, lint, build, native tests, and strict OpenSpec validation
- [x] 5.3 Verify representative ordinary web, standalone PWA, and native Tasks rendering and navigation behavior
- [x] 5.4 Sync and archive the completed OpenSpec change, commit and push main, and prove a clean synchronized repository
