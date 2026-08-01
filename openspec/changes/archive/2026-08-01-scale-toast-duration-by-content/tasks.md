## 1. Shared Duration Logic

- [x] 1.1 Add a shared toast-duration utility that estimates mobile text lines and returns one second per line with a one-second minimum
- [x] 1.2 Add focused unit coverage for short, wrapped, multiline, and structured toast content

## 2. Shared Toast Integration

- [x] 2.1 Apply the calculated duration to the shared Radix toast renderer
- [x] 2.2 Apply the same calculated duration to shared Sonner error notifications
- [x] 2.3 Remove routine module-level toast duration overrides

## 3. Documentation and Validation

- [x] 3.1 Document content-proportional toast timing in the BathOS human style guide
- [x] 3.2 Run focused tests and verify representative short and long toasts in the rendered application
- [x] 3.3 Run the relevant full test suite, TypeScript/build checks, lint, and strict OpenSpec validation
