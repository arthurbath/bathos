import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type Row, type SortingState, useReactTable } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataGrid, GridCheckboxCell, GridEditableCell, GridSelectValue, gridMenuTriggerProps, gridSelectTriggerProps, useDataGrid } from '@/components/ui/data-grid';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Ban, CheckCheck, Download, FileSpreadsheet, Filter, FilterX, MoreHorizontal, Plus, SkipForward, Trash2, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { useDataGridHistory } from '@/components/ui/data-grid-history';
import { GARAGE_SERVICES_GRID_DEFAULT_WIDTHS, GRID_FIXED_COLUMNS } from '@/lib/gridColumnWidths';
import type { GarageService, GarageServiceStatus, GarageServiceType, GarageServicingWithRelations } from '@/modules/garage/types/garage';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  buildGarageServiceImportPreview,
  buildGarageServiceTemplateCsv,
  type GarageServiceImportPreview,
} from '@/modules/garage/lib/serviceImport';
import { validateGarageServiceName } from '@/modules/garage/lib/serviceNames';
import {
  GARAGE_EMPTY_SERVICE_TYPE_LABEL,
  GARAGE_SERVICE_TYPE_OPTIONS,
  getGarageServiceTypeLabel,
} from '@/modules/garage/lib/serviceTypes';

const columnHelper = createColumnHelper<GarageService>();
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';
const SERVICE_ACTIONS_NAV_COL = 7;
const GARAGE_SERVICES_HISTORY_KEY = 'garage_services';
const EMPTY_SERVICE_TYPE_SELECT_VALUE = '__none__';
type GroupByOption = 'none' | 'type';
type CadenceFilterOption = 'all' | 'recurring' | 'one_off';

function normalizeNameFilterValue(value: string) {
  return value.trim().toLocaleLowerCase();
}

function matchesNameFilter(name: string, filterValue: string) {
  const normalizedFilter = normalizeNameFilterValue(filterValue);
  return normalizedFilter.length === 0 || name.toLocaleLowerCase().includes(normalizedFilter);
}

function normalizePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function formatMileageInThousands(value: number): string {
  return `${Math.round(value / 1000)}k`;
}

function isCsvFile(file: File) {
  const normalizedFileName = file.name.toLowerCase();
  return (
    normalizedFileName.endsWith('.csv')
    || file.type === 'text/csv'
    || file.type === 'application/vnd.ms-excel'
  );
}

