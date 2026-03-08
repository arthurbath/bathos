import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type Row, type SortingState, useReactTable } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataGrid, GridCheckboxCell, GridEditableCell, gridMenuTriggerProps, gridSelectTriggerProps, useDataGrid } from '@/components/ui/data-grid';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Ban, CheckCheck, Filter, FilterX, MoreHorizontal, Plus, SkipForward, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { GARAGE_SERVICES_GRID_DEFAULT_WIDTHS, GRID_FIXED_COLUMNS } from '@/lib/gridColumnWidths';
import type { GarageService, GarageServiceStatus, GarageServiceType, GarageServicingWithRelations } from '@/modules/garage/types/garage';
import { useIsMobile } from '@/hooks/use-mobile';
import { GARAGE_SERVICE_TYPE_OPTIONS, getGarageServiceTypeLabel } from '@/modules/garage/lib/serviceTypes';

const columnHelper = createColumnHelper<GarageService>();
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';
const SERVICE_ACTIONS_NAV_COL = 7;
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

function ServiceTypeCell({
  value,
  onChange,
}: {
  value: GarageServiceType;
  onChange: (next: GarageServiceType) => void;
}) {
  const ctx = useDataGrid();

  return (
    <Select value={value} onValueChange={(next) => {
      ctx?.onCellCommit(1);
      onChange(next as GarageServiceType);
    }}>
      <SelectTrigger
        className={`h-7 border-transparent bg-transparent px-1 hover:border-[hsl(var(--grid-sticky-line))] text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 ${GRID_CONTROL_FOCUS_CLASS}`}
        {...gridSelectTriggerProps(ctx, 1)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
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
    name: string;
    type: GarageServiceType;
    every_miles?: number | null;
    every_months?: number | null;
    monitoring?: boolean;
    notes?: string | null;
  }) => Promise<GarageService>;
  onUpdateService: (id: string, updates: Partial<Omit<GarageService, 'id' | 'user_id' | 'vehicle_id' | 'created_at'>>) => Promise<void>;
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
  onDeleteService,
}: GarageServicesGridProps) {
  const isMobile = useIsMobile();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState<GarageServiceType>('replacement');
  const [addMiles, setAddMiles] = useState('');
  const [addMonths, setAddMonths] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
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
      setAddType('replacement');
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

  const getTypeLabel = (value: GarageServiceType) => getGarageServiceTypeLabel(value);

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

  const hasInterval = (service: GarageService) => Boolean(service.every_miles || service.every_months);
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (!matchesNameFilter(service.name, nameFilter)) return false;
      if (cadenceFilter === 'all') return true;
      if (cadenceFilter === 'recurring') return hasInterval(service);
      return !hasInterval(service);
    });
  }, [cadenceFilter, nameFilter, services]);

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
              return onUpdateService(row.original.id, { name: value.trim() || row.original.name });
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
              void onUpdateService(row.original.id, { type: value });
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
              return onUpdateService(row.original.id, { every_miles: normalizePositiveInt(value) });
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
              return onUpdateService(row.original.id, { every_months: normalizePositiveInt(value) });
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
              return onUpdateService(row.original.id, { monitoring: value });
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
              return onUpdateService(row.original.id, { notes: value.trim() || null });
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
              setDeleteBusy(true);
              void onDeleteService(serviceId).finally(() => setDeleteBusy(false));
            }}
          />
        ),
      }),
    ],
    [latestOutcomeByServiceId, onDeleteService, onUpdateService],
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
    if (!name) {
      toast({ title: 'Service name required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await onAddService({
        name,
        type: addType,
        every_miles: normalizePositiveInt(addMiles),
        every_months: normalizePositiveInt(addMonths),
        notes: addNotes.trim() || null,
      });
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
                placeholder="Service"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="h-8 w-36 text-xs"
                aria-label="Filter"
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
        </div>
      </CardHeader>
      <CardContent className={gridCardContentClassName}>
        <DataGrid
          table={table}
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
        <DialogContent className="w-screen max-w-none rounded-none sm:w-full sm:max-w-sm sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Filters & View Settings</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="garage-services-filter-query">Filter</Label>
              <Input
                id="garage-services-filter-query"
                name="garage-services-filter-query-modal"
                value={draftNameFilter}
                onChange={(event) => setDraftNameFilter(event.target.value)}
                placeholder="Service"
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

      <Dialog open={addOpen} onOpenChange={(open) => !saving && setAddOpen(open)}>
        <DialogContent className="max-w-lg rounded-lg">
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="garage-service-name">Name</Label>
              <Input id="garage-service-name" value={addName} onChange={(event) => setAddName(event.target.value)} placeholder="Oil Change" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={addType} onValueChange={(value) => setAddType(value as GarageServiceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
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
            <Button data-dialog-confirm="true" type="button" onClick={() => { void submitAdd(); }} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
