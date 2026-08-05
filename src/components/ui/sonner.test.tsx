import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { showSonnerErrorToast, Toaster } from "@/components/ui/sonner";

const sonnerErrorMock = vi.hoisted(() => vi.fn());
const sonnerToasterMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("sonner", () => ({
  Toaster: sonnerToasterMock,
  toast: {
    error: sonnerErrorMock,
  },
}));

describe("showSonnerErrorToast", () => {
  it("uses the shared bottom placement and compact toast treatment", () => {
    render(<Toaster />);

    expect(sonnerToasterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        position: "bottom-right",
        className: "bathos-sonner-toaster toaster group",
        offset: {
          right: "var(--bathos-toast-desktop-right-offset)",
          bottom: "var(--bathos-toast-bottom-offset)",
        },
        mobileOffset: {
          right: "1rem",
          bottom: "var(--bathos-toast-bottom-offset)",
          left: "1rem",
        },
        toastOptions: expect.objectContaining({
          classNames: expect.objectContaining({
            toast: expect.stringContaining("!p-3"),
          }),
        }),
      }),
      {},
    );
  });

  it("keeps network and system toasts above modal backdrops", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    const sonnerRule = stylesheet.match(
      /\.bathos-sonner-toaster\[data-sonner-toaster\]\s*\{[^}]*z-index:\s*(\d+)/u,
    );

    expect(Number(sonnerRule?.[1])).toBeGreaterThan(34);
  });

  it("applies the shared content-proportional duration", () => {
    showSonnerErrorToast("Operation Failed", {
      description: "Please try again.",
    });

    expect(sonnerErrorMock).toHaveBeenCalledWith("Operation Failed", {
      description: "Please try again.",
      duration: 2_000,
    });
  });
});
