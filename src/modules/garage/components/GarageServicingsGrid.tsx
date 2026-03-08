import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataGrid, GridEditableCell, gridMenuTriggerProps, gridNavProps, useDataGrid } from '@/components/ui/data-grid';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, Plus, FileText, Trash2, Pencil, CalendarIcon, CircleMinus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { GARAGE_SERVICINGS_GRID_DEFAULT_WIDTHS, GRID_FIXED_COLUMNS } from '@/lib/gridColumnWidths';
import { cn } from '@/lib/utils';
import { GARAGE_SERVICE_TYPE_OPTIONS, getGarageServiceTypeLabel } from '@/modules/garage/lib/serviceTypes';
import type {
  GarageService,
  GarageServiceType,
  GarageServiceStatus,
  GarageServicingWithRelations,
} from '@/modules/garage/types/garage';

const columnHelper = createColumnHelper<GarageServicingWithRelations>();
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';
const SERVICING_ACTIONS_NAV_COL = 6;
const OUTCOME_BADGE_BASE_CLASS = 'inline-flex min-w-[1.75rem] items-center justify-center rounded-full py-0.5 text-xs font-semibold tabular-nums tracking-tight leading-none';
const SERVICE_OUTCOME_OPTIONS: Array<{ value: GarageServiceStatus; label: string }> = [
  { value: 'performed', label: 'Performed' },
  { value: 'not_needed_yet', label: 'Not Needed Yet' },
  { value: 'declined', label: 'Declined' },
];

type OutcomeDraftValue = GarageServiceStatus;

interface ServicingFormState {
  id: string | null;
  service_date: string;
  odometer_miles: string;
  shop_name: string;
  notes: string;
  outcomes: Record<string, OutcomeDraftValue>;
  newFiles: File[];
  deletedReceipts: Array<{ id: string; storagePath: string }>;
}

type ServicingDialogFocusTarget = 'default' | 'outcomes' | 'receipts';

function buildDefaultOutcomeMap(services: GarageService[], servicing?: GarageServicingWithRelations | null): Record<string, OutcomeDraftValue> {
  const map: Record<string, OutcomeDraftValue> = {};
  for (const outcome of servicing?.outcomes ?? []) {
    const exists = services.some((service) => service.id === outcome.service_id);
    if (!exists) continue;
    map[outcome.service_id] = outcome.status;
  }
  return map;
}

