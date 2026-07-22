import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import {
  TASK_ROUTE_PATHS,
  isSupportedTaskRoute,
} from "@/modules/tasks/routes";
import { BROWSER_ROUTER_FUTURE } from "@/platform/routingCompatibility";
import {
  BathOSBrowserRouter,
  ScrollToTopOnPathnameChange,
} from "./App";

describe("task route registry", () => {
  it("registers the Upcoming task view", () => {
    expect(TASK_ROUTE_PATHS).toContain("/tasks/upcoming");
    expect(TASK_ROUTE_PATHS).toContain("/tasks/anytime");
    expect(TASK_ROUTE_PATHS).toContain("/tasks/someday");
    expect(TASK_ROUTE_PATHS).toContain("/tasks/areas/:areaId");
    expect(TASK_ROUTE_PATHS).toContain("/tasks/config");
  });

  it("matches only exact supported task routes", () => {
    expect(isSupportedTaskRoute("/tasks/today")).toBe(true);
    expect(isSupportedTaskRoute("/tasks/projects/project-a")).toBe(true);
    expect(isSupportedTaskRoute("/tasks/areas/area-a")).toBe(true);
    expect(isSupportedTaskRoute("/tasks/config")).toBe(true);
    expect(isSupportedTaskRoute("/tasks/unknown")).toBe(false);
    expect(isSupportedTaskRoute("/tasks/projects/project-a/extra")).toBe(false);
  });
});

describe("BathOSBrowserRouter", () => {
  it("enables both React Router v7 compatibility behaviors without opt-in warnings", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(
          <BathOSBrowserRouter>
            <div>Router Ready</div>
          </BathOSBrowserRouter>,
        );
      });

      expect(BROWSER_ROUTER_FUTURE).toEqual({
        v7_relativeSplatPath: true,
        v7_startTransition: true,
      });
      expect(container).toHaveTextContent("Router Ready");
      expect(
        consoleWarn.mock.calls.some(([message]) => (
          String(message).includes("v7_startTransition")
          || String(message).includes("v7_relativeSplatPath")
        )),
      ).toBe(false);
    } finally {
      cleanup(root, container);
      consoleWarn.mockRestore();
    }
  });
});

function TestRoutes() {
  return (
    <MemoryRouter
      initialEntries={["/budget/summary"]}
      future={BROWSER_ROUTER_FUTURE}
    >
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
