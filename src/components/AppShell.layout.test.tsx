import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";
import type { HouseholdData } from "@/hooks/useHouseholdData";

vi.mock("@/platform/hooks/useHostModule", () => ({
  useModuleBasePath: () => "/budget",
}));

vi.mock("@/hooks/useIncomes", () => ({
  useIncomes: () => ({
    incomes: [],
    add: async () => {},
    update: async () => {},
    remove: async () => {},
    refetch: async () => {},
  }),
}));

vi.mock("@/hooks/useExpenses", () => ({
  useExpenses: () => ({
    expenses: [],
    add: async () => {},
    update: async () => {},
    remove: async () => {},
    refetch: async () => {},
  }),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    categories: [],
    add: async () => {},
    update: async () => {},
    updateColor: async () => {},
    remove: async () => {},
    refetch: async () => {},
  }),
}));

vi.mock("@/hooks/useLinkedAccounts", () => ({
  useLinkedAccounts: () => ({
    linkedAccounts: [],
    add: async () => {},
    update: async () => {},
    updateColor: async () => {},
    remove: async () => {},
    refetch: async () => {},
  }),
}));

vi.mock("@/hooks/useRestorePoints", () => ({
  useRestorePoints: () => ({
    points: [],
    save: async () => {},
    remove: async () => {},
    updateNotes: async () => {},
  }),
}));

vi.mock("@/platform/components/ToplineHeader", () => ({
  ToplineHeader: () => <header data-testid="topline-header" />,
}));

vi.mock("@/components/IncomesTab", () => ({
  IncomesTab: () => <div data-testid="incomes-tab" />,
}));

vi.mock("@/components/ExpensesTab", () => ({
  ExpensesTab: () => <div data-testid="expenses-tab" />,
}));

vi.mock("@/components/ConfigurationTab", () => ({
  ConfigurationTab: () => <div data-testid="configuration-tab" />,
}));

vi.mock("@/components/SummaryTab", () => ({
  SummaryTab: () => <div data-testid="summary-tab" />,
}));

vi.mock("@/components/RestoreTab", () => ({
  RestoreTab: () => <div data-testid="restore-tab" />,
}));

const household: HouseholdData = {
  householdId: "household-1",
  householdName: "My Household",
  inviteCode: null,
  partnerX: "Partner A",
  partnerY: "Partner B",
  displayName: "You",
};

function renderShell(pathname: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[pathname]}>
        <AppShell
          household={household}
          userId="user-1"
          onSignOut={async () => {}}
          onHouseholdRefetch={() => {}}
          onUpdatePartnerNames={async () => {}}
        />
      </MemoryRouter>,
    );
  });
  return { container, root };
}

function unmountShell(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("AppShell full-view layout", () => {
  it("keeps horizontal overflow visible on the expenses full-view route", () => {
    const { container, root } = renderShell("/budget/expenses");
    try {
      const shell = container.firstElementChild as HTMLElement;
      const main = container.querySelector("main");

      expect(shell).toHaveClass("h-dvh");
      expect(shell).toHaveClass("overflow-x-visible");
      expect(shell).toHaveClass("overflow-y-hidden");
      expect(main).toHaveClass("w-full");
      expect(main).toHaveClass("flex-1");
      expect(main).not.toHaveClass("max-w-5xl");
    } finally {
      unmountShell(root, container);
    }
  });

  it("uses normal non-full-view layout on incomes route", () => {
    const { container, root } = renderShell("/budget/incomes");
    try {
      const shell = container.firstElementChild as HTMLElement;
      const main = container.querySelector("main");

      expect(shell).toHaveClass("min-h-screen");
      expect(shell).not.toHaveClass("overflow-x-visible");
      expect(main).toHaveClass("max-w-5xl");
      expect(main).not.toHaveClass("w-full");
      expect(main).not.toHaveClass("flex-1");
    } finally {
      unmountShell(root, container);
    }
  });

  it("uses normal non-full-view layout on non-grid routes", () => {
    const { container, root } = renderShell("/budget/summary");
    try {
      const shell = container.firstElementChild as HTMLElement;
      const main = container.querySelector("main");

      expect(shell).toHaveClass("min-h-screen");
      expect(shell).not.toHaveClass("overflow-x-visible");
      expect(main).not.toHaveClass("overflow-x-visible");
    } finally {
      unmountShell(root, container);
    }
  });
});