function ServiceTypeCell({
  value,
  onChange,
}: {
  value: GarageServiceType | null;
  onChange: (next: GarageServiceType | null) => void | Promise<unknown>;
}) {
  const ctx = useDataGrid();
  const selectedValue = value ?? EMPTY_SERVICE_TYPE_SELECT_VALUE;

  return (
    <Select value={selectedValue} onValueChange={(next) => {
      const nextValue = next === EMPTY_SERVICE_TYPE_SELECT_VALUE ? null : next as GarageServiceType;
      const historyEntryId = ctx?.registerCellHistoryEntry({
        col: 1,
        undo: () => onChange(value),
        redo: () => onChange(nextValue),
      });
      ctx?.onCellCommit(1);
      const maybePendingChange = onChange(nextValue);
      if (maybePendingChange && typeof maybePendingChange === 'object' && 'catch' in maybePendingChange && typeof maybePendingChange.catch === 'function') {
        void maybePendingChange.catch(() => {
          ctx?.invalidateCellHistoryEntry(historyEntryId);
        });
      }
    }}>
      <SelectTrigger
        className={`h-7 border-transparent bg-transparent px-1 hover:border-[hsl(var(--grid-sticky-line))] text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 ${GRID_CONTROL_FOCUS_CLASS}`}
        {...gridSelectTriggerProps(ctx, 1, {
          onDeleteReset: value === null ? undefined : () => onChange(null),
        })}
      >
        <GridSelectValue placeholder={GARAGE_EMPTY_SERVICE_TYPE_LABEL} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_SERVICE_TYPE_SELECT_VALUE}>{GARAGE_EMPTY_SERVICE_TYPE_LABEL}</SelectItem>
        {GARAGE_SERVICE_TYPE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MonitoringCell({
  value,
  onChange,
  navCol,
}: {
  value: boolean;
  onChange: (next: boolean) => void | Promise<unknown>;
  navCol: number;
}) {
  return (
    <GridCheckboxCell
      checked={value}
      onChange={onChange}
      navCol={navCol}
      deleteResetChecked={false}
      className="ml-1"
    />
  );
}

function ServiceActionsCell({
  service,
  onDelete,
}: {
  service: GarageService;
  onDelete: (serviceId: string) => void;
}) {
  const ctx = useDataGrid();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`float-right mr-[5px] h-7 w-7 ${GRID_CONTROL_FOCUS_CLASS}`}
            aria-label={`Actions for ${service.name}`}
            {...gridMenuTriggerProps(ctx, SERVICE_ACTIONS_NAV_COL)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent className="rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete service</AlertDialogTitle>
          <AlertDialogDescription>
            Delete &ldquo;{service.name}&rdquo; from this vehicle schedule?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onDelete(service.id)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface GarageServicesGridProps {
  userId: string;
  services: GarageService[];
  servicings: GarageServicingWithRelations[];
  loading: boolean;
  vehicleName: string;
  fullView?: boolean;
  onAddService: (input: {
    id?: string;
    name: string;
    type?: GarageServiceType | null;
    every_miles?: number | null;
    every_months?: number | null;
    monitoring?: boolean;
    notes?: string | null;
    sort_order?: number;
  }) => Promise<GarageService>;
  onUpdateService: (id: string, updates: Partial<Omit<GarageService, 'id' | 'user_id' | 'vehicle_id' | 'created_at'>>) => Promise<void>;
  onImportServices: (rows: GarageServiceImportPreview['rowsToImport']) => Promise<void>;
  onDeleteService: (id: string) => Promise<void>;
}

export function GarageServicesGrid({
  userId,
  services,
  servicings,
  loading,
  vehicleName,
  fullView = false,
  onAddService,
  onUpdateService,
  onImportServices,
  onDeleteService,
}: GarageServicesGridProps) {
  const dataGridHistory = useDataGridHistory();
  const isMobile = useIsMobile();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState<GarageServiceType | null>(null);
  const [addMiles, setAddMiles] = useState('');
  const [addMonths, setAddMonths] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importValidationBusy, setImportValidationBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<GarageServiceImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [invalidNameWarning, setInvalidNameWarning] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [nameFilter, setNameFilter] = useState(() => localStorage.getItem('garage_services_nameFilter') ?? '');
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilterOption>(() => (localStorage.getItem('garage_services_cadenceFilter') as CadenceFilterOption) || 'all');
  const [groupBy, setGroupBy] = useState<GroupByOption>(() => (localStorage.getItem('garage_services_groupBy') as GroupByOption) || 'none');
  const [draftNameFilter, setDraftNameFilter] = useState(nameFilter);
  const [draftCadenceFilter, setDraftCadenceFilter] = useState<CadenceFilterOption>(cadenceFilter);
  const [draftGroupBy, setDraftGroupBy] = useState<GroupByOption>(groupBy);
  const hasActiveViewControls = normalizeNameFilterValue(nameFilter).length > 0 || groupBy !== 'none' || cadenceFilter !== 'all';

  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'garage_services',
    defaults: GARAGE_SERVICES_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.garage_services,
  });

  useEffect(() => {
    if (!addOpen) {
      setAddName('');
      setAddType(null);
      setAddMiles('');
      setAddMonths('');
      setAddNotes('');
    }
  }, [addOpen]);
  useEffect(() => {
    localStorage.setItem('garage_services_groupBy', groupBy);
  }, [groupBy]);
  useEffect(() => {
    localStorage.setItem('garage_services_nameFilter', nameFilter);
  }, [nameFilter]);
  useEffect(() => {
    localStorage.setItem('garage_services_cadenceFilter', cadenceFilter);
  }, [cadenceFilter]);

  const getTypeLabel = (value: GarageServiceType | null) => getGarageServiceTypeLabel(value);

  const getGroupKey = (service: GarageService) => {
    if (groupBy === 'type') return getTypeLabel(service.type);
    return '';
  };

  const groupOrder = (a: string, b: string) => {
    const typeSort = sorting.find((entry) => entry.id === 'type');
    const base = a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
    if (!typeSort) return base;
    return typeSort.desc ? -base : base;
  };

  const renderGroupHeader = (key: string, groupRows: Row<GarageService>[]) => {
    const groupRowBgClass = 'bg-[hsl(var(--category-group-row-bg))]';
    const groupRowTextClass = 'text-white';
    return (
      <tr
        key={`gh-${key}`}
        className={`${groupRowBgClass} ${groupRowTextClass} border-b-0 ${fullView ? 'sticky top-[36px] z-30' : ''}`}
      >
        <td className={`${groupRowBgClass} h-7 align-middle px-2 text-xs font-medium sticky left-0 z-30 relative shadow-[inset_0_1px_0_0_hsl(var(--category-group-row-bg)),inset_0_-1px_0_0_hsl(var(--category-group-row-bg))] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-[hsl(var(--grid-sticky-line))]`}>
          {key} ({groupRows.length})
        </td>
        <td colSpan={6} className={`${groupRowBgClass} h-7 shadow-[inset_0_1px_0_0_hsl(var(--category-group-row-bg)),inset_0_-1px_0_0_hsl(var(--category-group-row-bg))]`} />
        <td className={`${groupRowBgClass} h-7 sticky right-0 z-30 relative after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-[hsl(var(--grid-sticky-line))]`} />
      </tr>
    );
  };

  const hasInterval = useCallback((service: Pick<GarageService, 'every_miles' | 'every_months'>) => (
    Boolean(service.every_miles || service.every_months)
  ), []);
  const isVisibleWithCurrentFilters = useCallback((service: Pick<GarageService, 'name' | 'every_miles' | 'every_months'>) => {
    if (!matchesNameFilter(service.name, nameFilter)) return false;
    if (cadenceFilter === 'all') return true;
    if (cadenceFilter === 'recurring') return hasInterval(service);
    return !hasInterval(service);
  }, [cadenceFilter, hasInterval, nameFilter]);
  const filteredServices = useMemo(
    () => services.filter((service) => isVisibleWithCurrentFilters(service)),
    [isVisibleWithCurrentFilters, services],
  );
  const addNameError = validateGarageServiceName(addName, services);

  const latestOutcomeByServiceId = useMemo(() => {
    const byService = new Map<string, { status: GarageServiceStatus; serviceDate: string; mileage: number; createdAt: string }>();

    for (const servicing of servicings) {
      for (const outcome of servicing.outcomes) {
        const previous = byService.get(outcome.service_id);
        if (!previous) {
          byService.set(outcome.service_id, {
            status: outcome.status,
            serviceDate: servicing.service_date,
            mileage: servicing.odometer_miles,
            createdAt: servicing.created_at,
          });
          continue;
        }

        if (servicing.service_date > previous.serviceDate || (servicing.service_date === previous.serviceDate && servicing.created_at > previous.createdAt)) {
          byService.set(outcome.service_id, {
            status: outcome.status,
            serviceDate: servicing.service_date,
            mileage: servicing.odometer_miles,
            createdAt: servicing.created_at,
          });
        }
      }
    }

    return byService;
  }, [servicings]);

  const resetImportState = useCallback(() => {
    setImportPreview(null);
    setImportFileName(null);
    setImportValidationBusy(false);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([buildGarageServiceTemplateCsv()], { type: 'text/csv;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'garage-services-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }, []);

  const validateImportFile = useCallback(async (file: File) => {
    if (!isCsvFile(file)) {
      toast({
        title: 'CSV File Required',
        description: 'Please choose a CSV file to import services.',
        variant: 'destructive',
      });
      return;
    }

    setImportValidationBusy(true);
    try {
      const csvText = await file.text();
      const preview = buildGarageServiceImportPreview(csvText, services);
      setImportPreview(preview);
      setImportFileName(file.name);
    } catch (error) {
      setImportPreview(null);
      setImportFileName(file.name);
      toast({
        title: 'Failed to Validate CSV',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setImportValidationBusy(false);
    }
  }, [services]);

  const handleImportFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    event.currentTarget.value = '';
    if (!selectedFile) {
      resetImportState();
      return;
    }

    void validateImportFile(selectedFile);
  }, [resetImportState, validateImportFile]);

  const handleConfirmImport = useCallback(async () => {
    if (!importPreview || importPreview.rowsToImport.length === 0) return;

    setImportBusy(true);
    try {
      await onImportServices(importPreview.rowsToImport);
      setImportOpen(false);
      resetImportState();
      toast({
        title: 'Services imported',
        description: `Added ${importPreview.additions.length} and updated ${importPreview.updates.length} service${importPreview.rowsToImport.length === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to Import Services',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setImportBusy(false);
    }
  }, [importPreview, onImportServices, resetImportState]);

  const handleImportDialogChange = useCallback((open: boolean) => {
    if (importBusy) return;
    setImportOpen(open);
    if (!open) {
      resetImportState();
    }
  }, [importBusy, resetImportState]);

  const updateServiceAndNotifyIfHidden = useCallback(async (
    id: string,
    updates: Partial<Omit<GarageService, 'id' | 'user_id' | 'vehicle_id' | 'created_at'>>,
  ) => {
    const currentService = services.find((service) => service.id === id);
    const nextService = currentService ? { ...currentService, ...updates } : null;
    const shouldNotifyHiddenByFilters = Boolean(
      currentService
      && nextService
      && isVisibleWithCurrentFilters(currentService)
      && !isVisibleWithCurrentFilters(nextService)
    );

    await onUpdateService(id, updates);

    if (shouldNotifyHiddenByFilters) {
      toast({
        title: 'Service updated but hidden by filters',
        description: 'The service was updated, and it is no longer visible because of the current filters.',
      });
    }
  }, [isVisibleWithCurrentFilters, onUpdateService, services]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        size: 220,
        minSize: 100,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.name}
            onChange={(value) => {
              const trimmed = value.trim();
              const error = validateGarageServiceName(trimmed, services, row.original.id);
              if (error) {
                setInvalidNameWarning(error);
                return;
              }
              return updateServiceAndNotifyIfHidden(row.original.id, { name: trimmed });
            }}
            navCol={0}
          />
        ),
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        size: 150,
        minSize: 110,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <ServiceTypeCell
            value={row.original.type}
            onChange={(value) => {
              return updateServiceAndNotifyIfHidden(row.original.id, { type: value });
            }}
          />
        ),
      }),
      columnHelper.accessor('every_miles', {
        header: 'Every (Miles)',
        size: 120,
        minSize: 95,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.every_miles ?? ''}
            onChange={(value) => {
              return updateServiceAndNotifyIfHidden(row.original.id, { every_miles: normalizePositiveInt(value) });
            }}
            type="number"
            navCol={2}
            deleteResetValue=""
          />
        ),
      }),
      columnHelper.accessor('every_months', {
        header: 'Every (Months)',
        size: 130,
        minSize: 100,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.every_months ?? ''}
            onChange={(value) => {
              return updateServiceAndNotifyIfHidden(row.original.id, { every_months: normalizePositiveInt(value) });
            }}
            type="number"
            navCol={3}
            deleteResetValue=""
          />
        ),
      }),
      columnHelper.accessor((row) => latestOutcomeByServiceId.get(row.id)?.serviceDate ?? '', {
        id: 'last_performed',
        header: 'Last Performed',
        size: 190,
        minSize: 130,
        cell: ({ row }) => {
          const latest = latestOutcomeByServiceId.get(row.original.id);
          if (!latest) return <span className="text-muted-foreground">-</span>;

          const formattedDate = format(parseISO(latest.serviceDate), 'MMMM d, yyyy');
          const formattedMileage = `${formatMileageInThousands(latest.mileage)} mi`;
          if (latest.status === 'not_needed_yet') {
            return (
              <span className="inline-flex items-center gap-1.5">
                <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{formattedDate} - {formattedMileage}</span>
              </span>
            );
          }
          if (latest.status === 'declined') {
            return (
              <span className="inline-flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{formattedDate} - {formattedMileage}</span>
              </span>
            );
          }

          return (
            <span className="inline-flex items-center gap-1.5">
              <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{formattedDate} - {formattedMileage}</span>
            </span>
          );
        },
      }),
      columnHelper.accessor('monitoring', {
        header: 'Monitoring',
        size: 100,
        minSize: 85,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <MonitoringCell
            value={row.original.monitoring}
            onChange={(value) => {
              return updateServiceAndNotifyIfHidden(row.original.id, { monitoring: value });
            }}
            navCol={5}
          />
        ),
      }),
      columnHelper.accessor('notes', {
        header: 'Notes',
        size: 220,
        minSize: 120,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.notes ?? ''}
            onChange={(value) => {
              return updateServiceAndNotifyIfHidden(row.original.id, { notes: value.trim() || null });
            }}
            navCol={6}
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
          <ServiceActionsCell
            service={row.original}
            onDelete={(serviceId) => {
              const service = row.original;
              setDeleteBusy(true);
              dataGridHistory?.recordHistoryEntry({
                undo: () => onAddService({
                  id: service.id,
                  name: service.name,
                  type: service.type,
                  every_miles: service.every_miles,
                  every_months: service.every_months,
                  monitoring: service.monitoring,
                  notes: service.notes,
                  sort_order: service.sort_order,
                }),
                redo: () => onDeleteService(serviceId),
                undoFocusTarget: {
                  gridId: GARAGE_SERVICES_HISTORY_KEY,
                  rowId: service.id,
                  col: 0,
                },
                redoFocusTarget: null,
              });
              void onDeleteService(serviceId).finally(() => setDeleteBusy(false));
            }}
          />
        ),
      }),
    ],
    [dataGridHistory, latestOutcomeByServiceId, onAddService, onDeleteService, services, updateServiceAndNotifyIfHidden],
  );

  const table = useReactTable({
    data: filteredServices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnSizing, columnSizingInfo },
    onSortingChange: setSorting,
    onColumnSizingChange,
    onColumnSizingInfoChange,
    enableColumnResizing: columnResizingEnabled,
    enableSortingRemoval: false,
    columnResizeMode: 'onChange',
  });

  const submitAdd = async () => {
    const name = addName.trim();
    if (addNameError) {
      toast({ title: 'Invalid service name', description: addNameError, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const serviceId = crypto.randomUUID();
      const payload = {
        id: serviceId,
        name,
        type: addType,
        every_miles: normalizePositiveInt(addMiles),
        every_months: normalizePositiveInt(addMonths),
        notes: addNotes.trim() || null,
      };
      dataGridHistory?.recordHistoryEntry({
        undo: () => onDeleteService(serviceId),
        redo: () => onAddService(payload),
        undoFocusTarget: null,
        redoFocusTarget: {
          gridId: GARAGE_SERVICES_HISTORY_KEY,
          rowId: serviceId,
          col: 0,
        },
      });
      await onAddService(payload);
      setAddOpen(false);
      if (!matchesNameFilter(name, nameFilter)) {
        toast({
          title: 'Service added but hidden by filters',
          description: 'The service was added, but it is not visible because of the current filters.',
        });
      } else {
        toast({ title: 'Service added' });
      }
    } catch (error) {
      toast({
        title: 'Failed to add service',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openViewControlsModal = () => {
    setDraftNameFilter(nameFilter);
    setDraftCadenceFilter(cadenceFilter);
    setDraftGroupBy(groupBy);
    setViewControlsOpen(true);
  };

  const applyViewControls = () => {
    setNameFilter(draftNameFilter);
    setCadenceFilter(draftCadenceFilter);
    setGroupBy(draftGroupBy);
    setViewControlsOpen(false);
  };

  const clearViewControls = () => {
    setNameFilter('');
    setDraftNameFilter('');
    setCadenceFilter('all');
    setDraftCadenceFilter('all');
    setGroupBy('none');
    setDraftGroupBy('none');
  };

  const gridCardContentClassName = fullView ? 'px-0 pb-0 flex-1 min-h-0' : 'space-y-3 px-0';

  return (
    <Card className={`max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0 ${fullView ? 'h-full min-h-0 flex flex-col border-t-0 border-b-0 md:border-t' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Services</CardTitle>
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
                name="garage-services-filter-query"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="Service Name"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="h-8 w-36 text-xs"
                aria-label="Name"
              />
              <Select value={cadenceFilter} onValueChange={(value) => setCadenceFilter(value as CadenceFilterOption)}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Cadence…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="one_off">One-off</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupByOption)}>
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Group by…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping</SelectItem>
                  <SelectItem value="type">Service Type</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          {!isMobile && (
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
          )}
          <Button
            type="button"
            variant="outline-success"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Add service"
            onClick={() => setAddOpen(true)}
            disabled={loading || deleteBusy}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <DropdownMenu open={headerMenuOpen} onOpenChange={setHeaderMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 p-0"
                aria-label="Services menu"
                disabled={loading || deleteBusy}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem
                onClick={() => {
                  setHeaderMenuOpen(false);
                  setImportOpen(true);
                }}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Bulk Import from CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className={gridCardContentClassName}>
        <DataGrid
          table={table}
          historyKey={GARAGE_SERVICES_HISTORY_KEY}
          fullView={fullView}
          maxHeight={fullView ? 'none' : undefined}
          className={fullView ? 'h-full min-h-0' : undefined}
          emptyMessage={loading ? 'Loading services…' : services.length === 0 ? 'No services yet.' : 'No services match the filter'}
          groupBy={groupBy === 'none' ? undefined : getGroupKey}
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
              <Label htmlFor="garage-services-filter-query">Name</Label>
              <Input
                id="garage-services-filter-query"
                name="garage-services-filter-query-modal"
                value={draftNameFilter}
                onChange={(event) => setDraftNameFilter(event.target.value)}
                placeholder="Service Name"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cadence</Label>
              <Select value={draftCadenceFilter} onValueChange={(value) => setDraftCadenceFilter(value as CadenceFilterOption)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="one_off">One-off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Group By</Label>
              <Select value={draftGroupBy} onValueChange={(value) => setDraftGroupBy(value as GroupByOption)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping</SelectItem>
                  <SelectItem value="type">Service Type</SelectItem>
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

      <AlertDialog open={invalidNameWarning !== null} onOpenChange={(open) => {
        if (!open) setInvalidNameWarning(null);
      }}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Invalid Service Name</AlertDialogTitle>
            <AlertDialogDescription>{invalidNameWarning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setInvalidNameWarning(null)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importOpen} onOpenChange={handleImportDialogChange}>
        <DialogContent aria-describedby={undefined} className="max-h-[85vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import Services to {vehicleName}</DialogTitle>
          </DialogHeader>
          <DialogBody className="min-h-0 space-y-4 overflow-y-auto">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Upload a CSV spreadsheet of services containing exactly these columns in this order:</p>
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full border-collapse text-sm">
                  <tbody>
                    <tr className="bg-muted/30">
                      <td className="border px-3 py-2 font-medium text-foreground">Name</td>
                      <td className="border px-3 py-2 font-medium text-foreground">Type</td>
                      <td className="border px-3 py-2 font-medium text-foreground">Every (Miles)</td>
                      <td className="border px-3 py-2 font-medium text-foreground">Every (Months)</td>
                      <td className="border px-3 py-2 font-medium text-foreground">Monitoring</td>
                      <td className="border px-3 py-2 font-medium text-foreground">Notes</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>Rows import only when every included value is formatted exactly as required.</p>
              <p>If a row&apos;s Name matches an existing service, that existing service will be overwritten.</p>
            </div>

            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium text-foreground">Required Formatting</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li><span className="font-medium text-foreground">Name</span>: Required, non-blank, and unique within the uploaded CSV.</li>
                <li><span className="font-medium text-foreground">Type</span>: Blank, "Replacement", "Clean/Lube", "Adjustment", or "Check".</li>
                <li><span className="font-medium text-foreground">Every (Miles)</span>: Blank or a positive whole number.</li>
                <li><span className="font-medium text-foreground">Every (Months)</span>: Blank or a positive whole number.</li>
                <li><span className="font-medium text-foreground">Monitoring</span>: Blank, "TRUE", or "FALSE".</li>
                <li><span className="font-medium text-foreground">Notes</span>: Blank or free text.</li>
              </ol>
            </div>

            <Input
              ref={importFileInputRef}
              id="garage-service-import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportFileChange}
              disabled={importBusy}
              className="hidden"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Template CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => importFileInputRef.current?.click()}
                disabled={importBusy}
              >
                <Upload className="mr-2 h-4 w-4" />
                {importFileName ? 'Upload Different CSV' : 'Upload CSV'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {importFileName
                  ? (importValidationBusy ? `Validating ${importFileName}…` : importFileName)
                  : 'No file selected'}
              </span>
            </div>

            {importPreview && (
              <div className="space-y-4">
                {(importPreview.additions.length > 0
                  || importPreview.updates.length > 0
                  || importPreview.invalidRows.length > 0
                  || importPreview.ignoredDuplicateRows.length > 0
                  || importPreview.ignoredHeaders.length > 0) && (
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium text-foreground">If you confirm this import</p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {importPreview.additions.length > 0 && (
                        <li>{importPreview.additions.length} new service{importPreview.additions.length === 1 ? '' : 's'} will be added to {vehicleName}.</li>
                      )}
                      {importPreview.updates.length > 0 && (
                        <li>{importPreview.updates.length} existing service{importPreview.updates.length === 1 ? '' : 's'} in {vehicleName} will be updated.</li>
                      )}
                      {importPreview.invalidRows.length > 0 && (
                        <li>{importPreview.invalidRows.length} invalid row{importPreview.invalidRows.length === 1 ? '' : 's'} will be skipped.</li>
                      )}
                      {importPreview.ignoredDuplicateRows.length > 0 && (
                        <li>{importPreview.ignoredDuplicateRows.length} earlier duplicate row{importPreview.ignoredDuplicateRows.length === 1 ? '' : 's'} will be ignored in favor of a later row.</li>
                      )}
                      {importPreview.ignoredHeaders.length > 0 && (
                        <li>{importPreview.ignoredHeaders.length} unmatched header{importPreview.ignoredHeaders.length === 1 ? '' : 's'} will be ignored.</li>
                      )}
                    </ul>
                  </div>
                )}

                {importPreview.additions.length > 0 && (
                  <div className="rounded-md border p-3">
                  <p className="text-sm font-medium text-foreground">New Services</p>
                  <div className="mt-2 space-y-2">
                    {importPreview.additions.map((row) => (
                      <div key={`add-${row.rowNumber}`} className="rounded border px-3 py-2 text-sm">
                        <p className="font-medium">
                          {row.name} <span className="text-xs font-normal text-muted-foreground">(CSV row {row.rowNumber})</span>
                        </p>
                        <p className="mt-1 text-muted-foreground">{row.fieldSummaries.join(' · ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {importPreview.updates.length > 0 && (
                  <div className="rounded-md border p-3">
                  <p className="text-sm font-medium text-foreground">Updated Services</p>
                  <div className="mt-2 space-y-2">
                    {importPreview.updates.map((row) => (
                      <div key={`update-${row.rowNumber}`} className="rounded border px-3 py-2 text-sm">
                        <p className="font-medium">
                          {row.name} <span className="text-xs font-normal text-muted-foreground">(CSV row {row.rowNumber})</span>
                        </p>
                        <p className="mt-1 text-muted-foreground">{row.fieldSummaries.join(' · ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {importPreview.invalidRows.length > 0 && (
                  <div className="rounded-md border p-3">
                  <p className="text-sm font-medium text-foreground">Invalid Rows</p>
                  <div className="mt-2 space-y-2">
                    {importPreview.invalidRows.map((row) => (
                      <div key={`invalid-${row.rowNumber}`} className="rounded border px-3 py-2 text-sm">
                        <p className="font-medium">
                          {row.name || `Row ${row.rowNumber}`} <span className="text-xs font-normal text-muted-foreground">(CSV row {row.rowNumber})</span>
                        </p>
                        <p className="mt-1 text-muted-foreground">{row.reasons.join(' ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {importPreview.ignoredDuplicateRows.length > 0 && (
                  <div className="rounded-md border p-3">
                  <p className="text-sm font-medium text-foreground">Earlier Duplicate Rows</p>
                  <div className="mt-2 space-y-2">
                    {importPreview.ignoredDuplicateRows.map((row) => (
                      <div key={`duplicate-${row.rowNumber}`} className="rounded border px-3 py-2 text-sm">
                        <p className="font-medium">
                          {row.name || `Row ${row.rowNumber}`} <span className="text-xs font-normal text-muted-foreground">(CSV row {row.rowNumber})</span>
                        </p>
                        <p className="mt-1 text-muted-foreground">Ignored because CSV row {row.replacedByRowNumber} uses the same Name and later rows win.</p>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {importPreview.ignoredHeaders.length > 0 && (
                  <div className="rounded-md border p-3">
                  <p className="text-sm font-medium text-foreground">Ignored Headers</p>
                  <p className="mt-2 text-sm text-muted-foreground">{importPreview.ignoredHeaders.join(', ')}</p>
                </div>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleImportDialogChange(false)} disabled={importBusy}>
              Cancel
            </Button>
            <Button
              data-dialog-confirm="true"
              type="button"
              onClick={() => {
                void handleConfirmImport();
              }}
              disabled={!importPreview || importPreview.rowsToImport.length === 0 || importBusy || importValidationBusy}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importBusy ? 'Importing…' : 'Import Services'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={(open) => !saving && setAddOpen(open)}>
        <DialogContent aria-describedby={undefined} className="max-w-lg rounded-lg">
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="garage-service-name">Name</Label>
              <Input id="garage-service-name" value={addName} onChange={(event) => setAddName(event.target.value)} placeholder="Oil Change" />
              {addNameError && (
                <p className="text-sm text-destructive">{addNameError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={addType ?? EMPTY_SERVICE_TYPE_SELECT_VALUE}
                onValueChange={(value) => setAddType(value === EMPTY_SERVICE_TYPE_SELECT_VALUE ? null : value as GarageServiceType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SERVICE_TYPE_SELECT_VALUE}>{GARAGE_EMPTY_SERVICE_TYPE_LABEL}</SelectItem>
                  {GARAGE_SERVICE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="garage-service-miles">Every (Miles)</Label>
                <Input id="garage-service-miles" type="number" inputMode="decimal" value={addMiles} onChange={(event) => setAddMiles(event.target.value)} placeholder="10,000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-service-months">Every (Months)</Label>
                <Input id="garage-service-months" type="number" inputMode="decimal" value={addMonths} onChange={(event) => setAddMonths(event.target.value)} placeholder="12" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="garage-service-notes">Notes</Label>
              <Input id="garage-service-notes" value={addNotes} onChange={(event) => setAddNotes(event.target.value)} placeholder="Optional" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button data-dialog-confirm="true" type="button" onClick={() => { void submitAdd(); }} disabled={saving || !!addNameError}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
