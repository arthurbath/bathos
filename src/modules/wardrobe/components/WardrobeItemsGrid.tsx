import { useCallback, useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type Row, type SortingState, useReactTable } from '@tanstack/react-table';
import { Copy, Filter, FilterX, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataGrid, GridEditableCell, GridSelectValue, GridUrlCell, gridMenuTriggerProps, gridSelectTriggerProps, useDataGrid, validateHttpUrl } from '@/components/ui/data-grid';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { useDataGridHistory } from '@/components/ui/data-grid-history';
import { GRID_FIXED_COLUMNS, WARDROBE_ITEMS_GRID_DEFAULT_WIDTHS } from '@/lib/gridColumnWidths';
import {
  WARDROBE_CATEGORY_OPTIONS,
  WARDROBE_EMPTY_CATEGORY_LABEL,
  WARDROBE_EMPTY_STATUS_LABEL,
  WARDROBE_STATUS_OPTIONS,
  getWardrobeCategoryLabel,
  getWardrobeStatusColor,
  getWardrobeStatusLabel,
} from '@/modules/wardrobe/lib/wardrobeOptions';
import type { WardrobeCategory, WardrobeItem, WardrobeItemInput, WardrobeItemUpdate, WardrobeStatus } from '@/modules/wardrobe/types/wardrobe';

type GroupByOption = 'none' | 'category' | 'brand' | 'status';
type StatusFilterValue = WardrobeStatus | '__none__';

interface WardrobeItemsGridProps {
  userId: string;
  items: WardrobeItem[];
  loading: boolean;
  onAddItem: (input: WardrobeItemInput, id?: string) => Promise<WardrobeItem>;
  onUpdateItem: (id: string, updates: WardrobeItemUpdate) => Promise<WardrobeItem>;
  onDeleteItem: (id: string) => Promise<void>;
  fullView?: boolean;
  fullViewTopBorder?: boolean;
}

const columnHelper = createColumnHelper<WardrobeItem>();
const WARDROBE_ITEMS_HISTORY_KEY = 'wardrobe_items';
const EMPTY_CATEGORY_SELECT_VALUE = '__none__';
const EMPTY_STATUS_SELECT_VALUE = '__none__';
const WARDROBE_ACTIONS_NAV_COL = 9;
const STATUS_FILTER_STORAGE_KEY = 'wardrobe_items_statusFilter';
const ALL_STATUS_FILTER_VALUES: StatusFilterValue[] = [
  ...WARDROBE_STATUS_OPTIONS.map((option) => option.value),
  EMPTY_STATUS_SELECT_VALUE,
];
const STATUS_FILTER_OPTIONS = [
  ...WARDROBE_STATUS_OPTIONS,
  { value: EMPTY_STATUS_SELECT_VALUE, label: 'No Status', color: null },
];
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus:ring-ring/65 focus-visible:ring-offset-0';

function normalizeNameFilterValue(value: string) {
  return value.trim().toLocaleLowerCase();
}

function matchesNameFilter(name: string | null, filterValue: string) {
  const normalizedFilter = normalizeNameFilterValue(filterValue);
  return normalizedFilter.length === 0 || (name ?? '').toLocaleLowerCase().includes(normalizedFilter);
}

function DropdownOptionColorSwatch({ color }: { color?: string | null }) {
  if (!color) return null;

  return (
    <span
      aria-hidden="true"
      className="h-3 w-3 rounded-sm border border-white/20"
      style={{ backgroundColor: color }}
    />
  );
}

function parseStatusFilter(raw: string | null): StatusFilterValue[] {
  if (!raw) return ALL_STATUS_FILTER_VALUES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ALL_STATUS_FILTER_VALUES;
    const allowed = new Set(ALL_STATUS_FILTER_VALUES);
    const values = parsed.filter((value): value is StatusFilterValue => typeof value === 'string' && allowed.has(value as StatusFilterValue));
    return values.length === 0 && parsed.length > 0 ? ALL_STATUS_FILTER_VALUES : values;
  } catch {
    return ALL_STATUS_FILTER_VALUES;
  }
}

