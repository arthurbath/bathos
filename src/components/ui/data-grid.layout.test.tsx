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

function GridLayoutHarness({
  fullView = false,
  showFooter = true,
  showRowActions = true,
}: {
  fullView?: boolean;
  showFooter?: boolean;
  showRowActions?: boolean;
}) {
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
        size: 220,
        cell: ({ getValue }) => getValue(),
      }),
      columnHelper.accessor("amount", {
        id: "amount",
        header: "Amount",
        size: 140,
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
        meta: showRowActions ? { containsButton: true } : undefined,
        cell: () => (showRowActions
          ? <button type="button" aria-label="Row actions">...</button>
          : null),
      }),
    ],
    [showRowActions],
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

function BackupResizeHarness() {
  const rows = React.useMemo<RowData[]>(
    () => [
      { id: "row-a", name: "2026-01-01", amount: 1 },
    ],
    [],
  );
  const [columnSizing, setColumnSizing] = React.useState({
    timestamp: 240,
    notes: 420,
    actions: GRID_ACTIONS_COLUMN_WIDTH,
  });
  const [columnSizingInfo, setColumnSizingInfo] = React.useState({
    startOffset: null,
    startSize: null,
    deltaOffset: null,
    deltaPercentage: null,
    isResizingColumn: false,
    columnSizingStart: [],
  });

  const backupColumns = React.useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "timestamp",
        header: "Timestamp",
        size: 240,
        cell: ({ getValue }) => getValue(),
      }),
      columnHelper.accessor("amount", {
        id: "notes",
        header: "Notes",
        size: 420,
        cell: () => "Example note",
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        enableSorting: false,
        enableResizing: false,
        size: GRID_ACTIONS_COLUMN_WIDTH,
        minSize: GRID_ACTIONS_COLUMN_WIDTH,
        maxSize: GRID_ACTIONS_COLUMN_WIDTH,
        meta: { containsButton: true },
        cell: () => <button type="button" aria-label="Row actions">...</button>,
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns: backupColumns,
    state: { columnSizing, columnSizingInfo },
    onColumnSizingChange: setColumnSizing,
    onColumnSizingInfoChange: setColumnSizingInfo,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <button
        type="button"
        data-testid="grow-notes"
        onClick={() => {
          setColumnSizing((current) => ({
            ...current,
            notes: current.notes + 120,
          }));
        }}
      >
        grow
      </button>
      <DataGrid table={table} stickyFirstColumn={false} />
    </div>
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

  it("hides the trailing actions column and adds header resize margin when no row actions exist", () => {
    const { container, root } = mount(<GridLayoutHarness showRowActions={false} />);
    try {
      const headers = container.querySelectorAll("thead th");
      const bodyCells = container.querySelectorAll("tbody tr:first-child td");
      const amountHeaderCell = container.querySelector("thead th:nth-child(2)") as HTMLElement;
      const spacerHeaderCell = container.querySelector("thead th:last-child") as HTMLElement;
      const lastHeaderRule = amountHeaderCell.querySelector("[data-grid-sticky-right-rule='true']");
      const resizeHandle = amountHeaderCell.querySelector("button[aria-label='Resize amount column']") as HTMLButtonElement | null;
      const spacerBodyCell = container.querySelector("tbody tr:first-child td:last-child") as HTMLElement;
      const tfoot = container.querySelector("tfoot") as HTMLElement;

      expect(headers.length).toBe(3);
      expect(bodyCells.length).toBe(3);
      expect(container.querySelector("button[aria-label='Row actions']")).toBeNull();
      expect(amountHeaderCell.classList.contains("sticky")).toBe(false);
      expect(amountHeaderCell.classList.contains("right-0")).toBe(false);
      expect(lastHeaderRule).toBeNull();
      expect(resizeHandle?.style.right).toBe("-5px");
      expect(spacerHeaderCell.style.width).toBe("40px");
      expect(spacerBodyCell.style.width).toBe("40px");
      expect(tfoot.className).toContain("[&>tr>td:last-child]:w-[40px]");
      expect(tfoot.className).not.toContain("[&>tr>td:last-child]:sticky");
    } finally {
      unmount(root, container);
    }
  });

  it("routes excess table width to the actions column when row actions exist", () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 820;
      },
    });

    const { container, root } = mount(<GridLayoutHarness />);
    try {
      const nameHeaderCell = container.querySelector("thead th:nth-child(1)") as HTMLElement;
      const amountHeaderCell = container.querySelector("thead th:nth-child(2)") as HTMLElement;
      const actionsHeaderCell = container.querySelector("thead th:nth-child(3)") as HTMLElement;

      expect(nameHeaderCell.style.width).toBe("220px");
      expect(amountHeaderCell.style.width).toBe("140px");
      expect(actionsHeaderCell.style.width).toBe("460px");
    } finally {
      unmount(root, container);
      if (originalClientWidth) {
        Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      }
    }
  });

  it("shrinks actions trailing fill when a preceding backups column grows", () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 1000;
      },
    });

    const { container, root } = mount(<BackupResizeHarness />);
    try {
      const notesHeaderCellBefore = container.querySelector("thead th:nth-child(2)") as HTMLElement;
      const actionsHeaderCellBefore = container.querySelector("thead th:nth-child(3)") as HTMLElement;

      expect(notesHeaderCellBefore.style.width).toBe("420px");
      expect(actionsHeaderCellBefore.style.width).toBe("340px");

      const growButton = container.querySelector("[data-testid='grow-notes']") as HTMLButtonElement;
      act(() => {
        growButton.click();
      });

      const notesHeaderCellAfter = container.querySelector("thead th:nth-child(2)") as HTMLElement;
      const actionsHeaderCellAfter = container.querySelector("thead th:nth-child(3)") as HTMLElement;

      expect(notesHeaderCellAfter.style.width).toBe("540px");
      expect(actionsHeaderCellAfter.style.width).toBe("220px");
    } finally {
      unmount(root, container);
      if (originalClientWidth) {
        Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      }
    }
  });
});
