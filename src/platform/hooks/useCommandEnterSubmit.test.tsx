import React from "react";
import { act } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getBathosFormCommand } from "@/platform/formInteractions";
import { useBathosFormInteractions } from "@/platform/hooks/useCommandEnterSubmit";

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

function setPlatform(platform: string) {
  return vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
}

async function dispatchKey(
  target: HTMLElement,
  init: KeyboardEventInit,
): Promise<KeyboardEvent> {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

function GlobalInteractionHarness({ children }: { children: React.ReactNode }) {
  useBathosFormInteractions();
  return <>{children}</>;
}

function FormHarness({
  returnSubmits,
}: {
  returnSubmits?: boolean | null;
}) {
  const [submitCount, setSubmitCount] = React.useState(0);

  return (
    <GlobalInteractionHarness>
      <div data-testid="submit-count">{String(submitCount)}</div>
      <form
        data-bathos-return-submits={returnSubmits == null
          ? undefined
          : String(returnSubmits)}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitCount((count) => count + 1);
        }}
      >
        <input data-testid="form-input" />
        <textarea data-testid="form-textarea" />
      </form>
    </GlobalInteractionHarness>
  );
}

function ScopeHarness({
  actionDisabled = false,
}: {
  actionDisabled?: boolean;
}) {
  const [confirmCount, setConfirmCount] = React.useState(0);
  const [cancelCount, setCancelCount] = React.useState(0);

  return (
    <GlobalInteractionHarness>
      <div data-testid="confirm-count">{String(confirmCount)}</div>
      <div data-testid="cancel-count">{String(cancelCount)}</div>
      <section data-bathos-form-scope="true" role="dialog">
        <input data-testid="scoped-input" />
        <button
          type="button"
          data-bathos-form-submit="true"
          disabled={actionDisabled}
          onClick={() => setConfirmCount((count) => count + 1)}
        >
          Save
        </button>
        <button
          type="button"
          data-bathos-form-cancel="true"
          onClick={() => setCancelCount((count) => count + 1)}
        >
          Cancel
        </button>
      </section>
    </GlobalInteractionHarness>
  );
}

function NativeControlHarness() {
  const [submitCount, setSubmitCount] = React.useState(0);
  return (
    <GlobalInteractionHarness>
      <div data-testid="submit-count">{String(submitCount)}</div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitCount((count) => count + 1);
        }}
      >
        <input data-testid="required-input" required />
        <input data-testid="file-input" type="file" />
        <input data-testid="color-input" type="color" />
      </form>
    </GlobalInteractionHarness>
  );
}

function PortalScopeHarness() {
  const [submitCount, setSubmitCount] = React.useState(0);
  return (
    <GlobalInteractionHarness>
      <div data-testid="submit-count">{String(submitCount)}</div>
      {createPortal(
        <section data-bathos-form-scope="true" role="dialog">
          <input data-testid="portal-input" />
          <button
            type="button"
            data-bathos-form-submit="true"
            onClick={() => setSubmitCount((count) => count + 1)}
          >
            Save
          </button>
        </section>,
        document.body,
      )}
    </GlobalInteractionHarness>
  );
}

function PortaledFieldOwnerHarness() {
  const [submitCount, setSubmitCount] = React.useState(0);
  return (
    <GlobalInteractionHarness>
      <div data-testid="submit-count">{String(submitCount)}</div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitCount((count) => count + 1);
        }}
      >
        <button type="button" aria-controls="portaled-field-layer">
          Open
        </button>
        {createPortal(
          <div id="portaled-field-layer">
            <input data-testid="portaled-field-input" />
          </div>,
          document.body,
        )}
      </form>
    </GlobalInteractionHarness>
  );
}

