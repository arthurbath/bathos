import { describe, expect, it, vi } from "vitest";

import { showSonnerErrorToast } from "@/components/ui/sonner";

const sonnerErrorMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: {
    error: sonnerErrorMock,
  },
}));

describe("showSonnerErrorToast", () => {
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
