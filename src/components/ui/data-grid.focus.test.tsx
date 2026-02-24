import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import { DataGrid, GridEditableCell, useDataGrid } from "@/components/ui/data-grid";

type RowData = {
  id: string;
  name: string;
  note: string;
};

type ConditionalRowData = {
  id: string;
  primary: string;
  secondary: string;
  hasSecondary: boolean;
};

type AsyncSelectRowData = {
  id: string;
  label: string;
  category: "A" | "B" | "C";
};


const columnHelper = createColumnHelper<RowData>();

function SortableGridHarness({ initialSorting, onUpdate }: { initialSorting: SortingState; onUpdate?: () => void }) {
  const [rows, setRows] = React.useState<RowData[]>([
    { id: "row-a", name: "Alpha", note: "Apple" },
    { id: "row-b", name: "Mike", note: "Mango" },
  ]);
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);

  const updateRow = React.useCallback((id: string, field: "name" | "note", value: string) => {
    onUpdate?.();
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }, [onUpdate]);

  const columns = React.useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "name",
        header: "Name",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={0}
            onChange={(value) => updateRow(row.original.id, "name", value)}
          />
        ),
      }),
      columnHelper.accessor("note", {
        id: "note",
        header: "Note",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={1}
            onChange={(value) => updateRow(row.original.id, "note", value)}
          />
        ),
      }),
    ],
    [updateRow],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return <DataGrid table={table} />;
}

function ConditionalFrequencyHarness() {
  const [rows, setRows] = React.useState<ConditionalRowData[]>([
    { id: "row-0", primary: "monthly", secondary: "2", hasSecondary: true },
    { id: "row-1", primary: "weekly", secondary: "", hasSecondary: false },
    { id: "row-2", primary: "annual", secondary: "6", hasSecondary: true },
    { id: "row-3", primary: "daily", secondary: "4", hasSecondary: true },
  ]);

  const updateRow = React.useCallback((id: string, field: "primary" | "secondary", value: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }, []);

  const conditionalColumnHelper = createColumnHelper<ConditionalRowData>();
  const columns = React.useMemo(
    () => [
      conditionalColumnHelper.accessor("primary", {
        id: "primary",
        header: "Primary",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={0}
            onChange={(value) => updateRow(row.original.id, "primary", value)}
          />
        ),
      }),
      conditionalColumnHelper.display({
        id: "secondary",
        header: "Secondary",
        cell: ({ row }) => (
          row.original.hasSecondary ? (
            <GridEditableCell
              value={row.original.secondary}
              navCol={1}
              onChange={(value) => updateRow(row.original.id, "secondary", value)}
            />
          ) : null
        ),
      }),
    ],
    [conditionalColumnHelper, updateRow],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function AsyncSelectCell({
  value,
  disabled,
  onChange,
}: {
  value: "A" | "B" | "C";
  disabled: boolean;
  onChange: (next: "A" | "B" | "C") => void;
}) {
  const ctx = useDataGrid();
  return (
    <select
      value={value}
      disabled={disabled}
      data-row={ctx?.rowIndex}
      data-row-id={ctx?.rowId}
      data-col={0}
      onMouseDown={ctx?.onCellMouseDown}
      onKeyDown={ctx?.onCellKeyDown}
      onChange={(event) => {
        ctx?.onCellCommit(0);
        onChange(event.target.value as "A" | "B" | "C");
      }}
    >
      <option value="A">A</option>
      <option value="B">B</option>
      <option value="C">C</option>
    </select>
  );
}

function AsyncSelectCommitHarness() {
  const [rows, setRows] = React.useState<AsyncSelectRowData[]>([
    { id: "row-a", label: "Alpha", category: "A" },
    { id: "row-b", label: "Bravo", category: "B" },
    { id: "row-c", label: "Charlie", category: "C" },
  ]);
  const [pendingById, setPendingById] = React.useState<Record<string, boolean>>({});
  const [sorting] = React.useState<SortingState>([{ id: "category", desc: false }]);
  const timersRef = React.useRef<number[]>([]);

  React.useEffect(() => () => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  }, []);

  const updateCategory = React.useCallback((id: string, next: "A" | "B" | "C") => {
    setPendingById((prev) => ({ ...prev, [id]: true }));
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, category: next } : row)));

    const timer = window.setTimeout(() => {
      setPendingById((prev) => {
        if (!prev[id]) return prev;
        const nextPending = { ...prev };
        delete nextPending[id];
        return nextPending;
      });
    }, 80);
    timersRef.current.push(timer);
  }, []);

  const asyncColumnHelper = createColumnHelper<AsyncSelectRowData>();
  const columns = React.useMemo(
    () => [
      asyncColumnHelper.accessor("category", {
        id: "category",
        header: "Category",
        cell: ({ row, getValue }) => (
          <AsyncSelectCell
            value={getValue()}
            disabled={!!pendingById[row.original.id]}
            onChange={(next) => updateCategory(row.original.id, next)}
          />
        ),
      }),
      asyncColumnHelper.accessor("label", {
        id: "label",
        header: "Label",
      }),
    ],
    [asyncColumnHelper, pendingById, updateCategory],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return <DataGrid table={table} />;
}