function NativeActivationHarness() {
  const [linkCount, setLinkCount] = React.useState(0);
  const [checked, setChecked] = React.useState(true);
  const [switchedOn, setSwitchedOn] = React.useState(true);

  return (
    <GlobalInteractionHarness>
      <div data-testid="link-count">{String(linkCount)}</div>
      <a
        href="#destination"
        data-testid="static-link"
        onClick={(event) => {
          event.preventDefault();
          setLinkCount((count) => count + 1);
        }}
      >
        Destination
      </a>
      <input
        type="checkbox"
        data-testid="native-checkbox"
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
      />
      <button
        type="button"
        role="switch"
        aria-checked={switchedOn}
        data-testid="custom-switch"
        onClick={() => setSwitchedOn((value) => !value)}
      >
        Switch
      </button>
    </GlobalInteractionHarness>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("form command classification", () => {
  it("uses Command+Return and Command+Escape on Apple platforms", () => {
    expect(getBathosFormCommand({
      key: "Enter",
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    }, true)).toBe("submit");
    expect(getBathosFormCommand({
      key: "Escape",
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    }, true)).toBe("cancel");
  });

  it("uses Control+Return and Control+Shift+X on Windows", () => {
    expect(getBathosFormCommand({
      key: "Enter",
      metaKey: false,
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
    }, false)).toBe("submit");
    expect(getBathosFormCommand({
      key: "x",
      metaKey: false,
      ctrlKey: true,
      altKey: false,
      shiftKey: true,
    }, false)).toBe("cancel");
  });
});

describe("useBathosFormInteractions", () => {
  it("submits the nearest form with the platform command", async () => {
    setPlatform("MacIntel");
    const { container, root } = mount(<FormHarness />);
    try {
      const input = container.querySelector<HTMLElement>('[data-testid="form-input"]')!;
      const event = await dispatchKey(input, { key: "Enter", metaKey: true });
      expect(event.defaultPrevented).toBe(true);
      expect(container.querySelector('[data-testid="submit-count"]')?.textContent).toBe("1");
    } finally {
      unmount(root, container);
    }
  });

  it("submits and cancels explicit dialog scopes", async () => {
    setPlatform("MacIntel");
    const { container, root } = mount(<ScopeHarness />);
    try {
      const input = container.querySelector<HTMLElement>('[data-testid="scoped-input"]')!;
      await dispatchKey(input, { key: "Enter", metaKey: true });
      expect(container.querySelector('[data-testid="confirm-count"]')?.textContent).toBe("1");

      await dispatchKey(input, { key: "Escape", metaKey: true });
      expect(container.querySelector('[data-testid="cancel-count"]')?.textContent).toBe("1");
    } finally {
      unmount(root, container);
    }
  });

  it("submits unmodified Return in single-line fields by default", async () => {
    setPlatform("MacIntel");
    const { container, root } = mount(<FormHarness />);
    try {
      const input = container.querySelector<HTMLElement>('[data-testid="form-input"]')!;
      const event = await dispatchKey(input, { key: "Enter" });
      expect(event.defaultPrevented).toBe(true);
      expect(container.querySelector('[data-testid="submit-count"]')?.textContent).toBe("1");
    } finally {
      unmount(root, container);
    }
  });

  it("suppresses unmodified Return only when the form opts out", async () => {
    setPlatform("MacIntel");
    const { container, root } = mount(<FormHarness returnSubmits={false} />);
    try {
      const input = container.querySelector<HTMLElement>('[data-testid="form-input"]')!;
      await dispatchKey(input, { key: "Enter" });
      expect(container.querySelector('[data-testid="submit-count"]')?.textContent).toBe("0");
    } finally {
      unmount(root, container);
    }
  });

  it("leaves multiline Return behavior untouched", async () => {
    setPlatform("MacIntel");
    const { container, root } = mount(<FormHarness />);
    try {
      const textarea = container.querySelector<HTMLElement>('[data-testid="form-textarea"]')!;
      const event = await dispatchKey(textarea, { key: "Enter" });
      expect(event.defaultPrevented).toBe(false);
      expect(container.querySelector('[data-testid="submit-count"]')?.textContent).toBe("0");
    } finally {
      unmount(root, container);
    }
  });

  it("does not consume commands when the matching action is disabled", async () => {
    setPlatform("MacIntel");
    const { container, root } = mount(<ScopeHarness actionDisabled />);
    try {
      const input = container.querySelector<HTMLElement>('[data-testid="scoped-input"]')!;
      const event = await dispatchKey(input, { key: "Enter", metaKey: true });
      expect(event.defaultPrevented).toBe(false);
      expect(container.querySelector('[data-testid="confirm-count"]')?.textContent).toBe("0");
    } finally {
      unmount(root, container);
    }
  });

  it("uses native validation for command submission", async () => {
    setPlatform("MacIntel");
    const { container, root } = mount(<NativeControlHarness />);
    try {
      const input = container.querySelector<HTMLElement>('[data-testid="required-input"]')!;
      const event = await dispatchKey(input, { key: "Enter", metaKey: true });
      expect(event.defaultPrevented).toBe(true);
      expect(container.querySelector('[data-testid="submit-count"]')?.textContent).toBe("0");
      expect(input).toBeInvalid();
    } finally {
      unmount(root, container);
    }
  });

  it("preserves native file and color field key behavior", async () => {
    setPlatform("MacIntel");
    const { container, root } = mount(<NativeControlHarness />);
    try {
      const fileInput = container.querySelector<HTMLElement>('[data-testid="file-input"]')!;
      const colorInput = container.querySelector<HTMLElement>('[data-testid="color-input"]')!;
      expect((await dispatchKey(fileInput, { key: "Enter" })).defaultPrevented).toBe(false);
      expect((await dispatchKey(colorInput, { key: "Enter" })).defaultPrevented).toBe(false);
    } finally {
      unmount(root, container);
    }
  });

  it("handles portaled scopes exactly once", async () => {
    setPlatform("MacIntel");
    const { container, root } = mount(<PortalScopeHarness />);
    try {
      const input = document.querySelector<HTMLElement>('[data-testid="portal-input"]')!;
      await dispatchKey(input, { key: "Enter", metaKey: true });
      expect(container.querySelector('[data-testid="submit-count"]')?.textContent).toBe("1");
    } finally {
      unmount(root, container);
    }
  });

  it("resolves a portaled field layer through its owning trigger", async () => {
    setPlatform("MacIntel");
    const { container, root } = mount(<PortaledFieldOwnerHarness />);
    try {
      const input = document.querySelector<HTMLElement>('[data-testid="portaled-field-input"]')!;
      const event = await dispatchKey(input, { key: "Enter", metaKey: true });
      expect(event.defaultPrevented).toBe(true);
      expect(container.querySelector('[data-testid="submit-count"]')?.textContent).toBe("1");
    } finally {
      unmount(root, container);
    }
  });

  it("ignores composing keyboard events", async () => {
    setPlatform("MacIntel");
    const { container, root } = mount(<FormHarness returnSubmits />);
    try {
      const input = container.querySelector<HTMLElement>('[data-testid="form-input"]')!;
      const event = await dispatchKey(input, { key: "Enter", isComposing: true });
      expect(event.defaultPrevented).toBe(false);
      expect(container.querySelector('[data-testid="submit-count"]')?.textContent).toBe("0");
    } finally {
      unmount(root, container);
    }
  });

  it("activates a static link with Space", async () => {
    const { container, root } = mount(<NativeActivationHarness />);
    try {
      const link = container.querySelector<HTMLElement>('[data-testid="static-link"]')!;
      const event = await dispatchKey(link, { key: " " });
      expect(event.defaultPrevented).toBe(true);
      expect(container.querySelector('[data-testid="link-count"]')?.textContent).toBe("1");
    } finally {
      unmount(root, container);
    }
  });

  it("toggles binary controls with Return and resets them with Delete or Backspace", async () => {
    const { container, root } = mount(<NativeActivationHarness />);
    try {
      const checkbox = container.querySelector<HTMLInputElement>('[data-testid="native-checkbox"]')!;
      const customSwitch = container.querySelector<HTMLElement>('[data-testid="custom-switch"]')!;

      await dispatchKey(checkbox, { key: "Delete" });
      expect(checkbox.checked).toBe(false);
      await dispatchKey(checkbox, { key: "Enter" });
      expect(checkbox.checked).toBe(true);

      await dispatchKey(customSwitch, { key: "Backspace" });
      expect(customSwitch.getAttribute("aria-checked")).toBe("false");
      await dispatchKey(customSwitch, { key: "Enter" });
      expect(customSwitch.getAttribute("aria-checked")).toBe("true");
    } finally {
      unmount(root, container);
    }
  });
});