function normalizeMileage(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function normalizePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function parseDateInputValue(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function toDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function getCalendarMonthForDateInput(value: string): Date {
  const parsed = parseDateInputValue(value);
  if (parsed) return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

function getOutcomeBadgeClass(
  value: number,
  variant: 'success' | 'warning' | 'danger',
): string {
  if (value === 0) return `${OUTCOME_BADGE_BASE_CLASS} bg-muted text-black`;
  if (variant === 'success') return `${OUTCOME_BADGE_BASE_CLASS} bg-success text-success-foreground`;
  if (variant === 'warning') return `${OUTCOME_BADGE_BASE_CLASS} bg-warning text-warning-foreground`;
  return `${OUTCOME_BADGE_BASE_CLASS} bg-destructive text-destructive-foreground`;
}

function ServiceOutcomeOptionSwatch({ status }: { status: GarageServiceStatus }) {
  const swatchClass = status === 'performed'
    ? 'bg-success'
    : status === 'not_needed_yet'
      ? 'bg-warning'
      : 'bg-destructive';

  return (
    <span
      aria-hidden="true"
      className={cn('h-3 w-3 rounded-sm border border-white/20', swatchClass)}
    />
  );
}

function ServicingDateCell({
  value,
  navCol,
  onChange,
}: {
  value: string;
  navCol: number;
  onChange: (value: string) => void | Promise<unknown>;
}) {
  const ctx = useDataGrid();
  const [open, setOpen] = useState(false);
  const parsedDate = parseDateInputValue(value);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => getCalendarMonthForDateInput(value));

  useEffect(() => {
    if (!open) return;
    setVisibleMonth(getCalendarMonthForDateInput(value));
  }, [open, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-grid-focus-only="true"
          {...gridNavProps(ctx, navCol)}
          onKeyDown={(event) => {
            if (ctx?.onCellKeyDown(event)) return;
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            setOpen(true);
          }}
          className={cn(
            'inline-flex h-7 w-full items-center justify-start gap-1 rounded-md border border-transparent bg-transparent px-1 text-left text-xs font-normal underline decoration-dashed decoration-muted-foreground/40 underline-offset-2 hover:border-[hsl(var(--grid-sticky-line))]',
            GRID_CONTROL_FOCUS_CLASS,
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate">
            {parsedDate ? format(parsedDate, 'MMM d, yyyy') : (value || 'Pick a date')}
          </span>
          <CalendarIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-foreground opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={parsedDate}
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          onSelect={(date) => {
            if (!date) return;
            const nextValue = toDateInputValue(date);
            if (nextValue !== value) {
              ctx?.onCellCommit(navCol);
              void onChange(nextValue);
            }
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function ServicingActionsCell({
  servicing,
  onEdit,
  onDelete,
}: {
  servicing: GarageServicingWithRelations;
  onEdit: (servicing: GarageServicingWithRelations) => void;
  onDelete: (servicingId: string) => void;
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
            aria-label={`Actions for ${servicing.service_date}`}
            {...gridMenuTriggerProps(ctx, SERVICING_ACTIONS_NAV_COL)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          <DropdownMenuItem onClick={() => onEdit(servicing)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent className="rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete servicing</AlertDialogTitle>
          <AlertDialogDescription>
            Delete this servicing record from {servicing.service_date}? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onDelete(servicing.id)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface GarageServicingsGridProps {
  userId: string;
  currentVehicleId: string;
  services: GarageService[];
  servicings: GarageServicingWithRelations[];
  loading: boolean;
  currentVehicleMileage: number;
  vehicleName: string;
  fullView?: boolean;
  onAddServicing: (input: {
    service_date: string;
    odometer_miles: number;
    shop_name?: string | null;
    notes?: string | null;
    outcomes: Array<{ service_id: string; status: GarageServiceStatus }>;
    receipt_files?: File[];
  }) => Promise<void>;
  onUpdateServicing: (id: string, input: {
    service_date: string;
    odometer_miles: number;
    shop_name?: string | null;
    notes?: string | null;
    outcomes: Array<{ service_id: string; status: GarageServiceStatus }>;
    receipt_files?: File[];
    receipt_deletes?: Array<{ id: string; storagePath: string }>;
  }) => Promise<void>;
  onDeleteServicing: (id: string) => Promise<void>;
  onOpenReceipt: (storagePath: string) => Promise<void>;
  onAddService: (input: {
    name: string;
    type: GarageServiceType;
    every_miles?: number | null;
    every_months?: number | null;
    monitoring?: boolean;
    notes?: string | null;
  }) => Promise<GarageService>;
}

export function GarageServicingsGrid({
  userId,
  currentVehicleId,
  services,
  servicings,
  loading,
  currentVehicleMileage,
  vehicleName,
  fullView = false,
  onAddServicing,
  onUpdateServicing,
  onDeleteServicing,
  onOpenReceipt,
  onAddService,
}: GarageServicingsGridProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'service_date', desc: true }]);
  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'garage_servicings',
    defaults: GARAGE_SERVICINGS_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.garage_servicings,
  });

  const createDefaultFormState = useCallback((): ServicingFormState => ({
    // Servicings are sorted newest-first, so index 0 is the most recent record.
    id: null,
    service_date: new Date().toISOString().slice(0, 10),
    odometer_miles: String(currentVehicleMileage),
    shop_name: servicings[0]?.shop_name ?? '',
    notes: '',
    outcomes: buildDefaultOutcomeMap(services),
    newFiles: [],
    deletedReceipts: [],
  }), [currentVehicleMileage, services, servicings]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [serviceDatePickerOpen, setServiceDatePickerOpen] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [servicePickerQuery, setServicePickerQuery] = useState('');
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false);
  const [addServiceBusy, setAddServiceBusy] = useState(false);
  const [addServiceName, setAddServiceName] = useState('');
  const [addServiceType, setAddServiceType] = useState<GarageServiceType>('replacement');
  const [addServiceMiles, setAddServiceMiles] = useState('');
  const [addServiceMonths, setAddServiceMonths] = useState('');
  const [addServiceNotes, setAddServiceNotes] = useState('');
  const [sessionAddedServices, setSessionAddedServices] = useState<GarageService[]>([]);
  const [shopSuggestionsOpen, setShopSuggestionsOpen] = useState(false);
  const [receiptDropActive, setReceiptDropActive] = useState(false);
  const [dialogFocusTarget, setDialogFocusTarget] = useState<ServicingDialogFocusTarget>('default');
  const [formState, setFormState] = useState<ServicingFormState>(createDefaultFormState);
  const [serviceDatePickerMonth, setServiceDatePickerMonth] = useState<Date>(
    () => getCalendarMonthForDateInput(new Date().toISOString().slice(0, 10)),
  );
  const servicePickerSearchRef = useRef<HTMLInputElement | null>(null);
  const servicePickerItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const servicePickerAddNewRef = useRef<HTMLButtonElement | null>(null);
  const serviceOutcomeAddButtonRef = useRef<HTMLButtonElement | null>(null);
  const serviceDateButtonRef = useRef<HTMLButtonElement | null>(null);
  const shopInputRef = useRef<HTMLInputElement | null>(null);
  const shopSuggestionItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const notesInputRef = useRef<HTMLInputElement | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const receiptAddButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogBodyRef = useRef<HTMLDivElement | null>(null);
  const dialogBodyScrollTopRef = useRef(0);

  const [editingServicing, setEditingServicing] = useState<GarageServicingWithRelations | null>(null);

  const resetForm = () => {
    setEditingServicing(null);
    setServiceDatePickerOpen(false);
    setServicePickerOpen(false);
    setServicePickerQuery('');
    setShopSuggestionsOpen(false);
    setFormState(createDefaultFormState());
  };

  useEffect(() => {
    setSessionAddedServices([]);
  }, [currentVehicleId]);

  const openCreateDialog = () => {
    dialogBodyScrollTopRef.current = 0;
    setDialogFocusTarget('default');
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = useCallback((
    servicing: GarageServicingWithRelations,
    focusTarget: ServicingDialogFocusTarget = 'default',
  ) => {
    dialogBodyScrollTopRef.current = 0;
    setDialogFocusTarget(focusTarget);
    setServiceDatePickerOpen(false);
    setServicePickerOpen(false);
    setServicePickerQuery('');
    setShopSuggestionsOpen(false);
    setEditingServicing(servicing);
    setFormState({
      id: servicing.id,
      service_date: servicing.service_date,
      odometer_miles: String(servicing.odometer_miles),
      shop_name: servicing.shop_name ?? '',
      notes: servicing.notes ?? '',
      outcomes: buildDefaultOutcomeMap(services, servicing),
      newFiles: [],
      deletedReceipts: [],
    });
    setDialogOpen(true);
  }, [services]);

  const availableServices = useMemo(() => {
    const byId = new Map<string, GarageService>();
    for (const service of services) byId.set(service.id, service);
    for (const service of sessionAddedServices) {
      if (!byId.has(service.id)) byId.set(service.id, service);
    }
    return Array.from(byId.values());
  }, [services, sessionAddedServices]);

  const servicesById = useMemo(() => {
    const map = new Map<string, GarageService>();
    for (const service of availableServices) {
      map.set(service.id, service);
    }
    return map;
  }, [availableServices]);

  const selectedServiceRows = useMemo(() => (
    Object.entries(formState.outcomes)
      .map(([serviceId, status]) => ({
        serviceId,
        service: servicesById.get(serviceId),
        status,
      }))
      .filter((row): row is { serviceId: string; service: GarageService; status: OutcomeDraftValue } => Boolean(row.service))
      .sort((a, b) => a.service.name.localeCompare(b.service.name, undefined, { sensitivity: 'base', numeric: true }))
  ), [formState.outcomes, servicesById]);

  const selectedServiceIdSet = useMemo(
    () => new Set(Object.keys(formState.outcomes)),
    [formState.outcomes],
  );

  const addableServices = useMemo(() => (
    availableServices
      .filter((service) => !selectedServiceIdSet.has(service.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
  ), [availableServices, selectedServiceIdSet]);

  const filteredAddableServices = useMemo(() => {
    const query = servicePickerQuery.trim().toLowerCase();
    if (!query) return addableServices;
    return addableServices.filter((service) => {
      const haystack = `${service.name} ${service.type} ${getGarageServiceTypeLabel(service.type)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [addableServices, servicePickerQuery]);

  const servicePickerQueryTrimmed = servicePickerQuery.trim();
  const canCreateServiceFromQuery = servicePickerQueryTrimmed.length > 0
    && filteredAddableServices.length === 0
    && !availableServices.some((service) => service.name.trim().toLowerCase() === servicePickerQueryTrimmed.toLowerCase());

  const knownShopNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];

    for (const servicing of servicings) {
      const shopName = servicing.shop_name?.trim();
      if (!shopName) continue;
      const key = shopName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(shopName);
    }

    return names;
  }, [servicings]);

  const filteredShopSuggestions = useMemo(() => {
    const query = formState.shop_name.trim().toLowerCase();
    if (!query) return [];
    return knownShopNames.filter((shopName) => {
      const normalized = shopName.toLowerCase();
      if (normalized === query) return false;
      return normalized.includes(query);
    });
  }, [formState.shop_name, knownShopNames]);

  const shopSuggestionsVisible = shopSuggestionsOpen && filteredShopSuggestions.length > 0;

  const focusShopInputAtEnd = useCallback(() => {
    const input = shopInputRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, []);

  const applyShopSuggestion = useCallback((shopName: string) => {
    setFormState((prev) => ({ ...prev, shop_name: shopName }));
    setShopSuggestionsOpen(false);
    window.requestAnimationFrame(() => {
      focusShopInputAtEnd();
    });
  }, [focusShopInputAtEnd]);

  const addServiceOutcome = useCallback((serviceId: string) => {
    setFormState((prev) => ({
      ...prev,
      outcomes: {
        ...prev.outcomes,
        [serviceId]: 'performed',
      },
    }));
    setServicePickerOpen(false);
    setServicePickerQuery('');
  }, []);

  const openAddServiceDialog = useCallback((seedName: string) => {
    setServicePickerOpen(false);
    setAddServiceName(seedName);
    setAddServiceType('replacement');
    setAddServiceMiles('');
    setAddServiceMonths('');
    setAddServiceNotes('');
    setAddServiceDialogOpen(true);
  }, []);

  const submitAddService = useCallback(async () => {
    const name = addServiceName.trim();
    if (!name) {
      toast({ title: 'Service name required', variant: 'destructive' });
      return;
    }

    setAddServiceBusy(true);
    try {
      const createdService = await onAddService({
        name,
        type: addServiceType,
        every_miles: normalizePositiveInt(addServiceMiles),
        every_months: normalizePositiveInt(addServiceMonths),
        notes: addServiceNotes.trim() || null,
      });

      setSessionAddedServices((prev) => {
        if (prev.some((service) => service.id === createdService.id)) return prev;
        return [...prev, createdService];
      });
      addServiceOutcome(createdService.id);
      setAddServiceDialogOpen(false);
      setServicePickerOpen(false);
      setServicePickerQuery('');
      window.requestAnimationFrame(() => {
        serviceOutcomeAddButtonRef.current?.focus();
      });
      toast({ title: 'Service added' });
    } catch (error) {
      toast({
        title: 'Failed to add service',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setAddServiceBusy(false);
    }
  }, [addServiceMonths, addServiceMiles, addServiceName, addServiceNotes, addServiceOutcome, addServiceType, onAddService]);

  const removeServiceOutcome = useCallback((serviceId: string) => {
    setFormState((prev) => {
      if (!(serviceId in prev.outcomes)) return prev;
      const nextOutcomes = { ...prev.outcomes };
      delete nextOutcomes[serviceId];
      return {
        ...prev,
        outcomes: nextOutcomes,
      };
    });
  }, []);

  const restoreDialogBodyScroll = useCallback(() => {
    const body = dialogBodyRef.current;
    if (!body) return;
    if (Math.abs(body.scrollTop - dialogBodyScrollTopRef.current) <= 1) return;
    body.scrollTop = dialogBodyScrollTopRef.current;
  }, []);

  const addReceiptFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setFormState((prev) => ({
      ...prev,
      newFiles: [...prev.newFiles, ...files],
    }));
  }, []);

  const removeReceiptFile = useCallback((index: number) => {
    setFormState((prev) => ({
      ...prev,
      newFiles: prev.newFiles.filter((_, fileIndex) => fileIndex !== index),
    }));
  }, []);

  useEffect(() => {
    if (!servicePickerOpen) return;
    const frame = window.requestAnimationFrame(() => {
      servicePickerSearchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [servicePickerOpen]);

  useEffect(() => {
    if (!dialogOpen) return;

    const handleWindowFocus = () => {
      window.requestAnimationFrame(() => {
        restoreDialogBodyScroll();
      });
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [dialogOpen, restoreDialogBodyScroll]);

  useLayoutEffect(() => {
    if (!dialogOpen) return;
    restoreDialogBodyScroll();
  });

  useEffect(() => {
    if (!dialogOpen) return;
    const frame = window.requestAnimationFrame(() => {
      if (!formState.id) {
        serviceDateButtonRef.current?.focus();
        return;
      }

      if (dialogFocusTarget === 'outcomes') {
        serviceOutcomeAddButtonRef.current?.focus();
        return;
      }

      if (dialogFocusTarget === 'receipts') {
        receiptAddButtonRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dialogFocusTarget, dialogOpen, formState.id]);

  const buildOutcomePayload = () =>
    Object.entries(formState.outcomes)
      .map(([serviceId, status]) => ({
        service_id: serviceId,
        status,
      }));

  const submit = async () => {
    if (!formState.service_date) {
      toast({ title: 'Service date required', variant: 'destructive' });
      return;
    }

    setDialogBusy(true);
    try {
      const payload = {
        service_date: formState.service_date,
        odometer_miles: normalizeMileage(formState.odometer_miles),
        shop_name: formState.shop_name.trim() || null,
        notes: formState.notes.trim() || null,
        outcomes: buildOutcomePayload(),
        receipt_files: formState.newFiles,
        receipt_deletes: formState.deletedReceipts,
      };

      if (formState.id) {
        await onUpdateServicing(formState.id, payload);
      } else {
        await onAddServicing(payload);
      }

      setDialogOpen(false);
      resetForm();
      toast({ title: formState.id ? 'Servicing updated' : 'Servicing added' });
    } catch (error) {
      toast({
        title: 'Failed to save servicing',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDialogBusy(false);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('service_date', {
        header: 'Date',
        size: 120,
        minSize: 105,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <ServicingDateCell
            value={row.original.service_date}
            navCol={0}
            onChange={(value) => {
              return onUpdateServicing(row.original.id, {
                service_date: value,
                odometer_miles: row.original.odometer_miles,
                shop_name: row.original.shop_name,
                notes: row.original.notes,
                outcomes: row.original.outcomes.map((outcome) => ({ service_id: outcome.service_id, status: outcome.status })),
                receipt_files: [],
              });
            }}
          />
        ),
      }),
      columnHelper.accessor('odometer_miles', {
        header: 'Mileage',
        size: 110,
        minSize: 90,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.odometer_miles}
            type="number"
            navCol={1}
            deleteResetValue="0"
            onChange={(value) => {
              return onUpdateServicing(row.original.id, {
                service_date: row.original.service_date,
                odometer_miles: normalizeMileage(value),
                shop_name: row.original.shop_name,
                notes: row.original.notes,
                outcomes: row.original.outcomes.map((outcome) => ({ service_id: outcome.service_id, status: outcome.status })),
                receipt_files: [],
              });
            }}
          />
        ),
      }),
      columnHelper.accessor('shop_name', {
        header: 'Shop',
        size: 170,
        minSize: 120,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.shop_name ?? ''}
            navCol={2}
            deleteResetValue=""
            onChange={(value) => {
              return onUpdateServicing(row.original.id, {
                service_date: row.original.service_date,
                odometer_miles: row.original.odometer_miles,
                shop_name: value.trim() || null,
                notes: row.original.notes,
                outcomes: row.original.outcomes.map((outcome) => ({ service_id: outcome.service_id, status: outcome.status })),
                receipt_files: [],
              });
            }}
          />
        ),
      }),
      columnHelper.display({
        id: 'outcomes',
        header: 'Outcomes',
        size: 140,
        minSize: 120,
        cell: ({ row }) => {
          const performed = row.original.outcomes.filter((outcome) => outcome.status === 'performed').length;
          const notNeeded = row.original.outcomes.filter((outcome) => outcome.status === 'not_needed_yet').length;
          const declined = row.original.outcomes.filter((outcome) => outcome.status === 'declined').length;
          return (
            <button
              type="button"
              className="flex h-full w-full items-center gap-1.5 text-left"
              onClick={() => openEditDialog(row.original, 'outcomes')}
              aria-label={`Open servicing detail for ${row.original.service_date}`}
            >
              <span className={getOutcomeBadgeClass(performed, 'success')} title="Performed services">{performed}</span>
              <span className={getOutcomeBadgeClass(notNeeded, 'warning')} title="Services not needed">{notNeeded}</span>
              <span className={getOutcomeBadgeClass(declined, 'danger')} title="Declined services">{declined}</span>
            </button>
          );
        },
      }),
      columnHelper.display({
        id: 'receipts',
        header: 'Receipts',
        size: 90,
        minSize: 75,
        cell: ({ row }) => (
          <button
            type="button"
            className="h-full w-full text-left text-xs text-foreground"
            onClick={() => openEditDialog(row.original, 'receipts')}
            aria-label={`Open servicing detail for ${row.original.service_date}`}
          >
            {row.original.receipts.length}
          </button>
        ),
      }),
      columnHelper.accessor('notes', {
        header: 'Notes',
        size: 220,
        minSize: 130,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.notes ?? ''}
            navCol={5}
            deleteResetValue=""
            onChange={(value) => {
              return onUpdateServicing(row.original.id, {
                service_date: row.original.service_date,
                odometer_miles: row.original.odometer_miles,
                shop_name: row.original.shop_name,
                notes: value.trim() || null,
                outcomes: row.original.outcomes.map((outcome) => ({ service_id: outcome.service_id, status: outcome.status })),
                receipt_files: [],
              });
            }}
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
          <ServicingActionsCell
            servicing={row.original}
            onEdit={openEditDialog}
            onDelete={(servicingId) => {
              void onDeleteServicing(servicingId);
            }}
          />
        ),
      }),
    ],
    [onDeleteServicing, onUpdateServicing, openEditDialog],
  );

  const table = useReactTable({
    data: servicings,
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

  const gridCardContentClassName = fullView ? 'px-0 pb-0 flex-1 min-h-0' : 'space-y-3 px-0';

  return (
    <Card className={`max-w-none w-[100vw] relative left-1/2 -translate-x-1/2 rounded-none border-x-0 ${fullView ? 'h-full min-h-0 flex flex-col border-t-0 border-b-0 md:border-t' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Servicings</CardTitle>
        <Button
          type="button"
          variant="outline-success"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Add servicing"
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className={gridCardContentClassName}>
        <DataGrid
          table={table}
          fullView={fullView}
          maxHeight={fullView ? 'none' : undefined}
          className={fullView ? 'h-full min-h-0' : undefined}
          emptyMessage={loading ? 'Loading servicings…' : 'No servicings yet.'}
        />
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (dialogBusy) return;
        setDialogOpen(open);
        if (!open) setServiceDatePickerOpen(false);
      }}>
        <DialogContent className="max-h-[85vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg">
          <DialogHeader>
            <DialogTitle>{formState.id ? 'Servicing Detail' : 'Add Servicing'}</DialogTitle>
          </DialogHeader>

          <DialogBody
            ref={dialogBodyRef}
            className="space-y-4 overflow-y-auto"
            onScroll={(event) => {
              dialogBodyScrollTopRef.current = event.currentTarget.scrollTop;
            }}
            onFocusCapture={() => {
              if (!dialogOpen) return;
              window.requestAnimationFrame(() => {
                restoreDialogBodyScroll();
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="garage-servicing-date">Date</Label>
                <Popover
                  open={serviceDatePickerOpen}
                  onOpenChange={(nextOpen) => {
                    setServiceDatePickerOpen(nextOpen);
                    if (nextOpen) {
                      setServiceDatePickerMonth(getCalendarMonthForDateInput(formState.service_date));
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      ref={serviceDateButtonRef}
                      id="garage-servicing-date"
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-10 w-full justify-start rounded-md border-[hsl(var(--grid-sticky-line))] bg-background px-3 py-2 text-left text-base font-normal text-foreground hover:bg-background hover:text-foreground md:text-sm',
                        !formState.service_date && 'text-muted-foreground',
                      )}
                    >
                      <span className="truncate">{formState.service_date
                        ? format(parseDateInputValue(formState.service_date) ?? new Date(`${formState.service_date}T00:00:00`), 'MMM d, yyyy')
                        : 'Pick a date'}</span>
                      <CalendarIcon className="ml-auto h-4 w-4 shrink-0 text-foreground opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseDateInputValue(formState.service_date)}
                      month={serviceDatePickerMonth}
                      onMonthChange={setServiceDatePickerMonth}
                      onSelect={(date) => {
                        if (!date) {
                          setServiceDatePickerOpen(false);
                          return;
                        }
                        setFormState((prev) => ({ ...prev, service_date: toDateInputValue(date) }));
                        setServiceDatePickerOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-servicing-mileage">Mileage</Label>
                <Input id="garage-servicing-mileage" type="number" inputMode="decimal" value={formState.odometer_miles} onChange={(event) => setFormState((prev) => ({ ...prev, odometer_miles: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-servicing-shop">Shop</Label>
                <div
                  className="relative"
                  onBlurCapture={(event) => {
                    const container = event.currentTarget;
                    window.requestAnimationFrame(() => {
                      const active = document.activeElement;
                      if (active && container.contains(active)) return;
                      setShopSuggestionsOpen(false);
                    });
                  }}
                >
                  <Input
                    ref={shopInputRef}
                    id="garage-servicing-shop"
                    value={formState.shop_name}
                    onFocus={() => {
                      if (filteredShopSuggestions.length > 0) {
                        setShopSuggestionsOpen(true);
                      }
                    }}
                    onChange={(event) => {
                      setFormState((prev) => ({ ...prev, shop_name: event.target.value }));
                      setShopSuggestionsOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowDown') return;
                      if (!shopSuggestionsVisible) return;
                      event.preventDefault();
                      shopSuggestionItemRefs.current[0]?.focus();
                    }}
                    placeholder="Optional"
                    aria-autocomplete="list"
                    aria-expanded={shopSuggestionsVisible}
                  />
                  {shopSuggestionsVisible && (
                    <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border bg-popover">
                      {filteredShopSuggestions.map((shopName, index) => (
                        <button
                          key={shopName.toLowerCase()}
                          ref={(element) => {
                            shopSuggestionItemRefs.current[index] = element;
                          }}
                          type="button"
                          tabIndex={-1}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onClick={() => applyShopSuggestion(shopName)}
                          onKeyDown={(event) => {
                            if (event.key === 'ArrowDown') {
                              event.preventDefault();
                              const nextIndex = Math.min(index + 1, filteredShopSuggestions.length - 1);
                              shopSuggestionItemRefs.current[nextIndex]?.focus();
                              return;
                            }
                            if (event.key === 'ArrowUp') {
                              event.preventDefault();
                              if (index === 0) {
                                focusShopInputAtEnd();
                                return;
                              }
                              shopSuggestionItemRefs.current[index - 1]?.focus();
                              return;
                            }
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              applyShopSuggestion(shopName);
                              return;
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              setShopSuggestionsOpen(false);
                              focusShopInputAtEnd();
                            }
                          }}
                        >
                          {shopName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Service Outcomes</Label>
                <Popover
                  open={servicePickerOpen}
                  onOpenChange={(nextOpen) => {
                    setServicePickerOpen(nextOpen);
                    if (!nextOpen) setServicePickerQuery('');
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      ref={serviceOutcomeAddButtonRef}
                      type="button"
                      size="sm"
                      variant="outline-success"
                      className="h-8 w-8 p-0"
                      disabled={addableServices.length === 0}
                      aria-label="Add service outcome"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[min(480px,calc(100vw-2rem))] p-0"
                    align="end"
                    onOpenAutoFocus={(event) => {
                      event.preventDefault();
                      servicePickerSearchRef.current?.focus({ preventScroll: true });
                    }}
                  >
                    <div className="max-h-48 overflow-y-auto sm:max-h-72">
                      <div className="sticky top-0 z-10 rounded-tl-md rounded-tr-md border-b bg-popover p-2">
                        <Input
                          ref={servicePickerSearchRef}
                          autoFocus
                          value={servicePickerQuery}
                          onChange={(event) => setServicePickerQuery(event.target.value)}
                          placeholder="Type to find a service..."
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          onKeyDown={(event) => {
                            if (event.key === 'Tab') {
                              event.preventDefault();
                              return;
                            }
                            if (event.key !== 'ArrowDown') return;
                            event.preventDefault();
                            if (filteredAddableServices.length === 0) {
                              if (canCreateServiceFromQuery) {
                                servicePickerAddNewRef.current?.focus();
                              }
                              return;
                            }
                            servicePickerItemRefs.current[0]?.focus();
                          }}
                        />
                      </div>
                      {filteredAddableServices.length === 0 ? (
                        canCreateServiceFromQuery ? (
                          <div className="py-1">
                            <button
                              ref={servicePickerAddNewRef}
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                              onClick={() => openAddServiceDialog(servicePickerQueryTrimmed)}
                              onKeyDown={(event) => {
                                if (event.key === 'Tab') {
                                  event.preventDefault();
                                  return;
                                }
                                if (event.key === 'ArrowUp') {
                                  event.preventDefault();
                                  servicePickerSearchRef.current?.focus();
                                  return;
                                }
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  openAddServiceDialog(servicePickerQueryTrimmed);
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              <span>Add "{servicePickerQueryTrimmed}" as a new service</span>
                            </button>
                          </div>
                        ) : (
                          <p className="px-3 py-2 text-sm text-muted-foreground">No matching services.</p>
                        )
                      ) : (
                        <div className="py-1">
                          {filteredAddableServices.map((service, index) => (
                            <button
                              key={service.id}
                              ref={(element) => {
                                servicePickerItemRefs.current[index] = element;
                              }}
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                              onClick={() => addServiceOutcome(service.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Tab') {
                                  event.preventDefault();
                                  return;
                                }
                                if (event.key === 'ArrowDown') {
                                  event.preventDefault();
                                  const nextIndex = Math.min(index + 1, filteredAddableServices.length - 1);
                                  servicePickerItemRefs.current[nextIndex]?.focus();
                                  return;
                                }
                                if (event.key === 'ArrowUp') {
                                  event.preventDefault();
                                  if (index === 0) {
                                    servicePickerSearchRef.current?.focus();
                                    return;
                                  }
                                  servicePickerItemRefs.current[index - 1]?.focus();
                                  return;
                                }
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  addServiceOutcome(service.id);
                                }
                              }}
                            >
                              <span className="truncate font-medium">{service.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{getGarageServiceTypeLabel(service.type)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="rounded-md border">
                <div className="divide-y">
                  {selectedServiceRows.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No service outcomes added yet</p>
                  )}
                  {selectedServiceRows.map((row) => (
                    <div key={row.serviceId} className="space-y-1.5 px-2 py-1.5">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{row.service.name}</p>
                        <p className="shrink-0 text-xs text-muted-foreground">{getGarageServiceTypeLabel(row.service.type)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={row.status}
                          onValueChange={(value) => {
                            setFormState((prev) => ({
                              ...prev,
                              outcomes: {
                                ...prev.outcomes,
                                [row.serviceId]: value as OutcomeDraftValue,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger className="h-7 w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SERVICE_OUTCOME_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                rightAdornment={<ServiceOutcomeOptionSwatch status={option.value} />}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline-warning"
                          className="ml-auto h-7 w-7 p-0"
                          onClick={() => removeServiceOutcome(row.serviceId)}
                          aria-label={`Remove ${row.service.name} outcome`}
                        >
                          <CircleMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Receipts</Label>
              {editingServicing && editingServicing.receipts.length > 0 && (
                <div className="space-y-2">
                  {editingServicing.receipts.map((receipt) => (
                    <div key={receipt.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-sm underline decoration-dashed underline-offset-2"
                        onClick={() => {
                          void onOpenReceipt(receipt.storage_object_path);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                        <span>{receipt.filename}</span>
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline-destructive"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setFormState((prev) => (
                            prev.deletedReceipts.some((row) => row.id === receipt.id)
                              ? prev
                              : {
                                  ...prev,
                                  deletedReceipts: [...prev.deletedReceipts, { id: receipt.id, storagePath: receipt.storage_object_path }],
                                }
                          ));
                          setEditingServicing((prev) => prev
                            ? {
                                ...prev,
                                receipts: prev.receipts.filter((row) => row.id !== receipt.id),
                              }
                            : prev);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {formState.newFiles.length > 0 && (
                <div className="space-y-2">
                  {formState.newFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}-${file.size}-${index}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div className="inline-flex min-w-0 items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline-destructive"
                        className="h-7 w-7 p-0"
                        onClick={() => removeReceiptFile(index)}
                        aria-label={`Remove ${file.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <button
                ref={receiptAddButtonRef}
                type="button"
                className={cn(
                  'flex w-full flex-col items-center justify-center rounded-md border border-dashed px-3 py-5 text-sm focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-2 focus:ring-offset-background focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  receiptDropActive ? 'border-primary bg-muted/40' : 'border-[hsl(var(--grid-sticky-line))]',
                )}
                onClick={() => receiptInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    receiptInputRef.current?.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!receiptDropActive) setReceiptDropActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setReceiptDropActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setReceiptDropActive(false);
                  const files = Array.from(event.dataTransfer.files ?? []);
                  addReceiptFiles(files);
                }}
                aria-label="Add receipts"
              >
                <Plus className="h-4 w-4" />
                <span className="font-medium">Add</span>
              </button>
              <Input
                ref={receiptInputRef}
                id="garage-servicing-receipts"
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  addReceiptFiles(files);
                  event.currentTarget.value = '';
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="garage-servicing-notes">Notes</Label>
              <Input ref={notesInputRef} id="garage-servicing-notes" value={formState.notes} onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Optional" />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={dialogBusy}>Cancel</Button>
            <Button data-dialog-confirm="true" type="button" onClick={() => { void submit(); }} disabled={dialogBusy}>{dialogBusy ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addServiceDialogOpen} onOpenChange={(open) => !addServiceBusy && setAddServiceDialogOpen(open)}>
        <DialogContent className="max-w-lg rounded-lg">
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="garage-servicing-add-service-name">Name</Label>
              <Input
                id="garage-servicing-add-service-name"
                value={addServiceName}
                onChange={(event) => setAddServiceName(event.target.value)}
                placeholder="Oil Change"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={addServiceType} onValueChange={(value) => setAddServiceType(value as GarageServiceType)}>
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
                <Label htmlFor="garage-servicing-add-service-miles">Every (Miles)</Label>
                <Input
                  id="garage-servicing-add-service-miles"
                  type="number"
                  value={addServiceMiles}
                  onChange={(event) => setAddServiceMiles(event.target.value)}
                  placeholder="10,000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-servicing-add-service-months">Every (Months)</Label>
                <Input
                  id="garage-servicing-add-service-months"
                  type="number"
                  value={addServiceMonths}
                  onChange={(event) => setAddServiceMonths(event.target.value)}
                  placeholder="12"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="garage-servicing-add-service-notes">Notes</Label>
              <Input
                id="garage-servicing-add-service-notes"
                value={addServiceNotes}
                onChange={(event) => setAddServiceNotes(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddServiceDialogOpen(false)} disabled={addServiceBusy}>Cancel</Button>
            <Button data-dialog-confirm="true" type="button" onClick={() => { void submitAddService(); }} disabled={addServiceBusy}>{addServiceBusy ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