function createEmptyDraft(): WardrobeItemInput {
  return {
    name: null,
    category: null,
    brand: null,
    model: null,
    color: null,
    size: null,
    link_url: null,
    status: null,
    notes: null,
  };
}

function normalizeDraftValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toWardrobeItemInput(item: WardrobeItem): WardrobeItemInput {
  return {
    name: item.name,
    category: item.category,
    brand: item.brand,
    model: item.model,
    color: item.color,
    size: item.size,
    link_url: item.link_url,
    status: item.status,
    notes: item.notes,
  };
}

function CategoryCell({
  value,
  onChange,
}: {
  value: WardrobeCategory | null;
  onChange: (next: WardrobeCategory | null) => void | Promise<unknown>;
}) {
  const ctx = useDataGrid();
  return (
    <Select value={value ?? EMPTY_CATEGORY_SELECT_VALUE} onValueChange={(next) => {
      const nextValue = next === EMPTY_CATEGORY_SELECT_VALUE ? null : next as WardrobeCategory;
      const historyEntryId = ctx?.registerCellHistoryEntry({
        col: 1,
        undo: () => onChange(value),
        redo: () => onChange(nextValue),
      });
      ctx?.onCellCommit(1);
      const maybePendingChange = onChange(nextValue);
      if (maybePendingChange && typeof maybePendingChange === 'object' && 'catch' in maybePendingChange && typeof maybePendingChange.catch === 'function') {
        void maybePendingChange.catch(() => ctx?.invalidateCellHistoryEntry(historyEntryId));
      }
    }}>
      <SelectTrigger
        className={`h-7 border-transparent bg-transparent px-1 hover:border-[hsl(var(--grid-sticky-line))] text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 ${GRID_CONTROL_FOCUS_CLASS}`}
        {...gridSelectTriggerProps(ctx, 1, {
          onDeleteReset: value === null ? undefined : () => onChange(null),
        })}
      >
        <GridSelectValue placeholder={WARDROBE_EMPTY_CATEGORY_LABEL} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_CATEGORY_SELECT_VALUE}>{WARDROBE_EMPTY_CATEGORY_LABEL}</SelectItem>
        {WARDROBE_CATEGORY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusCell({
  value,
  onChange,
}: {
  value: WardrobeStatus | null;
  onChange: (next: WardrobeStatus | null) => void | Promise<unknown>;
}) {
  const ctx = useDataGrid();
  const statusColor = getWardrobeStatusColor(value);
  return (
    <Select value={value ?? EMPTY_STATUS_SELECT_VALUE} onValueChange={(next) => {
      const nextValue = next === EMPTY_STATUS_SELECT_VALUE ? null : next as WardrobeStatus;
      const historyEntryId = ctx?.registerCellHistoryEntry({
        col: 7,
        undo: () => onChange(value),
        redo: () => onChange(nextValue),
      });
      ctx?.onCellCommit(7);
      const maybePendingChange = onChange(nextValue);
      if (maybePendingChange && typeof maybePendingChange === 'object' && 'catch' in maybePendingChange && typeof maybePendingChange.catch === 'function') {
        void maybePendingChange.catch(() => ctx?.invalidateCellHistoryEntry(historyEntryId));
      }
    }}>
      <SelectTrigger
        className={`h-7 border-transparent bg-transparent px-1 hover:border-[hsl(var(--grid-sticky-line))] text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 ${GRID_CONTROL_FOCUS_CLASS}`}
        style={{ backgroundColor: statusColor || 'transparent' }}
        {...gridSelectTriggerProps(ctx, 7, {
          onDeleteReset: value === null ? undefined : () => onChange(null),
        })}
      >
        <GridSelectValue placeholder={WARDROBE_EMPTY_STATUS_LABEL} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_STATUS_SELECT_VALUE}>{WARDROBE_EMPTY_STATUS_LABEL}</SelectItem>
        {WARDROBE_STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value} rightAdornment={<DropdownOptionColorSwatch color={option.color} />}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function WardrobeActionsCell({
  item,
  onDuplicate,
  onDelete,
}: {
  item: WardrobeItem;
  onDuplicate: (item: WardrobeItem) => void;
  onDelete: (itemId: string) => void;
}) {
  const ctx = useDataGrid();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const itemLabel = item.name || item.model || item.brand || 'this item';

  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`float-right mr-[5px] h-7 w-7 ${GRID_CONTROL_FOCUS_CLASS}`}
            aria-label={`Actions for ${itemLabel}`}
            {...gridMenuTriggerProps(ctx, WARDROBE_ACTIONS_NAV_COL)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          <DropdownMenuItem onClick={() => onDuplicate(item)}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent className="rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Wardrobe Item</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogBody>
          <AlertDialogDescription>
            Delete &ldquo;{itemLabel}&rdquo; from Wardrobe?
          </AlertDialogDescription>
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onDelete(item.id)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function WardrobeItemsGrid({
  userId,
  items,
  loading,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  fullView = false,
  fullViewTopBorder = true,
}: WardrobeItemsGridProps) {
  const dataGridHistory = useDataGridHistory();
  const isMobile = useIsMobile();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowActionBusy, setRowActionBusy] = useState(false);
  const [draft, setDraft] = useState<WardrobeItemInput>(() => createEmptyDraft());
  const [nameFilter, setNameFilter] = useState(() => localStorage.getItem('wardrobe_items_nameFilter') ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue[]>(() => parseStatusFilter(localStorage.getItem(STATUS_FILTER_STORAGE_KEY)));
  const [groupBy, setGroupBy] = useState<GroupByOption>(() => (localStorage.getItem('wardrobe_items_groupBy') as GroupByOption) || 'none');
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
  const [draftNameFilter, setDraftNameFilter] = useState('');
  const [draftStatusFilter, setDraftStatusFilter] = useState<StatusFilterValue[]>(ALL_STATUS_FILTER_VALUES);
  const [draftGroupBy, setDraftGroupBy] = useState<GroupByOption>('none');
  const [sorting, setSorting] = useState<SortingState>(() => {
    try {
      const raw = localStorage.getItem('wardrobe_items_sorting');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => { localStorage.setItem('wardrobe_items_nameFilter', nameFilter); }, [nameFilter]);
  useEffect(() => { localStorage.setItem(STATUS_FILTER_STORAGE_KEY, JSON.stringify(statusFilter)); }, [statusFilter]);
  useEffect(() => { localStorage.setItem('wardrobe_items_groupBy', groupBy); }, [groupBy]);
  useEffect(() => { localStorage.setItem('wardrobe_items_sorting', JSON.stringify(sorting)); }, [sorting]);
  useEffect(() => {
    if (!addOpen) setDraft(createEmptyDraft());
  }, [addOpen]);

  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'wardrobe_items',
    defaults: WARDROBE_ITEMS_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.wardrobe_items,
  });

  const statusFilterSet = useMemo(() => new Set(statusFilter), [statusFilter]);
  const hasNameFilter = normalizeNameFilterValue(nameFilter).length > 0;
  const hasStatusFilter = statusFilter.length !== ALL_STATUS_FILTER_VALUES.length;
  const hasActiveViewControls = hasNameFilter || hasStatusFilter || groupBy !== 'none';

  const isVisibleWithCurrentFilters = useCallback((item: Pick<WardrobeItem, 'name' | 'status'>) => {
    if (!matchesNameFilter(item.name, nameFilter)) return false;
    return statusFilterSet.has(item.status ?? EMPTY_STATUS_SELECT_VALUE);
  }, [nameFilter, statusFilterSet]);

  const filteredItems = useMemo(
    () => items.filter((item) => isVisibleWithCurrentFilters(item)),
    [isVisibleWithCurrentFilters, items],
  );

  const updateItemAndNotifyIfHidden = useCallback(async (id: string, updates: WardrobeItemUpdate) => {
    const currentItem = items.find((item) => item.id === id);
    const nextItem = currentItem ? { ...currentItem, ...updates } : null;
    const shouldNotifyHiddenByFilters = Boolean(
      currentItem
      && nextItem
      && isVisibleWithCurrentFilters(currentItem)
      && !isVisibleWithCurrentFilters(nextItem),
    );

    const updated = await onUpdateItem(id, updates);
    if (shouldNotifyHiddenByFilters) {
      toast({
        title: 'Wardrobe item updated but hidden by filters',
        description: 'The item was updated, and it is no longer visible because of the current filters.',
      });
    }
    return updated;
  }, [isVisibleWithCurrentFilters, items, onUpdateItem]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        size: 180,
        minSize: 100,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.name ?? ''}
            onChange={(value) => updateItemAndNotifyIfHidden(row.original.id, { name: value })}
            navCol={0}
            deleteResetValue=""
          />
        ),
      }),
      columnHelper.accessor('category', {
        header: 'Category',
        size: 140,
        minSize: 110,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <CategoryCell
            value={row.original.category}
            onChange={(value) => updateItemAndNotifyIfHidden(row.original.id, { category: value })}
          />
        ),
      }),
      columnHelper.accessor('brand', {
        header: 'Brand',
        size: 160,
        minSize: 100,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.brand ?? ''}
            onChange={(value) => updateItemAndNotifyIfHidden(row.original.id, { brand: value })}
            navCol={2}
            deleteResetValue=""
          />
        ),
      }),
      columnHelper.accessor('model', {
        header: 'Model',
        size: 260,
        minSize: 140,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.model ?? ''}
            onChange={(value) => updateItemAndNotifyIfHidden(row.original.id, { model: value })}
            navCol={3}
            deleteResetValue=""
          />
        ),
      }),
      columnHelper.accessor('color', {
        header: 'Color',
        size: 140,
        minSize: 90,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.color ?? ''}
            onChange={(value) => updateItemAndNotifyIfHidden(row.original.id, { color: value })}
            navCol={4}
            deleteResetValue=""
          />
        ),
      }),
      columnHelper.accessor('size', {
        header: 'Size',
        size: 110,
        minSize: 80,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.size ?? ''}
            onChange={(value) => updateItemAndNotifyIfHidden(row.original.id, { size: value })}
            navCol={5}
            deleteResetValue=""
          />
        ),
      }),
      columnHelper.accessor('link_url', {
        header: 'Link',
        size: 150,
        minSize: 120,
        meta: { containsEditableInput: true, containsButton: true },
        cell: ({ row }) => (
          <GridUrlCell
            value={row.original.link_url ?? ''}
            onChange={(value) => updateItemAndNotifyIfHidden(row.original.id, { link_url: value })}
            navCol={6}
            onInvalidUrl={(message) => toast({ title: 'Invalid URL', description: message, variant: 'destructive' })}
          />
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: 180,
        minSize: 130,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <StatusCell
            value={row.original.status}
            onChange={(value) => updateItemAndNotifyIfHidden(row.original.id, { status: value })}
          />
        ),
      }),
      columnHelper.accessor('notes', {
        header: 'Notes',
        size: 260,
        minSize: 140,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.notes ?? ''}
            onChange={(value) => updateItemAndNotifyIfHidden(row.original.id, { notes: value })}
            navCol={8}
            deleteResetValue=""
          />
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        enableResizing: false,
        size: 40,
        minSize: 40,
        maxSize: 40,
        meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
        cell: ({ row }) => (
          <WardrobeActionsCell
            item={row.original}
            onDuplicate={(item) => {
              const itemId = crypto.randomUUID();
              const payload = toWardrobeItemInput(item);
              setRowActionBusy(true);
              dataGridHistory?.recordHistoryEntry({
                undo: () => onDeleteItem(itemId),
                redo: () => onAddItem(payload, itemId),
                undoFocusTarget: null,
                redoFocusTarget: {
                  gridId: WARDROBE_ITEMS_HISTORY_KEY,
                  rowId: itemId,
                  col: 0,
                },
              });
              void onAddItem(payload, itemId).finally(() => setRowActionBusy(false));
            }}
            onDelete={(itemId) => {
              const item = row.original;
              setRowActionBusy(true);
              dataGridHistory?.recordHistoryEntry({
                undo: () => onAddItem(toWardrobeItemInput(item), item.id),
                redo: () => onDeleteItem(itemId),
                undoFocusTarget: {
                  gridId: WARDROBE_ITEMS_HISTORY_KEY,
                  rowId: item.id,
                  col: 0,
                },
                redoFocusTarget: null,
              });
              void onDeleteItem(itemId).finally(() => setRowActionBusy(false));
            }}
          />
        ),
      }),
    ],
    [dataGridHistory, onAddItem, onDeleteItem, updateItemAndNotifyIfHidden],
  );

  const table = useReactTable({
    data: filteredItems,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnSizing, columnSizingInfo },
    onSortingChange: setSorting,
    onColumnSizingChange,
    onColumnSizingInfoChange,
    enableColumnResizing: columnResizingEnabled,
    columnResizeMode: 'onChange',
  });

  const getGroupKey = useMemo(() => {
    if (groupBy === 'none') return undefined;
    return (item: WardrobeItem): string => {
      if (groupBy === 'category') return item.category ?? '_none';
      if (groupBy === 'brand') return item.brand?.trim() || '_none';
      if (groupBy === 'status') return item.status ?? '_none';
      return '_none';
    };
  }, [groupBy]);

  const getGroupLabel = useCallback((key: string) => {
    if (groupBy === 'category') return key === '_none' ? 'No Category' : getWardrobeCategoryLabel(key as WardrobeCategory);
    if (groupBy === 'brand') return key === '_none' ? 'No Brand' : key;
    if (groupBy === 'status') return key === '_none' ? 'No Status' : getWardrobeStatusLabel(key as WardrobeStatus);
    return key;
  }, [groupBy]);

  const groupOrder = useCallback((left: string, right: string) =>
    getGroupLabel(left).localeCompare(getGroupLabel(right), undefined, { sensitivity: 'base', numeric: true }),
  [getGroupLabel]);

  const renderGroupHeader = (key: string, groupRows: Row<WardrobeItem>[]) => {
    const groupRowBgClass = 'bg-[hsl(var(--category-group-row-bg))]';
    const groupRowTextClass = 'text-white';
    return (
      <tr key={`gh-${key}`} className={`${groupRowBgClass} ${groupRowTextClass} border-b-0 ${fullView ? 'sticky top-[36px] z-30' : ''}`}>
        <td className={`${groupRowBgClass} h-7 align-middle px-2 text-xs font-medium sticky left-0 z-30 relative shadow-[inset_0_1px_0_0_hsl(var(--category-group-row-bg)),inset_0_-1px_0_0_hsl(var(--category-group-row-bg))] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-[hsl(var(--grid-sticky-line))]`}>
          {getGroupLabel(key)} ({groupRows.length})
        </td>
        <td colSpan={8} className={`${groupRowBgClass} h-7 shadow-[inset_0_1px_0_0_hsl(var(--category-group-row-bg)),inset_0_-1px_0_0_hsl(var(--category-group-row-bg))]`} />
        <td className={`${groupRowBgClass} h-7 sticky right-0 z-30 relative after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-[hsl(var(--grid-sticky-line))]`} />
      </tr>
    );
  };

  const openViewControlsModal = () => {
    setDraftNameFilter(nameFilter);
    setDraftStatusFilter(statusFilter);
    setDraftGroupBy(groupBy);
    setViewControlsOpen(true);
  };

  const applyViewControls = () => {
    setNameFilter(draftNameFilter);
    setStatusFilter(draftStatusFilter);
    setGroupBy(draftGroupBy);
    setViewControlsOpen(false);
  };

  const clearViewControls = () => {
    setNameFilter('');
    setDraftNameFilter('');
    setStatusFilter(ALL_STATUS_FILTER_VALUES);
    setDraftStatusFilter(ALL_STATUS_FILTER_VALUES);
    setGroupBy('none');
    setDraftGroupBy('none');
  };

  const handleSaveDraft = async () => {
    if (saving) return;
    const linkUrl = normalizeDraftValue(draft.link_url ?? '');
    const linkError = linkUrl ? validateHttpUrl(linkUrl) : null;
    if (linkError) {
      toast({ title: 'Invalid URL', description: linkError, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const itemId = crypto.randomUUID();
      const payload = {
        ...draft,
        name: normalizeDraftValue(draft.name ?? ''),
        brand: normalizeDraftValue(draft.brand ?? ''),
        model: normalizeDraftValue(draft.model ?? ''),
        color: normalizeDraftValue(draft.color ?? ''),
        size: normalizeDraftValue(draft.size ?? ''),
        link_url: linkUrl,
        notes: normalizeDraftValue(draft.notes ?? ''),
      };
      dataGridHistory?.recordHistoryEntry({
        undo: () => onDeleteItem(itemId),
        redo: () => onAddItem(payload, itemId),
        undoFocusTarget: null,
        redoFocusTarget: {
          gridId: WARDROBE_ITEMS_HISTORY_KEY,
          rowId: itemId,
          col: 0,
        },
      });
      await onAddItem(payload, itemId);
      setAddOpen(false);
      if (!isVisibleWithCurrentFilters({ ...payload, status: payload.status ?? null })) {
        toast({
          title: 'Wardrobe item added but hidden by filters',
          description: 'The item was added, but it is not visible because of the current filters.',
        });
      }
    } catch (error) {
      toast({
        title: 'Failed to Add Wardrobe Item',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const emptyMessage = loading ? 'Loading wardrobe items…' : items.length === 0 ? 'No wardrobe items yet.' : 'No wardrobe items match the filter';
  const gridCardContentClassName = fullView ? 'px-0 pb-0 flex-1 min-h-0' : 'space-y-3 px-0';
  const fullViewCardClassName = fullView
    ? `h-full min-h-0 flex flex-col border-t-0 border-b-0 ${fullViewTopBorder ? 'md:border-t' : 'md:border-t-0'}`
    : '';

  return (
    <Card className={`max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0 ${fullViewCardClassName}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Items</CardTitle>
        <div className="ml-auto flex items-center gap-2">
          {isMobile ? (
            <>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={openViewControlsModal}>
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              {hasActiveViewControls && (
                <Button
                  type="button"
                  variant="outline-warning"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={clearViewControls}
                  aria-label="Clear filters and groupings"
                >
                  <FilterX className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <>
              <Input
                name="wardrobe-items-filter-query"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="Item Name"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="h-8 w-36"
                aria-label="Name"
              />
              <MultiSelectFilter
                label="Statuses"
                options={STATUS_FILTER_OPTIONS}
                selectedValues={statusFilter}
                onSelectedValuesChange={(values) => setStatusFilter(values as StatusFilterValue[])}
                allLabel="All Statuses"
                noneLabel="No Statuses"
                triggerClassName="w-44"
              />
              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupByOption)}>
                <SelectTrigger className="h-8 w-44"><GridSelectValue placeholder="Group By…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="category">Group by Category</SelectItem>
                  <SelectItem value="brand">Group by Brand</SelectItem>
                  <SelectItem value="status">Group by Status</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline-warning"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={clearViewControls}
                aria-label="Clear filters and groupings"
                disabled={!hasActiveViewControls}
              >
                <FilterX className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline-success"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Add wardrobe item"
            onClick={() => setAddOpen(true)}
            disabled={loading || rowActionBusy}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className={gridCardContentClassName}>
        <DataGrid
          table={table}
          historyKey={WARDROBE_ITEMS_HISTORY_KEY}
          fullView={fullView}
          maxHeight={fullView ? 'none' : undefined}
          className={fullView ? 'h-full min-h-0' : undefined}
          emptyMessage={emptyMessage}
          groupBy={getGroupKey}
          renderGroupHeader={groupBy === 'none' ? undefined : renderGroupHeader}
          groupOrder={groupBy === 'none' ? undefined : groupOrder}
        />
      </CardContent>

      <Dialog open={viewControlsOpen} onOpenChange={setViewControlsOpen}>
        <DialogContent aria-describedby={undefined} className="w-screen max-w-none rounded-none sm:w-full sm:max-w-sm sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Filters & View Settings</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wardrobe-items-filter-query">Name</Label>
              <Input
                id="wardrobe-items-filter-query"
                name="wardrobe-items-filter-query-modal"
                value={draftNameFilter}
                onChange={(event) => setDraftNameFilter(event.target.value)}
                placeholder="Item Name"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <MultiSelectFilter
                label="Statuses"
                options={STATUS_FILTER_OPTIONS}
                selectedValues={draftStatusFilter}
                onSelectedValuesChange={(values) => setDraftStatusFilter(values as StatusFilterValue[])}
                allLabel="All Statuses"
                noneLabel="No Statuses"
                triggerClassName="h-9 w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Group By</Label>
              <Select value={draftGroupBy} onValueChange={(value) => setDraftGroupBy(value as GroupByOption)}>
                <SelectTrigger className="h-9"><GridSelectValue placeholder="Group By…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="category">Group by Category</SelectItem>
                  <SelectItem value="brand">Group by Brand</SelectItem>
                  <SelectItem value="status">Group by Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewControlsOpen(false)}>
              Cancel
            </Button>
            <Button data-dialog-confirm="true" type="button" onClick={applyViewControls}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={(open) => !saving && setAddOpen(open)}>
        <DialogContent aria-describedby={undefined} className="max-w-lg rounded-lg">
          <DialogHeader>
            <DialogTitle>Add Wardrobe Item</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wardrobe-item-name">Name</Label>
                <Input id="wardrobe-item-name" value={draft.name ?? ''} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={draft.category ?? EMPTY_CATEGORY_SELECT_VALUE} onValueChange={(value) => setDraft((current) => ({ ...current, category: value === EMPTY_CATEGORY_SELECT_VALUE ? null : value as WardrobeCategory }))}>
                  <SelectTrigger><GridSelectValue placeholder={WARDROBE_EMPTY_CATEGORY_LABEL} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_CATEGORY_SELECT_VALUE}>{WARDROBE_EMPTY_CATEGORY_LABEL}</SelectItem>
                    {WARDROBE_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wardrobe-item-brand">Brand</Label>
                <Input id="wardrobe-item-brand" value={draft.brand ?? ''} onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wardrobe-item-model">Model</Label>
                <Input id="wardrobe-item-model" value={draft.model ?? ''} onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wardrobe-item-color">Color</Label>
                <Input id="wardrobe-item-color" value={draft.color ?? ''} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wardrobe-item-size">Size</Label>
                <Input id="wardrobe-item-size" value={draft.size ?? ''} onChange={(event) => setDraft((current) => ({ ...current, size: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wardrobe-item-link">Link</Label>
              <Input id="wardrobe-item-link" type="url" value={draft.link_url ?? ''} onChange={(event) => setDraft((current) => ({ ...current, link_url: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={draft.status ?? EMPTY_STATUS_SELECT_VALUE} onValueChange={(value) => setDraft((current) => ({ ...current, status: value === EMPTY_STATUS_SELECT_VALUE ? null : value as WardrobeStatus }))}>
                <SelectTrigger style={{ backgroundColor: getWardrobeStatusColor(draft.status) || 'transparent' }}>
                  <GridSelectValue placeholder={WARDROBE_EMPTY_STATUS_LABEL} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_STATUS_SELECT_VALUE}>{WARDROBE_EMPTY_STATUS_LABEL}</SelectItem>
                  {WARDROBE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} rightAdornment={<DropdownOptionColorSwatch color={option.color} />}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wardrobe-item-notes">Notes</Label>
              <Input id="wardrobe-item-notes" value={draft.notes ?? ''} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button data-dialog-confirm="true" type="button" onClick={() => { void handleSaveDraft(); }} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
