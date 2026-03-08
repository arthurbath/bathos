import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import { ColorPicker } from "@/components/ManagedListSection";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataGrid, GridCheckboxCell, GridEditableCell, gridMenuTriggerProps, gridNavProps, gridSelectTriggerProps, useDataGrid } from "@/components/ui/data-grid";

if (typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.scrollIntoView !== "function") {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
}

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

type MenuRowData = {
  id: string;
  name: string;
};

type ColorRowData = {
  id: string;
  color: string | null;
};

type SelectRowData = {
  id: string;
  owner: "X" | "Y";
};

type NullableSelectRowData = {
  id: string;
  owner: "X" | "Y" | null;
};

type NumberRowData = {
  id: string;
  amount: number;
};

type YearRowData = {
  id: string;
  year: number;
};

type AsyncNoteRowData = {
  id: string;
  note: string;
};

type AsyncCheckboxRowData = {
  id: string;
  monitoring: boolean;
};

type DeleteResetRowData = {
  id: string;
  optionalText: string | null;
  requiredText: string;
  zeroableNumber: number;
  protectedNumber: number | null;
  checked: boolean;
};


const columnHelper = createColumnHelper<RowData>();
const asyncNoteColumnHelper = createColumnHelper<AsyncNoteRowData>();
const asyncCheckboxColumnHelper = createColumnHelper<AsyncCheckboxRowData>();

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

function StickyViewportHarness() {
  const [rows] = React.useState<RowData[]>([
    { id: "row-a", name: "Alpha", note: "Apple" },
  ]);

  const columns = React.useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "name",
        header: "Name",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={0}
            onChange={() => {}}
            cellId={`name-${row.original.id}`}
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
            onChange={() => {}}
            cellId={`note-${row.original.id}`}
          />
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataGrid
      table={table}
      fullView
      groupBy={() => "Group"}
      renderGroupHeader={(_groupKey, groupRows) => (
        <tr key="group-row" className="sticky top-[36px] z-30">
          <td className="sticky left-0 z-30">Group ({groupRows.length})</td>
          <td />
        </tr>
      )}
    />
  );
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

function AsyncSelectCommitHarness({ saveDelayMs = 80 }: { saveDelayMs?: number }) {
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
    }, saveDelayMs);
    timersRef.current.push(timer);
  }, [saveDelayMs]);

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

