import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import { TASK_ROUTE_PATHS } from "@/modules/tasks/routes";
import { ScrollToTopOnPathnameChange } from "./App";

describe("task route registry", () => {
  it("registers the Upcoming task view", () => {
    expect(TASK_ROUTE_PATHS).toContain("/tasks/upcoming");
  });
});

function TestRoutes() {
  return (
    <MemoryRouter initialEntries={["/budget/summary"]}>
      <ScrollToTopOnPathnameChange />
      <Routes>
        <Route
          path="/"
          element={<Link to="/budget/summary">Budget</Link>}
        />
        <Route
          path="/budget/summary"
          element={<Link to="/">Launcher</Link>}
        />
      </Routes>
    </MemoryRouter>
  );
}

function renderTestRoutes() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<TestRoutes />);
  });

  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("ScrollToTopOnPathnameChange", () => {
  const scrollToMock = vi.fn();

  beforeEach(() => {
    scrollToMock.mockReset();
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      writable: true,
      value: scrollToMock,
    });
  });

  it("resets window scroll when the pathname changes between a module and the launcher", async () => {
    const { container, root } = renderTestRoutes();

    try {
      expect(scrollToMock).toHaveBeenCalledWith(0, 0);

      scrollToMock.mockClear();

      const launcherLink = container.querySelector('a[href="/"]');
      expect(launcherLink).not.toBeNull();

      await act(async () => {
        launcherLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      });

      expect(scrollToMock).toHaveBeenCalledWith(0, 0);

      scrollToMock.mockClear();

      const budgetLink = container.querySelector('a[href="/budget/summary"]');
      expect(budgetLink).not.toBeNull();

      await act(async () => {
        budgetLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      });

      expect(scrollToMock).toHaveBeenCalledWith(0, 0);
    } finally {
      cleanup(root, container);
    }
  });
});
