import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function mount(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function setWindowInnerWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

function setWindowVisualViewport(height: number, offsetTop = 0) {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: {
      height,
      offsetTop,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
}

async function waitForCondition(assertion: () => void, timeoutMs = 1500) {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    });
  }
  throw lastError instanceof Error ? lastError : new Error("Condition not met before timeout");
}

async function dispatchTabOnActiveElement(shiftKey = false) {
  await act(async () => {
    const active = document.activeElement as HTMLElement | null;
    active?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true }));
  });
}

async function dispatchCommandEnter(target: HTMLElement) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }));
  });
}

function AlertDialogNoInputHarness() {
  return (
    <AlertDialog open onOpenChange={() => {}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="confirm">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AlertDialogWithInputHarness() {
  return (
    <AlertDialog open onOpenChange={() => {}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item</AlertDialogTitle>
          <AlertDialogDescription>Type DELETE to confirm.</AlertDialogDescription>
        </AlertDialogHeader>
        <Input data-testid="confirm-input" placeholder="Type DELETE" />
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="confirm">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DialogNoInputHarness() {
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete item</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" data-testid="cancel">Cancel</Button>
          <Button type="button" data-dialog-confirm="true" data-testid="confirm">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogWithSettingsHarness() {
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete and reassign</DialogTitle>
          <DialogDescription>Choose settings before confirming.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Input data-testid="notes-input" placeholder="Optional note" />
          <button type="button" role="combobox" data-testid="target-combobox">
            Reassign target
          </button>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" data-testid="cancel">Cancel</Button>
          <Button type="button" data-dialog-confirm="true" data-testid="confirm">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogMobileFocusHarness() {
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent data-testid="mobile-dialog-content" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Mobile Form</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Input data-testid="mobile-input" placeholder="Name" />
        </DialogBody>
        <DialogFooter>
          <Button type="button" data-dialog-confirm="true">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogViewportHarness() {
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent data-testid="viewport-dialog-content" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Viewport Form</DialogTitle>
        </DialogHeader>
        <DialogBody data-testid="viewport-dialog-body">
          <Input placeholder="Name" />
        </DialogBody>
        <DialogFooter>
          <Button type="button" data-dialog-confirm="true">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogBodyRefHarness({ onReady }: { onReady: (node: HTMLDivElement | null) => void }) {
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Body Ref</DialogTitle>
          <DialogDescription>Dialog body ref forwarding test</DialogDescription>
        </DialogHeader>
        <DialogBody ref={onReady}>
          <div>Body content</div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function DialogSubmitShortcutHarness() {
  const [open, setOpen] = React.useState(true);
  const [submissions, setSubmissions] = React.useState(0);

  return (
    <>
      <div data-testid="dialog-open-state">{open ? "open" : "closed"}</div>
      <div data-testid="dialog-submit-count">{String(submissions)}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="dialog-content">
          <DialogHeader>
            <DialogTitle>Shortcut submit</DialogTitle>
            <DialogDescription>Command enter should submit and close.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => {
            event.preventDefault();
            setSubmissions((count) => count + 1);
          }}>
            <DialogBody>
              <Input data-testid="dialog-form-input" placeholder="Name" />
            </DialogBody>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DialogCloseShortcutHarness() {
  const [open, setOpen] = React.useState(true);

  return (
    <>
      <div data-testid="dialog-open-state">{open ? "open" : "closed"}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="dialog-content">
          <DialogHeader>
            <DialogTitle>Shortcut close</DialogTitle>
            <DialogDescription>Command enter should close even without a form.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DialogConfirmShortcutHarness() {
  const [open, setOpen] = React.useState(true);
  const [confirmCount, setConfirmCount] = React.useState(0);

  return (
    <>
      <div data-testid="dialog-open-state">{open ? "open" : "closed"}</div>
      <div data-testid="dialog-confirm-count">{String(confirmCount)}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="dialog-content">
          <DialogHeader>
            <DialogTitle>Shortcut confirm</DialogTitle>
            <DialogDescription>Command enter should trigger the modal confirm action.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline">Cancel</Button>
            <Button type="button" data-dialog-confirm="true" onClick={() => setConfirmCount((count) => count + 1)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AlertDialogShortcutHarness() {
  const [open, setOpen] = React.useState(true);

  return (
    <>
      <div data-testid="alert-open-state">{open ? "open" : "closed"}</div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent data-testid="alert-content">
          <AlertDialogHeader>
            <AlertDialogTitle>Alert shortcut</AlertDialogTitle>
            <AlertDialogDescription>Command enter should close this alert.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SheetSubmitShortcutHarness() {
  const [open, setOpen] = React.useState(true);
  const [submissions, setSubmissions] = React.useState(0);

  return (
    <>
      <div data-testid="sheet-open-state">{open ? "open" : "closed"}</div>
      <div data-testid="sheet-submit-count">{String(submissions)}</div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent data-testid="sheet-content">
          <SheetHeader>
            <SheetTitle>Sheet shortcut</SheetTitle>
            <SheetDescription>Command enter should submit and close.</SheetDescription>
          </SheetHeader>
          <form onSubmit={(event) => {
            event.preventDefault();
            setSubmissions((count) => count + 1);
          }}>
            <Input data-testid="sheet-form-input" placeholder="Name" />
          </form>
          <SheetFooter>
            <Button type="button">Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

describe("Modal focus conventions", () => {
  afterEach(() => {
    setWindowInnerWidth(1024);
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });
  });

  it("focuses confirm action when alert dialog has no inputs", async () => {
    const { container, root } = mount(<AlertDialogNoInputHarness />);
    try {
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-testid")).toBe("confirm");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("focuses first input when alert dialog contains one", async () => {
    const { container, root } = mount(<AlertDialogWithInputHarness />);
    try {
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-testid")).toBe("confirm-input");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("focuses confirm button when dialog has no form controls", async () => {
    const { container, root } = mount(<DialogNoInputHarness />);
    try {
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-testid")).toBe("confirm");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("tabs through input, dropdown, cancel, and confirm controls in dialog", async () => {
    const { container, root } = mount(<DialogWithSettingsHarness />);
    try {
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-testid")).toBe("notes-input");
      });

      await dispatchTabOnActiveElement();
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-testid")).toBe("target-combobox");
      });

      await dispatchTabOnActiveElement();
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-testid")).toBe("cancel");
      });

      await dispatchTabOnActiveElement();
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-testid")).toBe("confirm");
      });

      await dispatchTabOnActiveElement();
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-testid")).toBe("notes-input");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("forwards refs to dialog body elements", async () => {
    let bodyNode: HTMLDivElement | null = null;
    const { container, root } = mount(
      <DialogBodyRefHarness
        onReady={(node) => {
          bodyNode = node;
        }}
      />,
    );
    try {
      await waitForCondition(() => {
        expect(bodyNode).toBeInstanceOf(HTMLDivElement);
      });
    } finally {
      unmount(root, container);
    }
  });

  it("keeps focus on dialog content on mobile open to avoid forcing the software keyboard", async () => {
    setWindowInnerWidth(390);
    const { container, root } = mount(<DialogMobileFocusHarness />);
    try {
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-testid")).toBe("mobile-dialog-content");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("applies visual viewport sizing and no-animation mobile classes to dialog content", async () => {
    setWindowVisualViewport(412, 24);
    const { container, root } = mount(<DialogViewportHarness />);
    try {
      await waitForCondition(() => {
        const content = document.querySelector<HTMLElement>('[data-testid="viewport-dialog-content"]');
        const body = document.querySelector<HTMLElement>('[data-testid="viewport-dialog-body"]');

        expect(content).not.toBeNull();
        expect(body).not.toBeNull();
        expect(content?.style.getPropertyValue("--bathos-modal-vv-height")).toBe("412px");
        expect(content?.style.getPropertyValue("--bathos-modal-vv-top")).toBe("24px");
        expect(content?.className).toContain("max-sm:!animate-none");
        expect(content?.className).toContain("max-sm:h-[var(--bathos-modal-vv-height,100dvh)]");
        expect(content?.className).toContain("max-sm:max-w-none");
        expect(body?.className).toContain("overflow-y-auto");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("submits dialog forms and closes the dialog on command enter", async () => {
    const { container, root } = mount(<DialogSubmitShortcutHarness />);
    try {
      await waitForCondition(() => {
        expect(document.querySelector('[data-testid="dialog-content"]')).not.toBeNull();
      });

      const content = document.querySelector<HTMLElement>('[data-testid="dialog-content"]');
      expect(content).not.toBeNull();
      await dispatchCommandEnter(content!);

      await waitForCondition(() => {
        expect(container.querySelector('[data-testid="dialog-submit-count"]')?.textContent).toBe("1");
        expect(container.querySelector('[data-testid="dialog-open-state"]')?.textContent).toBe("closed");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("closes dialogs without forms on command enter", async () => {
    const { container, root } = mount(<DialogCloseShortcutHarness />);
    try {
      await waitForCondition(() => {
        expect(document.querySelector('[data-testid="dialog-content"]')).not.toBeNull();
      });

      const content = document.querySelector<HTMLElement>('[data-testid="dialog-content"]');
      expect(content).not.toBeNull();
      await dispatchCommandEnter(content!);

      await waitForCondition(() => {
        expect(container.querySelector('[data-testid="dialog-open-state"]')?.textContent).toBe("closed");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("triggers dialog confirm actions and closes when no form is present", async () => {
    const { container, root } = mount(<DialogConfirmShortcutHarness />);
    try {
      await waitForCondition(() => {
        expect(document.querySelector('[data-testid="dialog-content"]')).not.toBeNull();
      });

      const content = document.querySelector<HTMLElement>('[data-testid="dialog-content"]');
      expect(content).not.toBeNull();
      await dispatchCommandEnter(content!);

      await waitForCondition(() => {
        expect(container.querySelector('[data-testid="dialog-confirm-count"]')?.textContent).toBe("1");
        expect(container.querySelector('[data-testid="dialog-open-state"]')?.textContent).toBe("closed");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("closes alert dialogs on command enter", async () => {
    const { container, root } = mount(<AlertDialogShortcutHarness />);
    try {
      await waitForCondition(() => {
        expect(document.querySelector('[data-testid="alert-content"]')).not.toBeNull();
      });

      const content = document.querySelector<HTMLElement>('[data-testid="alert-content"]');
      expect(content).not.toBeNull();
      await dispatchCommandEnter(content!);

      await waitForCondition(() => {
        expect(container.querySelector('[data-testid="alert-open-state"]')?.textContent).toBe("closed");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("submits sheet forms and closes the sheet on command enter", async () => {
    const { container, root } = mount(<SheetSubmitShortcutHarness />);
    try {
      await waitForCondition(() => {
        expect(document.querySelector('[data-testid="sheet-content"]')).not.toBeNull();
      });

      const content = document.querySelector<HTMLElement>('[data-testid="sheet-content"]');
      expect(content).not.toBeNull();
      await dispatchCommandEnter(content!);

      await waitForCondition(() => {
        expect(container.querySelector('[data-testid="sheet-submit-count"]')?.textContent).toBe("1");
        expect(container.querySelector('[data-testid="sheet-open-state"]')?.textContent).toBe("closed");
      });
    } finally {
      unmount(root, container);
    }
  });
});
