import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { DataGrid } from "@/components/ui/data-grid";

type RowData = {
  id: string;
  name: string;
  amount: number;
};

const columnHelper = createColumnHelper<RowData>();

function GridLayoutHarness({ fullView = false }: { fullView?: boolean }) {
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
      footer={(
        <tr>
          <td className="h-9 px-2">Totals</td>
          <td className="h-9 px-2 text-right">30</td>
        </tr>
      )}
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
  it("keeps header and footer non-sticky in card mode while preserving borders and sticky first column", () => {
    const { container, root } = mount(<GridLayoutHarness />);
    try {
      const thead = container.querySelector("thead") as HTMLElement;
      const tfoot = container.querySelector("tfoot") as HTMLElement;
      const firstHeaderCell = container.querySelector("thead th") as HTMLElement;
      const firstBodyCell = container.querySelector("tbody td") as HTMLElement;

      expect(thead.classList.contains("sticky")).toBe(false);
      expect(tfoot.classList.contains("sticky")).toBe(false);

      expect(thead.className).toContain("[&>tr>th]:shadow-[inset_0_-1px_0_0_hsl(var(--grid-sticky-line)),inset_0_1px_0_0_hsl(var(--grid-sticky-line))]");
      expect(tfoot.className).toContain("[&>tr>td]:shadow-[inset_0_1px_0_0_hsl(var(--grid-sticky-line)),inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]");
      expect(tfoot.className).toContain("[&>tr>td:first-child]:sticky");
      expect(tfoot.className).toContain("[&>tr>td:first-child]:shadow-[inset_-1px_0_0_0_hsl(var(--grid-sticky-line)),inset_0_1px_0_0_hsl(var(--grid-sticky-line)),inset_0_-1px_0_0_hsl(var(--grid-sticky-line))]");

      expect(firstHeaderCell.classList.contains("sticky")).toBe(true);
      expect(firstHeaderCell.classList.contains("left-0")).toBe(true);
      expect(firstHeaderCell.className).toContain("shadow-[inset_-1px_0_0_0_hsl(var(--grid-sticky-line))]");

      expect(firstBodyCell.classList.contains("sticky")).toBe(true);
      expect(firstBodyCell.classList.contains("left-0")).toBe(true);
      expect(firstBodyCell.className).toContain("shadow-[inset_-1px_0_0_0_hsl(var(--grid-sticky-line))]");
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
});
