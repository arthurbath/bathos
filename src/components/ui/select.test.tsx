import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Layers3 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

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

async function flushUi() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function SelectFormHarness({
  onValueChange = vi.fn(),
  onReset,
}: {
  onValueChange?: (value: string) => void;
  onReset?: () => void;
}) {
  return (
    <form>
      <input id="before-select" />
      <Select defaultValue="alpha" onValueChange={onValueChange}>
        <SelectTrigger id="test-select" aria-label="Choice" onReset={onReset}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="alpha">Alpha</SelectItem>
          <SelectItem value="beta">Beta</SelectItem>
        </SelectContent>
      </Select>
      <input id="after-select" />
    </form>
  );
}

describe("Select interaction contract", () => {
  it("renders a noninteractive leading decoration without replacing the accessible name", () => {
    const { container, root } = mount(
      <Select defaultValue="alpha">
        <SelectTrigger
          id="decorated-select"
          aria-label="Area"
          decoration={<Layers3 />}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="alpha">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );

    try {
      const trigger = container.querySelector("#decorated-select");
      const decoration = trigger?.querySelector("[data-control-decoration]");
      expect(trigger).toHaveAttribute("aria-label", "Area");
      expect(decoration).toHaveAttribute("aria-hidden", "true");
      expect(decoration).toHaveClass("pointer-events-none", "shrink-0");
      expect(decoration?.querySelector("svg")).toHaveClass("lucide-layers");
      expect(trigger?.querySelector(".min-w-0.flex-1.truncate")).toHaveTextContent("Alpha");
    } finally {
      unmount(root, container);
    }
  });

  it("uses Delete only when the caller declares a legal reset", () => {
    const onReset = vi.fn();
    const { container, root } = mount(<SelectFormHarness onReset={onReset} />);
    try {
      const trigger = container.querySelector<HTMLButtonElement>("#test-select")!;
      act(() => {
        trigger.focus();
        trigger.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Delete",
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(trigger);
    } finally {
      unmount(root, container);
    }
  });

  it("opens with Return and commits a focused option with Return", async () => {
    const onValueChange = vi.fn();
    const { container, root } = mount(<SelectFormHarness onValueChange={onValueChange} />);
    try {
      const trigger = container.querySelector<HTMLButtonElement>("#test-select")!;
      act(() => {
        trigger.focus();
        trigger.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();
      const beta = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
        .find((option) => option.textContent?.includes("Beta"))!;
      act(() => {
        beta.focus();
        beta.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();

      expect(onValueChange).toHaveBeenCalledWith("beta");
      expect(document.querySelector('[role="listbox"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    } finally {
      unmount(root, container);
    }
  });

  it("closes on Tab and advances to the adjacent form control", async () => {
    const { container, root } = mount(<SelectFormHarness />);
    try {
      const trigger = container.querySelector<HTMLButtonElement>("#test-select")!;
      act(() => {
        trigger.focus();
        trigger.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();
      const option = document.activeElement as HTMLElement;
      act(() => {
        option.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();

      expect(document.querySelector('[role="listbox"]')).toBeNull();
      expect(document.activeElement).toBe(container.querySelector("#after-select"));
    } finally {
      unmount(root, container);
    }
  });

  it("cancels with Escape and restores trigger focus", async () => {
    const { container, root } = mount(<SelectFormHarness />);
    try {
      const trigger = container.querySelector<HTMLButtonElement>("#test-select")!;
      act(() => {
        trigger.click();
      });
      await flushUi();
      const option = document.activeElement as HTMLElement;
      act(() => {
        option.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();

      expect(document.querySelector('[role="listbox"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    } finally {
      unmount(root, container);
    }
  });
});