function MenuTriggerHarness({ onTriggerClick }: { onTriggerClick: () => void }) {
  const [rows] = React.useState<MenuRowData[]>([
    { id: "row-a", name: "Alpha" },
  ]);
  const menuColumnHelper = createColumnHelper<MenuRowData>();
  const columns = React.useMemo(
    () => [
      menuColumnHelper.accessor("name", {
        id: "name",
        header: "Name",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={0}
            onChange={() => {}}
            cellId={`name-${row.original.id}`}
          />
        ),
      }),
      menuColumnHelper.display({
        id: "actions",
        header: "Actions",
        meta: { containsButton: true },
        cell: () => {
          const ctx = useDataGrid();
          return (
            <button
              type="button"
              data-row={ctx?.rowIndex}
              data-row-id={ctx?.rowId}
              data-col={1}
              aria-haspopup="menu"
              onMouseDown={ctx?.onCellMouseDown}
              onKeyDown={ctx?.onCellKeyDown}
              onClick={onTriggerClick}
            >
              ...
            </button>
          );
        },
      }),
    ],
    [menuColumnHelper, onTriggerClick],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function FocusOnlyButtonHarness({ onOpen }: { onOpen: () => void }) {
  const [rows] = React.useState<MenuRowData[]>([
    { id: "row-a", name: "Alpha" },
  ]);
  const buttonColumnHelper = createColumnHelper<MenuRowData>();
  const columns = React.useMemo(
    () => [
      buttonColumnHelper.accessor("name", {
        id: "name",
        header: "Name",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={0}
            onChange={() => {}}
            cellId={`name-${row.original.id}`}
          />
        ),
      }),
      buttonColumnHelper.display({
        id: "amount",
        header: "Amount",
        meta: { containsButton: true },
        cell: () => {
          const ctx = useDataGrid();
          return (
            <button
              type="button"
              data-grid-focus-only="true"
              aria-label="Edit averaged records for Alpha"
              onClick={onOpen}
              {...gridNavProps(ctx, 1)}
            >
              123
            </button>
          );
        },
      }),
    ],
    [buttonColumnHelper, onOpen],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function DropdownMenuHarness() {
  const [rows] = React.useState<MenuRowData[]>([
    { id: "row-a", name: "Alpha" },
  ]);
  const menuColumnHelper = createColumnHelper<MenuRowData>();
  const columns = React.useMemo(
    () => [
      menuColumnHelper.accessor("name", {
        id: "name",
        header: "Name",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={0}
            onChange={() => {}}
            cellId={`name-${row.original.id}`}
          />
        ),
      }),
      menuColumnHelper.display({
        id: "actions",
        header: "Actions",
        meta: { containsButton: true },
        cell: () => {
          const ctx = useDataGrid();
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" {...gridMenuTriggerProps(ctx, 1)}>
                  ...
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    [menuColumnHelper],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function ColorPickerHarness() {
  const [rows] = React.useState<ColorRowData[]>([
    { id: "row-a", color: "#3B82F6" },
  ]);
  const colorColumnHelper = createColumnHelper<ColorRowData>();
  const columns = React.useMemo(
    () => [
      colorColumnHelper.display({
        id: "color",
        header: "Color",
        cell: ({ row }) => (
          <ColorPicker
            color={row.original.color}
            onChange={() => {}}
            navCol={0}
          />
        ),
      }),
    ],
    [colorColumnHelper],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function GridSelectHarness() {
  const [rows, setRows] = React.useState<SelectRowData[]>([
    { id: "row-a", owner: "X" },
  ]);
  const selectColumnHelper = createColumnHelper<SelectRowData>();
  const columns = React.useMemo(
    () => [
      selectColumnHelper.accessor("owner", {
        id: "owner",
        header: "Owner",
        cell: ({ row, getValue }) => {
          const ctx = useDataGrid();
          return (
            <Select
              value={getValue()}
              onValueChange={(next) => {
                setRows((prev) => prev.map((entry) => (entry.id === row.original.id ? { ...entry, owner: next as "X" | "Y" } : entry)));
              }}
            >
              <SelectTrigger
                {...gridSelectTriggerProps(ctx, 0)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="X">X</SelectItem>
                <SelectItem value="Y">Y</SelectItem>
              </SelectContent>
            </Select>
          );
        },
      }),
    ],
    [selectColumnHelper],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function NullableGridSelectHarness() {
  const [rows, setRows] = React.useState<NullableSelectRowData[]>([
    { id: "row-a", owner: "X" },
  ]);
  const selectColumnHelper = createColumnHelper<NullableSelectRowData>();
  const columns = React.useMemo(
    () => [
      selectColumnHelper.accessor("owner", {
        id: "owner",
        header: "Owner",
        cell: ({ row, getValue }) => {
          const ctx = useDataGrid();
          return (
            <Select
              value={getValue() ?? "_none"}
              onValueChange={(next) => {
                setRows((prev) => prev.map((entry) => (
                  entry.id === row.original.id
                    ? { ...entry, owner: next === "_none" ? null : (next as "X" | "Y") }
                    : entry
                )));
              }}
            >
              <SelectTrigger
                {...gridSelectTriggerProps(ctx, 0, {
                  onDeleteReset: () => {
                    setRows((prev) => prev.map((entry) => (
                      entry.id === row.original.id
                        ? { ...entry, owner: null }
                        : entry
                    )));
                  },
                })}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                <SelectItem value="X">X</SelectItem>
                <SelectItem value="Y">Y</SelectItem>
              </SelectContent>
            </Select>
          );
        },
      }),
    ],
    [selectColumnHelper],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function DeleteResetHarness() {
  const [rows, setRows] = React.useState<DeleteResetRowData[]>([
    {
      id: "row-a",
      optionalText: "Optional note",
      requiredText: "Required name",
      zeroableNumber: 42,
      protectedNumber: 7,
      checked: true,
    },
  ]);
  const deleteResetColumnHelper = createColumnHelper<DeleteResetRowData>();
  const columns = React.useMemo(
    () => [
      deleteResetColumnHelper.accessor("optionalText", {
        id: "optionalText",
        header: "Optional Text",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue() ?? ""}
            navCol={0}
            deleteResetValue=""
            onChange={(next) => {
              setRows((prev) => prev.map((entry) => (
                entry.id === row.original.id
                  ? { ...entry, optionalText: next.trim() ? next : null }
                  : entry
              )));
            }}
          />
        ),
      }),
      deleteResetColumnHelper.accessor("requiredText", {
        id: "requiredText",
        header: "Required Text",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={1}
            onChange={(next) => {
              setRows((prev) => prev.map((entry) => (
                entry.id === row.original.id
                  ? { ...entry, requiredText: next.trim() || entry.requiredText }
                  : entry
              )));
            }}
          />
        ),
      }),
      deleteResetColumnHelper.accessor("zeroableNumber", {
        id: "zeroableNumber",
        header: "Zeroable Number",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={2}
            type="number"
            deleteResetValue="0"
            onChange={(next) => {
              const parsed = Number(next);
              if (!Number.isFinite(parsed)) return;
              setRows((prev) => prev.map((entry) => (
                entry.id === row.original.id
                  ? { ...entry, zeroableNumber: parsed }
                  : entry
              )));
            }}
          />
        ),
      }),
      deleteResetColumnHelper.accessor("protectedNumber", {
        id: "protectedNumber",
        header: "Protected Number",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue() ?? ""}
            navCol={3}
            type="number"
            onChange={(next) => {
              const parsed = Number(next);
              setRows((prev) => prev.map((entry) => (
                entry.id === row.original.id
                  ? { ...entry, protectedNumber: Number.isFinite(parsed) && parsed > 0 ? parsed : entry.protectedNumber }
                  : entry
              )));
            }}
          />
        ),
      }),
      deleteResetColumnHelper.accessor("checked", {
        id: "checked",
        header: "Checked",
        cell: ({ row, getValue }) => (
          <GridCheckboxCell
            checked={getValue()}
            navCol={4}
            deleteResetChecked={false}
            onChange={(next) => {
              setRows((prev) => prev.map((entry) => (
                entry.id === row.original.id
                  ? { ...entry, checked: next }
                  : entry
              )));
            }}
          />
        ),
      }),
    ],
    [deleteResetColumnHelper],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function NumberFormattingHarness() {
  const [rows, setRows] = React.useState<NumberRowData[]>([
    { id: "row-a", amount: 1200 },
  ]);
  const numberColumnHelper = createColumnHelper<NumberRowData>();
  const columns = React.useMemo(
    () => [
      numberColumnHelper.accessor("amount", {
        id: "amount",
        header: "Amount",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={0}
            type="number"
            onChange={(next) => {
              const parsed = Number(next);
              if (Number.isFinite(parsed)) {
                setRows((prev) => prev.map((entry) => (entry.id === row.original.id ? { ...entry, amount: parsed } : entry)));
              }
            }}
          />
        ),
      }),
    ],
    [numberColumnHelper],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function YearFormattingHarness() {
  const [rows, setRows] = React.useState<YearRowData[]>([
    { id: "row-a", year: 2024 },
  ]);
  const yearColumnHelper = createColumnHelper<YearRowData>();
  const columns = React.useMemo(
    () => [
      yearColumnHelper.accessor("year", {
        id: "year",
        header: "Year",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={0}
            type="number"
            inputMode="numeric"
            numberDisplayFormat="plain"
            onChange={(next) => {
              const parsed = Number(next);
              if (Number.isFinite(parsed)) {
                setRows((prev) => prev.map((entry) => (entry.id === row.original.id ? { ...entry, year: parsed } : entry)));
              }
            }}
          />
        ),
      }),
    ],
    [yearColumnHelper],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function AsyncTextCommitHarness({ saveDelayMs = 250 }: { saveDelayMs?: number }) {
  const [rows, setRows] = React.useState<AsyncNoteRowData[]>([
    { id: "row-a", note: "Initial note" },
  ]);
  const columns = React.useMemo(
    () => [
      asyncNoteColumnHelper.accessor("note", {
        id: "note",
        header: "Note",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={0}
            onChange={(next) => (
              new Promise<void>((resolve) => {
                window.setTimeout(() => {
                  setRows((prev) => prev.map((entry) => (entry.id === row.original.id ? { ...entry, note: next } : entry)));
                  resolve();
                }, saveDelayMs);
              })
            )}
          />
        ),
      }),
    ],
    [saveDelayMs],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function AsyncCheckboxCommitHarness({ saveDelayMs = 250 }: { saveDelayMs?: number }) {
  const [rows, setRows] = React.useState<AsyncCheckboxRowData[]>([
    { id: "row-a", monitoring: false },
  ]);
  const [pendingById, setPendingById] = React.useState<Record<string, boolean>>({});

  const clearPending = React.useCallback((id: string) => {
    setPendingById((prev) => {
      if (!prev[id]) return prev;
      const nextPending = { ...prev };
      delete nextPending[id];
      return nextPending;
    });
  }, []);

  const columns = React.useMemo(
    () => [
      asyncCheckboxColumnHelper.accessor("monitoring", {
        id: "monitoring",
        header: "Monitoring",
        cell: ({ row, getValue }) => (
          <GridCheckboxCell
            checked={getValue()}
            navCol={0}
            disabled={!!pendingById[row.original.id]}
            onChange={(next) => (
              new Promise<void>((resolve) => {
                setPendingById((prev) => ({ ...prev, [row.original.id]: true }));
                window.setTimeout(() => {
                  setRows((prev) => prev.map((entry) => (entry.id === row.original.id ? { ...entry, monitoring: next } : entry)));
                  clearPending(row.original.id);
                  resolve();
                }, saveDelayMs);
              })
            )}
          />
        ),
      }),
    ],
    [clearPending, pendingById, saveDelayMs],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataGrid table={table} />;
}

function AsyncTextCommitWithTransientStaleHarness() {
  const [rows, setRows] = React.useState<AsyncNoteRowData[]>([
    { id: "row-a", note: "Initial note" },
  ]);
  const columns = React.useMemo(
    () => [
      asyncNoteColumnHelper.accessor("note", {
        id: "note",
        header: "Note",
        cell: ({ row, getValue }) => (
          <GridEditableCell
            value={getValue()}
            navCol={0}
            onChange={(next) => (
              new Promise<void>((resolve) => {
                setRows((prev) => prev.map((entry) => (entry.id === row.original.id ? { ...entry, note: next } : entry)));
                window.setTimeout(() => {
                  setRows((prev) => prev.map((entry) => (entry.id === row.original.id ? { ...entry, note: "Initial note" } : entry)));
                }, 40);
                window.setTimeout(() => {
                  setRows((prev) => prev.map((entry) => (entry.id === row.original.id ? { ...entry, note: next } : entry)));
                  resolve();
                }, 140);
              })
            )}
          />
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
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

async function dispatchEnterOnElement(element: HTMLElement) {
  await act(async () => {
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    if (!event.defaultPrevented && element instanceof HTMLButtonElement) {
      element.click();
    }
  });
}

async function dispatchDeleteOnElement(element: HTMLElement, key: "Backspace" | "Delete" = "Backspace") {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

async function dispatchEscapeOnElement(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
}

async function dispatchArrow(input: HTMLInputElement, key: "ArrowUp" | "ArrowDown") {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

async function dispatchTouchPointerDown(input: HTMLInputElement) {
  await act(async () => {
    const event = typeof PointerEvent !== "undefined"
      ? new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" })
      : new Event("pointerdown", { bubbles: true });
    if (!("pointerType" in event)) {
      Object.defineProperty(event, "pointerType", { value: "touch" });
    }
    input.dispatchEvent(event);
  });
}

function makeRect({
  top,
  left,
  width,
  height,
}: {
  top: number;
  left: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockElementRect(element: Element, rect: DOMRect) {
  const original = element.getBoundingClientRect.bind(element);
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => rect,
  });
  return () => {
    Object.defineProperty(element, "getBoundingClientRect", {
      configurable: true,
      value: original,
    });
  };
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
  it("enters editable mode on touch pointerdown before focus", async () => {
    const { container, root } = mount(<SortableGridHarness initialSorting={[{ id: "name", desc: false }]} />);
    try {
      const input = findInputByValue(container, "Alpha");
      expect(input).not.toBeNull();
      expect(input!.getAttribute("data-grid-editing")).toBe("false");
      expect(input!.readOnly).toBe(true);

      await dispatchTouchPointerDown(input!);

      await waitForCondition(() => {
        expect(input!.getAttribute("data-grid-editing")).toBe("true");
        expect(input!.readOnly).toBe(false);
      });
    } finally {
      unmount(root, container);
    }
  });

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

describe("DataGrid viewport scrolling", () => {
  it("keeps keyboard-focused cells fully clear of sticky headers, group rows, and left sticky columns", async () => {
    const { container, root } = mount(<StickyViewportHarness />);
    const restoreRects: Array<() => void> = [];

    try {
      const gridContainer = container.querySelector<HTMLDivElement>("div.overflow-auto");
      const header = container.querySelector<HTMLElement>("thead.sticky");
      const groupRow = container.querySelector<HTMLElement>("tbody tr.sticky");
      const groupHeaderCell = groupRow?.querySelector<HTMLElement>("td.sticky");
      const stickyFirstCell = container.querySelector<HTMLElement>("tbody tr:not(.sticky) td.sticky");
      const targetInput = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="1"]');

      expect(gridContainer).not.toBeNull();
      expect(header).not.toBeNull();
      expect(groupRow).not.toBeNull();
      expect(groupHeaderCell).not.toBeNull();
      expect(stickyFirstCell).not.toBeNull();
      expect(targetInput).not.toBeNull();

      restoreRects.push(mockElementRect(gridContainer!, makeRect({ top: 0, left: 0, width: 200, height: 200 })));
      restoreRects.push(mockElementRect(header!, makeRect({ top: 0, left: 0, width: 200, height: 36 })));
      restoreRects.push(mockElementRect(groupRow!, makeRect({ top: 36, left: 0, width: 200, height: 28 })));
      restoreRects.push(mockElementRect(groupHeaderCell!, makeRect({ top: 36, left: 0, width: 80, height: 28 })));
      restoreRects.push(mockElementRect(stickyFirstCell!, makeRect({ top: 60, left: 0, width: 80, height: 28 })));
      restoreRects.push(mockElementRect(targetInput!, makeRect({ top: 60, left: 70, width: 70, height: 28 })));

      gridContainer!.scrollTop = 50;
      gridContainer!.scrollLeft = 30;

      await act(async () => {
        targetInput!.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      });

      await waitForCondition(() => {
        expect(gridContainer!.scrollTop).toBe(46);
        expect(gridContainer!.scrollLeft).toBe(20);
      });
    } finally {
      while (restoreRects.length > 0) restoreRects.pop()?.();
      unmount(root, container);
    }
  });

  it("does not scroll toward a commit target while that cell is temporarily disabled during save", async () => {
    const { container, root } = mount(<AsyncSelectCommitHarness saveDelayMs={250} />);
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

    try {
      const gridContainer = container.querySelector<HTMLDivElement>("div.overflow-auto");
      const select = container.querySelector<HTMLSelectElement>('select[data-row-id="row-a"][data-col="0"]');

      expect(gridContainer).not.toBeNull();
      expect(select).not.toBeNull();

      HTMLElement.prototype.getBoundingClientRect = function patchedGetBoundingClientRect(this: HTMLElement) {
        if (this === gridContainer) {
          return makeRect({ top: 0, left: 0, width: 100, height: 100 });
        }

        if (this.matches('select[data-row-id="row-a"][data-col="0"]')) {
          if ((this as HTMLSelectElement).value === "A") {
            return makeRect({ top: 10, left: 10, width: 40, height: 24 });
          }
          return makeRect({ top: 150, left: 150, width: 40, height: 24 });
        }

        return originalGetBoundingClientRect.call(this);
      };

      gridContainer!.scrollTop = 0;
      gridContainer!.scrollLeft = 0;

      await act(async () => {
        select!.focus();
      });

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 40));
      });

      await act(async () => {
        select!.value = "C";
        select!.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      });

      expect(gridContainer!.scrollTop).toBe(0);
      expect(gridContainer!.scrollLeft).toBe(0);

      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.tagName).toBe("SELECT");
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("0");
        expect(gridContainer!.scrollTop).toBe(74);
        expect(gridContainer!.scrollLeft).toBe(90);
      }, 3000);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
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

  it("restores focus even when async save keeps the control disabled for multiple seconds", async () => {
    const { container, root } = mount(<AsyncSelectCommitHarness saveDelayMs={3500} />);
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
      }, 7000);
    } finally {
      unmount(root, container);
    }
  }, 10000);
});

describe("DataGrid menu trigger keyboard navigation", () => {
  it("focuses menu trigger buttons without auto-clicking when tabbing from prior cell", async () => {
    const onTriggerClick = vi.fn();
    const { container, root } = mount(<MenuTriggerHarness onTriggerClick={onTriggerClick} />);
    try {
      const nameInput = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
      expect(nameInput).not.toBeNull();

      await act(async () => {
        nameInput!.focus();
      });

      await dispatchTab(nameInput!);
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("1");
      });

      expect(onTriggerClick).toHaveBeenCalledTimes(0);
    } finally {
      unmount(root, container);
    }
  });

  it("opens dropdown menu from focused ellipsis trigger via Enter and focuses first menu item", async () => {
    const { container, root } = mount(<DropdownMenuHarness />);
    try {
      const nameInput = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
      expect(nameInput).not.toBeNull();

      await act(async () => {
        nameInput!.focus();
      });

      await dispatchTab(nameInput!);
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("1");
      });

      const trigger = document.activeElement as HTMLElement;
      await dispatchEnterOnElement(trigger);
      await waitForCondition(() => {
        const menuItem = document.querySelector<HTMLElement>('[role="menuitem"]');
        expect(menuItem).not.toBeNull();
        expect(menuItem!.textContent).toContain("Delete");
        expect(document.activeElement?.getAttribute("role")).toBe("menuitem");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("closes dropdown menu via Escape and returns focus to the trigger", async () => {
    const { container, root } = mount(<DropdownMenuHarness />);
    try {
      const nameInput = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
      expect(nameInput).not.toBeNull();

      await act(async () => {
        nameInput!.focus();
      });

      await dispatchTab(nameInput!);
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("1");
      });

      const trigger = document.activeElement as HTMLElement;
      await dispatchEnterOnElement(trigger);
      await waitForCondition(() => {
        expect(document.activeElement?.getAttribute("role")).toBe("menuitem");
      });

      const focusedMenuItem = document.activeElement as HTMLElement;
      await dispatchEscapeOnElement(focusedMenuItem);
      await waitForCondition(() => {
        expect(document.querySelector<HTMLElement>('[role="menuitem"]')).toBeNull();
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("1");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("focuses focus-only buttons without auto-clicking when tabbing from the prior cell, then opens on Enter", async () => {
    const onOpen = vi.fn();
    const { container, root } = mount(<FocusOnlyButtonHarness onOpen={onOpen} />);
    try {
      const nameInput = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
      expect(nameInput).not.toBeNull();

      await act(async () => {
        nameInput!.focus();
      });

      await dispatchTab(nameInput!);
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("1");
      });

      expect(onOpen).toHaveBeenCalledTimes(0);

      const trigger = document.activeElement as HTMLElement;
      await dispatchEnterOnElement(trigger);
      expect(onOpen).toHaveBeenCalledTimes(1);
    } finally {
      unmount(root, container);
    }
  });
});

describe("DataGrid escape cancellation", () => {
  it("restores the pre-edit value for text inputs when Escape is pressed", async () => {
    const onUpdate = vi.fn();
    const { container, root } = mount(<SortableGridHarness initialSorting={[{ id: "name", desc: false }]} onUpdate={onUpdate} />);
    try {
      const input = findInputByValue(container, "Alpha");
      expect(input).not.toBeNull();

      await act(async () => {
        input!.focus();
      });
      await dispatchEnter(input!);
      await waitForCondition(() => {
        expect(input!.getAttribute("data-grid-editing")).toBe("true");
      });

      await dispatchInputChange(input!, "Alpha edited");
      expect(input!.value).toBe("Alpha edited");

      await dispatchEscapeOnElement(input!);
      await waitForCondition(() => {
        expect(input!.getAttribute("data-grid-editing")).toBe("false");
        expect(input!.value).toBe("Alpha");
      });
      expect(onUpdate).toHaveBeenCalledTimes(0);
    } finally {
      unmount(root, container);
    }
  });

  it("closes the color palette via Escape and returns focus to the swatch trigger", async () => {
    const { container, root } = mount(<ColorPickerHarness />);
    try {
      const trigger = container.querySelector<HTMLElement>('button[data-row-id="row-a"][data-col="0"][title="Pick color"]');
      expect(trigger).not.toBeNull();

      await act(async () => {
        trigger!.focus();
      });
      await dispatchEnterOnElement(trigger!);
      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("aria-label")?.startsWith("Use ")).toBe(true);
      });

      const focusedSwatch = document.activeElement as HTMLElement;
      await dispatchEscapeOnElement(focusedSwatch);
      await waitForCondition(() => {
        expect(document.querySelector<HTMLElement>('[aria-label^="Use "]')).toBeNull();
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("0");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("closes a data-grid select menu via Escape and returns focus to its trigger", async () => {
    const { container, root } = mount(<GridSelectHarness />);
    try {
      const trigger = container.querySelector<HTMLElement>('[data-row-id="row-a"][data-col="0"]');
      expect(trigger).not.toBeNull();

      await act(async () => {
        trigger!.focus();
      });
      await dispatchEnterOnElement(trigger!);
      await waitForCondition(() => {
        const listbox = document.querySelector<HTMLElement>('[role="listbox"]');
        expect(listbox).not.toBeNull();
      });

      const focusedOption = document.activeElement as HTMLElement;
      await dispatchEscapeOnElement(focusedOption);
      await waitForCondition(() => {
        expect(document.querySelector<HTMLElement>('[role="listbox"]')).toBeNull();
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("0");
      });
    } finally {
      unmount(root, container);
    }
  });
});

describe("DataGrid delete reset behavior", () => {
  it("clears nullable text inputs when Backspace is pressed while the cell is focused", async () => {
    const { container, root } = mount(<DeleteResetHarness />);
    try {
      const input = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
      expect(input).not.toBeNull();
      expect(input!.value).toBe("Optional note");

      await act(async () => {
        input!.focus();
      });
      await dispatchDeleteOnElement(input!, "Backspace");

      await waitForCondition(() => {
        const liveInput = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
        expect(liveInput).not.toBeNull();
        expect(liveInput!.value).toBe("");
        expect(document.activeElement).toBe(liveInput);
      });
    } finally {
      unmount(root, container);
    }
  });

  it("resets zeroable numeric inputs to 0 when Delete is pressed while the cell is focused", async () => {
    const { container, root } = mount(<DeleteResetHarness />);
    try {
      const input = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="2"]');
      expect(input).not.toBeNull();
      expect(input!.value).toBe("42");

      await act(async () => {
        input!.focus();
      });
      await dispatchDeleteOnElement(input!, "Delete");

      await waitForCondition(() => {
        const liveInput = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="2"]');
        expect(liveInput).not.toBeNull();
        expect(liveInput!.value).toBe("0");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("unchecks checkbox cells when Backspace is pressed while the cell is focused", async () => {
    const { container, root } = mount(<DeleteResetHarness />);
    try {
      const checkbox = container.querySelector<HTMLElement>('button[role="checkbox"][data-row-id="row-a"][data-col="4"]');
      expect(checkbox).not.toBeNull();
      expect(checkbox?.getAttribute("aria-checked")).toBe("true");

      await act(async () => {
        checkbox!.focus();
      });
      await dispatchDeleteOnElement(checkbox!, "Backspace");

      await waitForCondition(() => {
        const liveCheckbox = container.querySelector<HTMLElement>('button[role="checkbox"][data-row-id="row-a"][data-col="4"]');
        expect(liveCheckbox).not.toBeNull();
        expect(liveCheckbox?.getAttribute("aria-checked")).toBe("false");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("resets selects with a null option when Delete is pressed on the trigger", async () => {
    const { container, root } = mount(<NullableGridSelectHarness />);
    try {
      const trigger = container.querySelector<HTMLElement>('[data-row-id="row-a"][data-col="0"]');
      expect(trigger).not.toBeNull();
      expect(trigger?.textContent).toContain("X");

      await act(async () => {
        trigger!.focus();
      });
      await dispatchDeleteOnElement(trigger!, "Delete");

      await waitForCondition(() => {
        const liveTrigger = container.querySelector<HTMLElement>('[data-row-id="row-a"][data-col="0"]');
        expect(liveTrigger).not.toBeNull();
        expect(liveTrigger?.textContent).toContain("None");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("ignores delete reset on controls that do not declare an allowed reset target", async () => {
    const { container, root } = mount(<DeleteResetHarness />);
    try {
      const requiredText = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="1"]');
      const protectedNumber = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="3"]');
      expect(requiredText).not.toBeNull();
      expect(protectedNumber).not.toBeNull();

      await act(async () => {
        requiredText!.focus();
      });
      await dispatchDeleteOnElement(requiredText!, "Backspace");

      await act(async () => {
        protectedNumber!.focus();
      });
      await dispatchDeleteOnElement(protectedNumber!, "Delete");

      await waitForCondition(() => {
        const liveRequiredText = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="1"]');
        const liveProtectedNumber = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="3"]');
        expect(liveRequiredText).not.toBeNull();
        expect(liveProtectedNumber).not.toBeNull();
        expect(liveRequiredText!.value).toBe("Required name");
        expect(liveProtectedNumber!.value).toBe("7");
      });
    } finally {
      unmount(root, container);
    }
  });
});

describe("DataGrid number formatting", () => {
  it("shows thousand separators when not editing and raw digits in editing mode", async () => {
    const { container, root } = mount(<NumberFormattingHarness />);
    try {
      const getLiveInput = () => container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
      const initialInput = getLiveInput();
      expect(initialInput).not.toBeNull();
      expect(initialInput!.getAttribute("data-grid-editing")).toBe("false");
      expect(initialInput!.type).toBe("text");
      expect(initialInput!.value).toBe("1,200");

      await startEditing(initialInput!);
      await waitForCondition(() => {
        const input = getLiveInput();
        expect(input).not.toBeNull();
        expect(input!.getAttribute("data-grid-editing")).toBe("true");
        expect(input!.type).toBe("number");
        expect(input!.value).toBe("1200");
      });

      const editingInput = getLiveInput();
      expect(editingInput).not.toBeNull();
      await dispatchInputChange(editingInput!, "12000");
      await act(async () => {
        getLiveInput()?.blur();
      });
      await waitForCondition(() => {
        const input = getLiveInput();
        expect(input).not.toBeNull();
        expect(input!.getAttribute("data-grid-editing")).toBe("false");
        expect(input!.type).toBe("text");
        expect(input!.value).toBe("12,000");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("shows years without thousand separators in both display and editing mode", async () => {
    const { container, root } = mount(<YearFormattingHarness />);
    try {
      const getLiveInput = () => container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
      const initialInput = getLiveInput();
      expect(initialInput).not.toBeNull();
      expect(initialInput!.getAttribute("data-grid-editing")).toBe("false");
      expect(initialInput!.type).toBe("text");
      expect(initialInput!.value).toBe("2024");

      await startEditing(initialInput!);
      await waitForCondition(() => {
        const input = getLiveInput();
        expect(input).not.toBeNull();
        expect(input!.getAttribute("data-grid-editing")).toBe("true");
        expect(input!.type).toBe("number");
        expect(input!.value).toBe("2024");
      });
    } finally {
      unmount(root, container);
    }
  });
});

describe("DataGrid async commit display", () => {
  it("keeps showing the committed value while async save is in progress", async () => {
    const { container, root } = mount(<AsyncTextCommitHarness />);
    try {
      const input = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
      expect(input).not.toBeNull();
      expect(input!.value).toBe("Initial note");

      await startEditing(input!);
      await dispatchInputChange(input!, "Updated note");
      await dispatchEnter(input!);

      await waitForCondition(() => {
        const liveInput = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
        expect(liveInput).not.toBeNull();
        expect(liveInput!.getAttribute("data-grid-editing")).toBe("false");
        expect(liveInput!.value).toBe("Updated note");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("does not flash back to the previous value during transient stale refreshes while save is pending", async () => {
    const { container, root } = mount(<AsyncTextCommitWithTransientStaleHarness />);
    try {
      const input = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
      expect(input).not.toBeNull();
      expect(input!.value).toBe("Initial note");

      await startEditing(input!);
      await dispatchInputChange(input!, "Updated note");
      await dispatchEnter(input!);

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 95));
      });

      const liveInput = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
      expect(liveInput).not.toBeNull();
      expect(liveInput!.value).toBe("Updated note");
    } finally {
      unmount(root, container);
    }
  });

  it("keeps focus on the committed cell after Enter so keyboard navigation can continue", async () => {
    const { container, root } = mount(<AsyncTextCommitHarness />);
    try {
      const input = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
      expect(input).not.toBeNull();

      await startEditing(input!);
      await dispatchInputChange(input!, "Focus preserved note");
      await dispatchEnter(input!);

      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("0");
      });

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 320));
      });

      await waitForCondition(() => {
        const active = document.activeElement as HTMLElement | null;
        expect(active?.getAttribute("data-row-id")).toBe("row-a");
        expect(active?.getAttribute("data-col")).toBe("0");
        const liveInput = container.querySelector<HTMLInputElement>('input[data-row-id="row-a"][data-col="0"]');
        expect(liveInput?.value).toBe("Focus preserved note");
      });
    } finally {
      unmount(root, container);
    }
  });

  it("updates checkbox state immediately while async save is pending", async () => {
    const { container, root } = mount(<AsyncCheckboxCommitHarness />);
    try {
      const getLiveCheckbox = () => container.querySelector<HTMLElement>('button[role="checkbox"][data-row-id="row-a"][data-col="0"]');
      const checkbox = getLiveCheckbox();
      expect(checkbox).not.toBeNull();
      expect(checkbox?.getAttribute("aria-checked")).toBe("false");

      await act(async () => {
        checkbox!.focus();
      });
      await dispatchEnterOnElement(checkbox!);

      await waitForCondition(() => {
        const liveCheckbox = getLiveCheckbox();
        expect(liveCheckbox).not.toBeNull();
        expect(liveCheckbox?.getAttribute("aria-checked")).toBe("true");
      });

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      });

      const pendingCheckbox = getLiveCheckbox();
      expect(pendingCheckbox).not.toBeNull();
      expect(pendingCheckbox?.getAttribute("aria-checked")).toBe("true");
    } finally {
      unmount(root, container);
    }
  });
});

describe("DataGrid edit caret placement", () => {
  it("keeps caret at the start when keyboard focus moves into a non-editing input", async () => {
    const { container, root } = mount(<SortableGridHarness initialSorting={[{ id: "name", desc: false }]} />);
    try {
      const nameInput = findInputByValue(container, "Alpha");
      const noteInput = findInputByValue(container, "Apple");
      expect(nameInput).not.toBeNull();
      expect(noteInput).not.toBeNull();

      await act(async () => {
        const end = noteInput!.value.length;
        noteInput!.setSelectionRange(end, end);
        nameInput!.focus();
      });

      await dispatchTab(nameInput!);

      await waitForCondition(() => {
        expect(document.activeElement).toBe(noteInput);
        expect(noteInput!.getAttribute("data-grid-editing")).toBe("false");
        expect(noteInput!.selectionStart).toBe(0);
        expect(noteInput!.selectionEnd).toBe(0);
      });
    } finally {
      unmount(root, container);
    }
  });

  it("places caret at the end when entering edit mode via Enter", async () => {
    const { container, root } = mount(<SortableGridHarness initialSorting={[{ id: "name", desc: false }]} />);
    try {
      const input = findInputByValue(container, "Alpha");
      expect(input).not.toBeNull();

      await act(async () => {
        input!.focus();
      });
      await dispatchEnter(input!);

      await waitForCondition(() => {
        expect(input!.getAttribute("data-grid-editing")).toBe("true");
      });
      await waitForCondition(() => {
        const end = input!.value.length;
        expect(input!.selectionStart).toBe(end);
        expect(input!.selectionEnd).toBe(end);
      });
    } finally {
      unmount(root, container);
    }
  });
});
