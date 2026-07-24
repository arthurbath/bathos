import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { MultiSelectFilter } from "@/components/ui/multi-select-filter";

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

async function openWithEnter(trigger: HTMLButtonElement) {
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }));
  });
  await flushUi();
}

function Harness({ onChange }: { onChange: (values: string[]) => void }) {
  const [selected, setSelected] = React.useState<string[]>(["alpha"]);
  return (
    <form>
      <input id="before-filter" />
      <MultiSelectFilter
        label="Kinds"
        options={[
          { value: "alpha", label: "Alpha" },
          { value: "beta", label: "Beta" },
        ]}
        selectedValues={selected}
        onSelectedValuesChange={(values) => {
          setSelected(values);
          onChange(values);
        }}
        deferSelectionUntilClose
        showBulkActions={false}
      />
      <input id="after-filter" />
    </form>
  );
}

describe("MultiSelectFilter interaction contract", () => {
  it("clears every selection with Delete from the closed trigger", async () => {
    const onChange = vi.fn();
    const { container, root } = mount(<Harness onChange={onChange} />);
    try {
      const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Kinds"]')!;
      await act(async () => {
        trigger.focus();
        trigger.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Delete",
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(onChange).toHaveBeenCalledWith([]);
      expect(document.activeElement).toBe(trigger);
    } finally {
      unmount(root, container);
    }
  });

  it("cancels staged selection with Escape", async () => {
    const onChange = vi.fn();
    const { container, root } = mount(<Harness onChange={onChange} />);
    try {
      const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Kinds"]')!;
      await openWithEnter(trigger);
      const beta = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'))
        .find((item) => item.textContent?.includes("Beta"))!;
      act(() => {
        beta.click();
        beta.focus();
        beta.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();

      expect(onChange).not.toHaveBeenCalled();
      expect(document.querySelector('[role="menuitemcheckbox"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    } finally {
      unmount(root, container);
    }
  });

  it("commits staged selection with Tab and advances focus", async () => {
    const onChange = vi.fn();
    const { container, root } = mount(<Harness onChange={onChange} />);
    try {
      const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Kinds"]')!;
      await openWithEnter(trigger);
      const beta = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'))
        .find((item) => item.textContent?.includes("Beta"))!;
      act(() => {
        beta.click();
        beta.focus();
        beta.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();

      expect(onChange).toHaveBeenCalledWith(["alpha", "beta"]);
      expect(document.querySelector('[role="menuitemcheckbox"]')).toBeNull();
      expect(document.activeElement).toBe(container.querySelector("#after-filter"));
    } finally {
      unmount(root, container);
    }
  });
});
