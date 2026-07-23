## 1. Draft Creation Model

- [x] 1.1 Add active-view task-draft defaults and creation inputs that preserve metadata while retaining the nonblank-title repository invariant
- [x] 1.2 Render one blank draft through the complete task row editor at the top of supported list views
- [x] 1.3 Persist the draft once its title is valid, suppress duplicate projection while open, and discard untitled drafts on close
- [x] 1.4 Reconcile ordinary sorting and show the out-of-view saved toast after draft closure

## 2. Keyboard Interaction

- [x] 2.1 Replace capture-field focus with Command+N or Control+N full-editor creation from every Tasks route
- [x] 2.2 Add Command+Return, Control+Return, and Escape editor closure with nested-surface precedence
- [x] 2.3 Add Command+K or Control+K completion handling for open tasks and nonempty bulk selections
- [x] 2.4 Update keyboard help, programmatic shortcut metadata, and focus fallbacks

## 3. Verification and Closeout

- [x] 3.1 Add command-domain, list-hook, shell interaction, sorting, toast, and accessibility regression tests
- [x] 3.2 Run focused tests, full tests, lint, build, and strict OpenSpec validation
- [x] 3.3 Verify creation and keyboard workflows in the rendered Tasks module
- [x] 3.4 Sync the durable specification, archive the change, commit, push, and prove a clean synchronized main branch