function findInputByValue(container: HTMLElement, value: string) {
  return Array.from(container.querySelectorAll<HTMLInputElement>("input")).find((input) => input.value === value) ?? null;
}

async function waitForCondition(assertion: () => void, timeoutMs = 1500) {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    });
  }
  throw lastError instanceof Error ? lastError : new Error("Condition not met before timeout");
}

async function startEditing(input: HTMLInputElement) {
  await act(async () => {
    input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    input.focus();
  });
  await waitForCondition(() => {
    expect(input.getAttribute("data-grid-editing")).toBe("true");
  });
}

async function dispatchInputChange(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(input, "value")?.set;
  const prototypeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
  const setValue = prototypeSetter && valueSetter !== prototypeSetter ? prototypeSetter : valueSetter;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function dispatchTab(input: HTMLInputElement, shiftKey = false) {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true }));
  });
}

async function dispatchEnter(input: HTMLInputElement) {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
}

async function dispatchArrow(input: HTMLInputElement, key: "ArrowUp" | "ArrowDown") {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
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

describe("DataGrid focus after commit resort", () => {
  it("tabs to the next cell after editing a sorted column that moves the row", async () => {
    const onUpdate = vi.fn();
    const { container, root } = mount(<SortableGridHarness initialSorting={[{ id: "name", desc: false }]} onUpdate={onUpdate} />);
    try {
      const editedCell = findInputByValue(container, "Alpha");
      expect(editedCell).not.toBeNull();
      await startEditing(editedCell!);
      await dispatchInputChange(editedCell!, "Zulu");
      await dispatchTab(editedCell!);

      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("1");
      });
      expect(onUpdate).toHaveBeenCalledTimes(1);
    } finally {
      unmount(root, container);
    }
  });

  it("shift-tabs to the previous cell after editing a sorted column that moves the row", async () => {
    const onUpdate = vi.fn();
    const { container, root } = mount(<SortableGridHarness initialSorting={[{ id: "note", desc: false }]} onUpdate={onUpdate} />);
    try {
      const editedCell = findInputByValue(container, "Apple");
      expect(editedCell).not.toBeNull();
      await startEditing(editedCell!);
      await dispatchInputChange(editedCell!, "Zulu");
      await dispatchTab(editedCell!, true);

      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("0");
      });
      expect(onUpdate).toHaveBeenCalledTimes(1);
    } finally {
      unmount(root, container);
    }
  });

  it("retains focus on the same cell after enter-commit when sorting moves the row", async () => {
    const onUpdate = vi.fn();
    const { container, root } = mount(<SortableGridHarness initialSorting={[{ id: "name", desc: false }]} onUpdate={onUpdate} />);
    try {
      const editedCell = findInputByValue(container, "Alpha");
      expect(editedCell).not.toBeNull();
      await startEditing(editedCell!);
      await dispatchInputChange(editedCell!, "Zulu");
      await dispatchEnter(editedCell!);

      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("0");
      });
      expect(onUpdate).toHaveBeenCalledTimes(1);
    } finally {
      unmount(root, container);
    }
  });
});

describe("DataGrid vertical navigation with conditional secondary input", () => {
  it("moves to matching secondary input when present, otherwise falls back to primary input", async () => {
    const { container, root } = mount(<ConditionalFrequencyHarness />);
    try {
      const row3Secondary = container.querySelector<HTMLInputElement>('input[data-row-id="row-3"][data-col="1"]');
      expect(row3Secondary).not.toBeNull();
      await act(async () => {
        row3Secondary!.focus();
      });

      await dispatchArrow(row3Secondary!, "ArrowUp");
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-2");
        expect(active?.getAttribute("data-col")).toBe("1");
      });

      const row2Secondary = container.querySelector<HTMLInputElement>('input[data-row-id="row-2"][data-col="1"]');
      expect(row2Secondary).not.toBeNull();
      await act(async () => {
        row2Secondary!.focus();
      });

      await dispatchArrow(row2Secondary!, "ArrowUp");
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-1");
        expect(active?.getAttribute("data-col")).toBe("0");
      });
    } finally {
      unmount(root, container);
    }
  });
});

describe("DataGrid focus restore after async commit", () => {
  it("restores focus to the moved select after it is re-enabled", async () => {
    const { container, root } = mount(<AsyncSelectCommitHarness />);
    try {
      const select = container.querySelector<HTMLSelectElement>('select[data-row-id="row-a"][data-col="0"]');
      expect(select).not.toBeNull();
      await act(async () => {
        select!.focus();
      });

      await act(async () => {
        select!.value = "C";
        select!.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.tagName).toBe("SELECT");
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("0");
      }, 3000);
    } finally {
      unmount(root, container);
    }
  });
});
