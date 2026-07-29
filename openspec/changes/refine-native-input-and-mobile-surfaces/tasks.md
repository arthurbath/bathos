## 1. Native Editing And Launch Surfaces

- [x] 1.1 Replace the brittle native Summary keyboard primer with a bounded WebKit-owned responder handoff
- [x] 1.2 Apply the canonical dark application background to the native WebView hierarchy and launch surfaces
- [x] 1.3 Add native coverage for responder behavior, lifecycle restraint, and dark-surface configuration

## 2. Shared Mobile Visual Foundations

- [x] 2.1 Restyle MobileBottomNav as an opaque floating outer pill with accessible nested-pill destinations
- [x] 2.2 Update shared page-bottom clearance for the floating navigation and safe areas
- [x] 2.3 Unify document-root, application, platform-header, and card backgrounds on the existing application color
- [x] 2.4 Add focused component and layout coverage for shared navigation and surface behavior

## 3. Tasks Interaction Refinements

- [x] 3.1 Animate empty new-task departure while preserving immediate reduced-motion cleanup
- [x] 3.2 Add progress-aware left and right touch swipe gestures with selection and Start-picker outcomes
- [x] 3.3 Add Summary end-boundary Right Arrow traversal to the beginning of Notes
- [x] 3.4 Add focused task-domain and rendered-interaction coverage for departure, gestures, and editor traversal

## 4. External-Link Iconography

- [x] 4.1 Replace generic task-row and metadata-editor link actions with canonical Lucide ExternalLink
- [x] 4.2 Apply the canonical external-link concept to the native Tasks widget while retaining protocol-specific icons
- [x] 4.3 Sweep BathOS generic external-link actions, update iconography documentation, and add regression coverage

## 5. Validation And Release

- [x] 5.1 Run focused tests, the full web suite, TypeScript, lint, build, and strict OpenSpec validation
- [x] 5.2 Run native tests and signed builds, install the matching companion, and physically verify keyboard and widget behavior
- [x] 5.3 Compare the rendered floating navigation and gesture states against the supplied reference geometry
- [ ] 5.4 Publish the matching web release, synchronize and archive completed OpenSpec changes, commit, push, and prove repository parity
