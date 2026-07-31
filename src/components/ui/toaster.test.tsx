import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";

vi.mock("@/components/ui/toast", () => ({
  Toast: ({
    children,
    duration,
  }: {
    children?: ReactNode;
    duration?: number;
  }) => (
    <div data-duration={duration} data-testid="toast">
      {children}
    </div>
  ),
  ToastClose: () => null,
  ToastDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ToastProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ToastTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ToastViewport: () => null,
}));

describe("Toaster", () => {
  it("assigns a content-proportional duration at the shared renderer boundary", () => {
    toast({
      title: "Operation Failed",
      description: "Please try again.",
    });

    render(<Toaster />);

    expect(screen.getByTestId("toast")).toHaveAttribute("data-duration", "2000");
  });
});
