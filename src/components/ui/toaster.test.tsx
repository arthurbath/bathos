import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/toaster";
import { resetToastStateForTests, toast } from "@/hooks/use-toast";

vi.mock("@/components/ui/toast", () => ({
  Toast: ({
    children,
    duration,
    onOpenChange,
  }: {
    children?: ReactNode;
    duration?: number;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-duration={duration} data-testid="toast">
      {children}
      <button
        type="button"
        data-testid="close-toast"
        onClick={() => onOpenChange?.(false)}
      >
        Close
      </button>
    </div>
  ),
  ToastClose: () => null,
  ToastDescription: ({ children }: { children?: ReactNode }) => (
    <div data-testid="toast-description">{children}</div>
  ),
  ToastProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ToastTitle: ({ children }: { children?: ReactNode }) => (
    <div data-testid="toast-title">{children}</div>
  ),
  ToastViewport: () => null,
}));

describe("Toaster", () => {
  beforeEach(() => resetToastStateForTests());

  it("assigns a content-proportional duration at the shared renderer boundary", () => {
    toast({
      title: "Operation Failed",
      description: "Please try again.",
    });

    render(<Toaster />);

    expect(screen.getByTestId("toast")).toHaveAttribute("data-duration", "2000");
  });

  it("renders a short description-only toast without an empty title gap", () => {
    toast({
      description: "The task now appears in Upcoming.",
    });

    const { container } = render(<Toaster />);

    expect(screen.getByTestId("toast")).toHaveAttribute("data-duration", "1000");
    expect(screen.queryByTestId("toast-title")).not.toBeInTheDocument();
    expect(screen.getByTestId("toast-description")).toHaveTextContent(
      "The task now appears in Upcoming.",
    );
    const content = container.querySelector("[data-toast-content]");
    expect(content).toHaveClass("grid");
    expect(content).not.toHaveClass("gap-1");
  });

  it("preserves an explicit persistent duration", () => {
    toast({
      title: "Reminder",
      description: "Existing task",
      duration: Number.POSITIVE_INFINITY,
    });

    render(<Toaster />);

    expect(screen.getByTestId("toast")).toHaveAttribute("data-duration", "Infinity");
  });

  it("retains simultaneous toasts and preserves a caller dismissal callback", () => {
    const onOpenChange = vi.fn();
    toast({ description: "First reminder" });
    toast({ description: "Second reminder", onOpenChange });

    render(<Toaster />);

    expect(screen.getAllByTestId("toast")).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId("close-toast")[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
