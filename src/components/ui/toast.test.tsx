import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Toast, ToastProvider, ToastViewport } from "@/components/ui/toast";

describe("shared toast primitives", () => {
  it("anchors the viewport at the bottom beneath mobile navigation", () => {
    const { container } = render(
      <ToastProvider>
        <ToastViewport data-testid="toast-viewport" />
      </ToastProvider>,
    );

    const viewport = container.querySelector("[data-testid='toast-viewport']");

    expect(viewport).toHaveClass("bathos-toast-viewport");
    expect(viewport).toHaveClass("bottom-[var(--bathos-toast-bottom-offset)]");
    expect(viewport).toHaveClass("right-4");
    expect(viewport).toHaveClass("z-[35]");
    expect(viewport).toHaveClass("md:right-[var(--bathos-toast-desktop-right-offset)]");
    expect(viewport).not.toHaveClass("top-0");
  });

  it("uses compact padding and bottom-origin motion", () => {
    const { getByTestId } = render(
      <ToastProvider>
        <Toast data-testid="toast" open>
          Saved
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    const toast = getByTestId("toast");

    expect(toast).toHaveClass("p-3");
    expect(toast).toHaveClass("pr-9");
    expect(toast).toHaveClass("data-[state=open]:slide-in-from-bottom-full");
    expect(toast).toHaveClass("data-[state=closed]:slide-out-to-bottom-full");
    expect(toast).not.toHaveClass("data-[state=open]:slide-in-from-top-full");
  });
});
