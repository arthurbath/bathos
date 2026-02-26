import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { DataGrid } from "@/components/ui/data-grid";
import { GRID_ACTIONS_COLUMN_WIDTH } from "@/lib/gridColumnWidths";

type RowData = {
  id: string;
  name: string;
  amount: number;
};

const columnHelper = createColumnHelper<RowData>();

function GridLayoutHarness({ fullView = false, showFooter = true }: { fullView?: boolean; showFooter?: boolean }) {
  const rows = React.useMemo<RowData[]>(
    () => [
      { id: "row-a", name: "Alpha", amount: 12 },
      { id: "row-b", name: "Bravo", amount: 18 },
    ],
    [],
  );

  const columns = React.useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "name",
        header: "Name",
        cell: ({ getValue }) => getValue(),
      }),
      columnHelper.accessor("amount", {
        id: "amount",
        header: "Amount",
        cell: ({ getValue }) => String(getValue()),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        enableSorting: false,
        enableResizing: false,
        size: GRID_ACTIONS_COLUMN_WIDTH,
        minSize: GRID_ACTIONS_COLUMN_WIDTH,
        maxSize: GRID_ACTIONS_COLUMN_WIDTH,
        cell: () => <button type="button" aria-label="Row actions">...</button>,
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataGrid
      table={table}
      fullView={fullView}
      footer={showFooter ? (
        <tr>
          <td className="h-9 px-2">Totals</td>
          <td className="h-9 px-2 text-right">30</td>
          <td className="h-9 px-0" />
        </tr>
      ) : undefined}
    />
  );
}

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

describe("DataGrid layout affordances", () => {
  it("keeps header/footer non-sticky in card mode while preserving borders and sticky edge columns", () => {
    const { container, root } = mount(<GridLayoutHarness />);
    try {
      const thead = container.querySelector("thead") as HTMLElement;
      const tfoot = container.querySelector("tfoot") as HTMLElement;
      const firstHeaderCell = container.querySelector("thead th:first-child") as HTMLElement;
      const lastHeaderCell = container.querySelector("thead th:last-child") as HTMLElement;
      const lastHeaderRule = lastHeaderCell.querySelector("[data-grid-sticky-right-rule='true']") as HTMLElement | null;
      const firstBodyCell = container.querySelector("tbody tr td:first-child") as HTMLElement;
      const lastBodyCell = container.querySelector("tbody tr td:last-child") as HTMLElement;

      expect(thead.classList.contains("sticky")).toBe(false);
      expect(tfoot.classList.contains("sticky")).toBe(false);

      expect(thead.className).toContain("[&>tr>th]:shadow-[inset_0_-1px_0_0_hsl(var(--grid-sticky-line)),inset_0_1px_0_0_hsl(var(--grid-sticky-line))]");
      expect(tfoot.className).toContain("[&>tr>td]:shadow-[inset_0_1px_0_0_hsl(var(--grid-sticky-line)),inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]");
      expect(tfoot.className).toContain("[&>tr>td:first-child]:sticky");
      expect(tfoot.className).toContain("[&>tr>td:first-child]:shadow-[inset_-1px_0_0_0_hsl(var(--grid-sticky-line)),inset_0_1px_0_0_hsl(var(--grid-sticky-line)),inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]");
      expect(tfoot.className).toContain("[&>tr>td:last-child]:sticky");
      expect(tfoot.className).toContain("[&>tr>td:last-child]:shadow-[inset_1px_0_0_0_hsl(var(--grid-sticky-line)),inset_0_1px_0_0_hsl(var(--grid-sticky-line)),inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]");

      expect(firstHeaderCell.classList.contains("sticky")).toBe(true);
      expect(firstHeaderCell.classList.contains("left-0")).toBe(true);
      expect(firstHeaderCell.className).toContain("shadow-[inset_-1px_0_0_0_hsl(var(--grid-sticky-line))]");

      expect(lastHeaderCell.classList.contains("sticky")).toBe(true);
      expect(lastHeaderCell.classList.contains("right-0")).toBe(true);
      expect(lastHeaderRule).not.toBeNull();
      expect(lastHeaderRule!.className).toContain("h-6");
      expect(lastHeaderRule!.className).toContain("w-px");
      expect(lastHeaderRule!.className).toContain("bg-[hsl(var(--grid-handle-line))]");

      expect(firstBodyCell.classList.contains("sticky")).toBe(true);
      expect(firstBodyCell.classList.contains("left-0")).toBe(true);
      expect(firstBodyCell.className).toContain("shadow-[inset_-1px_0_0_0_hsl(var(--grid-sticky-line))]");

      expect(lastBodyCell.classList.contains("sticky")).toBe(true);
      expect(lastBodyCell.classList.contains("right-0")).toBe(true);
      expect(lastBodyCell.className).toContain("shadow-[inset_1px_0_0_0_hsl(var(--grid-sticky-line))]");
    } finally {
      unmount(root, container);
    }
  });

  it("keeps header/footer sticky behavior in full-view mode", () => {
    const { container, root } = mount(<GridLayoutHarness fullView />);
    try {
      const thead = container.querySelector("thead") as HTMLElement;
      const tfoot = container.querySelector("tfoot") as HTMLElement;
      expect(thead.classList.contains("sticky")).toBe(true);
      expect(thead.classList.contains("top-0")).toBe(true);
      expect(tfoot.classList.contains("sticky")).toBe(true);
      expect(tfoot.classList.contains("bottom-0")).toBe(true);
    } finally {
      unmount(root, container);
    }
  });

  it("preserves the sticky actions divider on the final body row when footer is absent", () => {
    const { container, root } = mount(<GridLayoutHarness showFooter={false} />);
    try {
      const tbody = container.querySelector("tbody") as HTMLElement;
      const lastBodyCell = container.querySelector("tbody tr:last-child td:last-child") as HTMLElement;

      expect(tbody.className).toContain("[&>tr:last-child>td]:shadow-[inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]");
      expect(tbody.className).toContain("[&>tr:last-child>td:last-child]:shadow-[inset_1px_0_0_0_hsl(var(--grid-sticky-line)),inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]");
      expect(lastBodyCell.className).toContain("shadow-[inset_1px_0_0_0_hsl(var(--grid-sticky-line))]");
    } finally {
      unmount(root, container);
    }
  });
});
