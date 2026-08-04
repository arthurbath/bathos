## 1. Immediate Native Presentation

- [x] 1.1 Update the Quick Entry panel controller to order the native loading shell onscreen during every shortcut invocation, including warm reuse.
- [x] 1.2 Preserve the fresh-editor visibility gate so the immediate shell never exposes stale or intermediate web content.

## 2. Reliable Panel Movement

- [x] 2.1 Make the dedicated native top region explicitly initiate AppKit window dragging from the original pointer event.
- [x] 2.2 Preserve ordinary WebKit pointer behavior outside the bounded drag region.

## 3. Verification

- [x] 3.1 Add focused macOS companion regression coverage for immediate panel visibility and the explicit drag-region contract.
- [x] 3.2 Run macOS companion tests/build validation and OpenSpec validation.
