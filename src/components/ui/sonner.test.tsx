import { render } from "@testing-library/react";
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
