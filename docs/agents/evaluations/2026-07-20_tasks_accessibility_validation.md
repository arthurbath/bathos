# Personal Tasks Accessibility Validation

**Date:** 2026-07-20
**Category:** Accessibility / Interaction
**Status:** Passed

## Purpose

Validate the keyboard, focus, accessible-name, dialog, and reduced-motion contracts of the production Tasks interface. The gate exercises the rendered React components with synthetic task data and does not connect personal data or production services.

## Validated Contracts

### Task-row traversal

The browser Tab order moves through each active row in the expected sequence: Complete, task title, and Actions. Shift+Tab reverses that order. Arrow keys retain the separate task-title focus model, and Option+Arrow continues to reorder without moving focus away from the task.

### Complete editor traversal

Opening a task focuses Task Title. Tab then advances through Notes, Actionability, Organization, Start Date, Deadline, Cancel, and Save while skipping unavailable controls. Shift+Tab reverses the final step. Save and Escape retain their existing focus return to the task title.

### Command surfaces

Search opens as a dialog named Search Tasks, focuses its search input, and advances into its labeled filters through the shared modal focus loop. Move, When, bulk planning, keyboard help, and search now explicitly declare their title-only dialog semantics instead of leaving an unresolved description reference.

### Screen-reader labels and states

The rendered main task surface, expanded editor, and structural Move dialog were scanned through the browser accessibility-name algorithm. Every link, button, input, select, textarea, checkbox, and menu item exposed a nonempty accessible name. Task expansion, bulk selection, current navigation, live selection counts, reminder state, and synchronization state continue to expose their existing ARIA state or live-region semantics.

### Reduced motion

While the Tasks shell is mounted, it applies a route-scoped marker to the document body. Under `prefers-reduced-motion: reduce`, every Tasks element and portal surface receives effectively immediate animation and transition durations, one animation iteration, no delay, and automatic scrolling. Unmounting the module restores the body's prior marker state.

## Changes Made

- Added `@testing-library/user-event` 14.6.1 for browser-faithful Tab and Shift+Tab tests
- Added focused traversal and accessible-name assertions to `TasksShell.test.tsx`
- Added explicit title-only semantics to all task command dialogs
- Added route-scoped reduced-motion behavior that also reaches Radix portal content

## Evidence

The focused component suite passes 37 Tasks shell tests, including the new accessibility cases:

```sh
npx vitest run src/modules/tasks/components/TasksShell.test.tsx
```

The existing shared modal suite remains the contract for focus looping across reusable Dialog and AlertDialog primitives.

## Remaining Boundaries

- Automated accessible-name computation verifies programmatic labels, not the subjective quality of a complete VoiceOver reading session.
- Platform-specific VoiceOver, Switch Control, and external keyboard behavior should be sampled on the eventual iPhone shell before it becomes authoritative.
- Sustained parallel use remains task 7.8 and is required before any migration decision.
