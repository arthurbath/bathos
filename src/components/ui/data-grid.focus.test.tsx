import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import { DataGrid, GridEditableCell } from "@/components/ui/data-grid";

type RowData = {
  id: string;
  name: string;
  note: string;
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
});
