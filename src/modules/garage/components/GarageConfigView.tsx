import { useCallback, useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DataGrid, GridEditableCell, GRID_NULL_PLACEHOLDER, gridMenuTriggerProps, gridNavProps, useDataGrid } from '@/components/ui/data-grid';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CalendarIcon, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { GARAGE_VEHICLES_GRID_DEFAULT_WIDTHS, GRID_FIXED_COLUMNS } from '@/lib/gridColumnWidths';
import { cn } from '@/lib/utils';
import type { GarageUserSettings, GarageVehicle } from '@/modules/garage/types/garage';

const columnHelper = createColumnHelper<GarageVehicle>();
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';
const VEHICLE_ACTIONS_NAV_COL = 6;
const VEHICLE_MODEL_YEAR_MIN = 1900;
const VEHICLE_MODEL_YEAR_MAX = 2200;

interface GarageConfigViewProps {
  vehicles: GarageVehicle[];
  settings: GarageUserSettings | null;
  autoOpenAddVehicle?: boolean;
  onAddVehicle: (input: {
    name: string;
    make?: string | null;
    model?: string | null;
    model_year?: number | null;
    in_service_date?: string | null;
    current_odometer_miles?: number;
    is_active?: boolean;
  }) => Promise<void>;
  onUpdateVehicle: (id: string, updates: Partial<Omit<GarageVehicle, 'id' | 'user_id' | 'created_at'>>) => Promise<void>;
  onRemoveVehicle: (id: string) => Promise<void>;
  onUpdateSettings: (updates: Partial<Pick<GarageUserSettings, 'upcoming_days_default' | 'upcoming_miles_default'>>) => Promise<void>;
}

interface VehicleFormState {
  id: string | null;
  name: string;
  make: string;
  model: string;
  model_year: string;
  in_service_date: string;
  current_odometer_miles: string;
  is_active: boolean;
}

const DAYS_PER_MONTH = 30;

function emptyVehicleState(): VehicleFormState {
  return {
    id: null,
    name: '',
    make: '',
    model: '',
    model_year: '',
    in_service_date: '',
    current_odometer_miles: '',
    is_active: true,
  };
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

function formatDaysAsMonths(days: number): string {
  const months = days / DAYS_PER_MONTH;
  return Number.isInteger(months) ? String(months) : months.toFixed(1).replace(/\.0$/, '');
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

function normalizeVehicleName(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}

function parseVehicleModelYear(value: string): { status: 'empty' | 'invalid' | 'valid'; value: number | null } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { status: 'empty', value: null };
  }

  const parsed = toNumberOrNull(trimmed);
  if (
    parsed === null
    || parsed < VEHICLE_MODEL_YEAR_MIN
    || parsed > VEHICLE_MODEL_YEAR_MAX
  ) {
    return { status: 'invalid', value: null };
  }

  return { status: 'valid', value: parsed };
}

function normalizeVehicleModelYear(value: string, fallback: number | null): number | null {
  const parsed = parseVehicleModelYear(value);
  return parsed.status === 'valid' ? parsed.value : fallback;
}

function normalizeVehicleModelYearInput(value: string, fallback: number | null): string {
  const normalized = normalizeVehicleModelYear(value, fallback);
  return normalized == null ? '' : String(normalized);
}

function showVehicleModelYearRangeToast() {
  toast({
    title: 'Invalid model year',
    description: `Model year must be between ${VEHICLE_MODEL_YEAR_MIN} and ${VEHICLE_MODEL_YEAR_MAX}.`,
    variant: 'destructive',
  });
}

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeNonNegativeNumber(value: string): number {
  return Math.max(0, toNumberOrNull(value) ?? 0);
}

function isDeleteResetKey(event: Pick<React.KeyboardEvent<HTMLElement>, 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>) {
  return (
    (event.key === 'Backspace' || event.key === 'Delete')
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
  );
}

function VehicleDateCell({
  value,
  navCol,
  onChange,
}: {
  value: string | null;
  navCol: number;
  onChange: (value: string | null) => void | Promise<unknown>;
}) {
  const ctx = useDataGrid();
  const [open, setOpen] = useState(false);
  const parsedDate = parseDateInputValue(value ?? '');
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => getCalendarMonthForDateInput(value ?? ''));

  useEffect(() => {
    if (!open) return;
    setVisibleMonth(getCalendarMonthForDateInput(value ?? ''));
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
            if (value && isDeleteResetKey(event)) {
              event.preventDefault();
              ctx?.onCellCommit(navCol);
              void onChange(null);
              return;
            }
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
          <span className="truncate">{parsedDate ? format(parsedDate, 'MMM d, yyyy') : GRID_NULL_PLACEHOLDER}</span>
          <CalendarIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-foreground opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(event) => event.preventDefault()}>
        <Calendar
          mode="single"
          selected={parsedDate}
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          onSelect={(date) => {
            const nextValue = date ? toDateInputValue(date) : null;
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

function VehicleActionsCell({
  vehicle,
  onDelete,
}: {
  vehicle: GarageVehicle;
  onDelete: (vehicle: GarageVehicle) => void;
}) {
  const ctx = useDataGrid();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={`float-right mr-[5px] h-7 w-7 ${GRID_CONTROL_FOCUS_CLASS}`}
          aria-label={`Actions for ${vehicle.name}`}
          {...gridMenuTriggerProps(ctx, VEHICLE_ACTIONS_NAV_COL)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(vehicle)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GarageConfigView({
  vehicles,
  settings,
  autoOpenAddVehicle = false,
  onAddVehicle,
  onUpdateVehicle,
  onRemoveVehicle,
  onUpdateSettings,
}: GarageConfigViewProps) {
  const initialMiles = Math.max(0, settings?.upcoming_miles_default ?? 1000);
  const initialDays = Math.max(0, settings?.upcoming_days_default ?? 60);

  const [settingsMiles, setSettingsMiles] = useState(String(initialMiles));
  const [settingsMonths, setSettingsMonths] = useState(formatDaysAsMonths(initialDays));
  const [initialThresholds, setInitialThresholds] = useState(() => ({
    miles: initialMiles,
    days: initialDays,
  }));
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>(emptyVehicleState());
  const [inServicePickerOpen, setInServicePickerOpen] = useState(false);
  const [inServicePickerMonth, setInServicePickerMonth] = useState<Date>(
    () => getCalendarMonthForDateInput(''),
  );
  const [hasAutoOpenedModal, setHasAutoOpenedModal] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<GarageVehicle | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId: vehicles[0]?.user_id ?? settings?.user_id,
    gridKey: 'garage_vehicles',
    defaults: GARAGE_VEHICLES_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.garage_vehicles,
  });

  const openAddVehicle = useCallback(() => {
    setVehicleForm(emptyVehicleState());
    setInServicePickerOpen(false);
    setFormOpen(true);
  }, []);

  const saveVehicle = async () => {
    const isAddingVehicle = !vehicleForm.id;
    const name = vehicleForm.name.trim();
    if (!name) {
      toast({ title: 'Vehicle name required', variant: 'destructive' });
      return;
    }

    const parsedModelYear = parseVehicleModelYear(vehicleForm.model_year);
    if (isAddingVehicle && parsedModelYear.status === 'empty') {
      toast({ title: 'Model year required', variant: 'destructive' });
      return;
    }
    if (parsedModelYear.status === 'invalid') {
      showVehicleModelYearRangeToast();
      return;
    }
    const modelYear = parsedModelYear.value;

    const odometer = Math.max(0, toNumberOrNull(vehicleForm.current_odometer_miles) ?? 0);

    setFormBusy(true);
    try {
      const payload = {
        name,
        make: vehicleForm.make.trim() || null,
        model: vehicleForm.model.trim() || null,
        model_year: modelYear,
        in_service_date: vehicleForm.in_service_date || null,
        current_odometer_miles: odometer,
        is_active: vehicleForm.is_active,
      };

      if (vehicleForm.id) {
        await onUpdateVehicle(vehicleForm.id, payload);
      } else {
        await onAddVehicle(payload);
      }

      setFormOpen(false);
      toast({ title: vehicleForm.id ? 'Vehicle updated' : 'Vehicle added' });
    } catch (error) {
      toast({
        title: 'Failed to save vehicle',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setFormBusy(false);
    }
  };

  const saveSettings = async () => {
    const nextMiles = Math.max(0, Number(settingsMiles) || 0);
    const nextDays = Math.max(0, Math.round((Number(settingsMonths) || 0) * DAYS_PER_MONTH));

    setSettingsSaving(true);
    try {
      await onUpdateSettings({
        upcoming_miles_default: nextMiles,
        upcoming_days_default: nextDays,
      });
      setInitialThresholds({ miles: nextMiles, days: nextDays });
      setSettingsMiles(String(nextMiles));
      setSettingsMonths(formatDaysAsMonths(nextDays));
      toast({ title: 'Settings updated' });
    } catch (error) {
      toast({
        title: 'Failed to update settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (vehicles.length > 0) {
      setHasAutoOpenedModal(false);
    }
  }, [vehicles.length]);

  useEffect(() => {
    setInitialThresholds({ miles: initialMiles, days: initialDays });
    setSettingsMiles(String(initialMiles));
    setSettingsMonths(formatDaysAsMonths(initialDays));
  }, [initialDays, initialMiles]);

  useEffect(() => {
    if (!autoOpenAddVehicle) return;
    if (vehicles.length !== 0) return;
    if (formOpen) return;
    if (hasAutoOpenedModal) return;

    openAddVehicle();
    setHasAutoOpenedModal(true);
  }, [autoOpenAddVehicle, formOpen, hasAutoOpenedModal, openAddVehicle, vehicles.length]);

  const thresholdsMiles = Math.max(0, Number(settingsMiles) || 0);
  const thresholdsDays = Math.max(0, Math.round((Number(settingsMonths) || 0) * DAYS_PER_MONTH));
  const thresholdsChanged = thresholdsMiles !== initialThresholds.miles || thresholdsDays !== initialThresholds.days;
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        size: 180,
        minSize: 120,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.name}
            navCol={0}
            normalizeOnCommit={(value) => {
              const normalized = normalizeVehicleName(value, row.original.name);
              if (!value.trim()) {
                toast({ title: 'Name is required', variant: 'destructive' });
              }
              return normalized;
            }}
            onChange={(value) => onUpdateVehicle(row.original.id, { name: normalizeVehicleName(value, row.original.name) })}
          />
        ),
      }),
      columnHelper.accessor((row) => row.make ?? '', {
        id: 'make',
        header: 'Make',
        size: 150,
        minSize: 110,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.make ?? ''}
            navCol={1}
            deleteResetValue=""
            onChange={(value) => onUpdateVehicle(row.original.id, { make: normalizeOptionalText(value) })}
          />
        ),
      }),
      columnHelper.accessor((row) => row.model ?? '', {
        id: 'model',
        header: 'Model',
        size: 150,
        minSize: 90,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.model ?? ''}
            navCol={2}
            deleteResetValue=""
            onChange={(value) => onUpdateVehicle(row.original.id, { model: normalizeOptionalText(value) })}
          />
        ),
      }),
      columnHelper.accessor((row) => row.model_year ?? '', {
        id: 'model_year',
        header: 'Model Year',
        size: 120,
        minSize: 90,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.model_year ?? ''}
            navCol={3}
            type="number"
            inputMode="numeric"
            numberDisplayFormat="plain"
            normalizeOnCommit={(value) => {
              const parsed = parseVehicleModelYear(value);
              if (parsed.status === 'invalid') {
                showVehicleModelYearRangeToast();
              }
              const normalized = normalizeVehicleModelYearInput(value, row.original.model_year);
              if (parsed.status === 'empty') {
                toast({ title: 'Model year is required', variant: 'destructive' });
              }
              return normalized;
            }}
            onChange={(value) => onUpdateVehicle(row.original.id, { model_year: normalizeVehicleModelYear(value, row.original.model_year) })}
          />
        ),
      }),
      columnHelper.accessor((row) => row.in_service_date ?? '', {
        id: 'in_service_date',
        header: 'In-service Date',
        size: 150,
        minSize: 120,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <VehicleDateCell
            value={row.original.in_service_date}
            navCol={4}
            onChange={(value) => onUpdateVehicle(row.original.id, { in_service_date: value })}
          />
        ),
      }),
      columnHelper.accessor('current_odometer_miles', {
        header: 'Current Mileage',
        size: 150,
        minSize: 110,
        meta: { containsEditableInput: true },
        cell: ({ row }) => (
          <GridEditableCell
            value={row.original.current_odometer_miles}
            navCol={5}
            type="number"
            inputMode="decimal"
            deleteResetValue="0"
            normalizeOnCommit={(value) => String(normalizeNonNegativeNumber(value))}
            onChange={(value) => onUpdateVehicle(row.original.id, { current_odometer_miles: normalizeNonNegativeNumber(value) })}
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
          <VehicleActionsCell vehicle={row.original} onDelete={setDeleteTarget} />
        ),
      }),
    ],
    [onUpdateVehicle],
  );
  const table = useReactTable({
    data: vehicles,
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

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Thresholds for <em>Upcoming</em></CardTitle>
          <p className="text-sm text-muted-foreground">
            The mileage and time windows used to mark services as upcoming.
          </p>
        </CardHeader>
        <CardContent data-command-enter-scope="true" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="garage-upcoming-miles">Miles</Label>
              <Input id="garage-upcoming-miles" type="number" inputMode="decimal" value={settingsMiles} onChange={(event) => setSettingsMiles(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garage-upcoming-months">Months</Label>
              <Input id="garage-upcoming-months" type="number" inputMode="decimal" value={settingsMonths} onChange={(event) => setSettingsMonths(event.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button data-command-enter-confirm="true" type="button" onClick={() => { void saveSettings(); }} disabled={settingsSaving || !thresholdsChanged}>{settingsSaving ? 'Saving…' : 'Save'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Vehicles</CardTitle>
          <Button type="button" variant="outline-success" size="sm" className="h-8 w-8 p-0" aria-label="Add vehicle" onClick={openAddVehicle}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden px-0 pb-2.5">
          <div className="min-w-0 overflow-hidden">
            <DataGrid
              table={table}
              maxHeight="none"
              emptyMessage={vehicles.length === 0 ? 'No vehicles yet.' : 'No vehicles'}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (formBusy) return;
          setFormOpen(open);
        }}
      >
        <DialogContent className="max-w-lg rounded-lg">
          <DialogHeader>
            <DialogTitle>{vehicleForm.id ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="garage-vehicle-name">Name</Label>
              <Input id="garage-vehicle-name" value={vehicleForm.name} onChange={(event) => setVehicleForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="garage-vehicle-make">Make</Label>
                <Input id="garage-vehicle-make" value={vehicleForm.make} onChange={(event) => setVehicleForm((prev) => ({ ...prev, make: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-vehicle-model">Model</Label>
                <Input id="garage-vehicle-model" value={vehicleForm.model} onChange={(event) => setVehicleForm((prev) => ({ ...prev, model: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="garage-vehicle-year">Model Year</Label>
                <Input id="garage-vehicle-year" type="number" inputMode="numeric" required={!vehicleForm.id} value={vehicleForm.model_year} onChange={(event) => setVehicleForm((prev) => ({ ...prev, model_year: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-vehicle-date">In-service Date</Label>
                <Popover
                  open={inServicePickerOpen}
                  onOpenChange={(nextOpen) => {
                    setInServicePickerOpen(nextOpen);
                    if (nextOpen) {
                      setInServicePickerMonth(getCalendarMonthForDateInput(vehicleForm.in_service_date));
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="garage-vehicle-date"
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-10 w-full justify-start rounded-md border-[hsl(var(--grid-sticky-line))] bg-background px-3 py-2 text-left text-base font-normal text-foreground hover:bg-background hover:text-foreground md:text-sm',
                        !vehicleForm.in_service_date && 'text-muted-foreground',
                      )}
                    >
                      <span className="truncate">{vehicleForm.in_service_date
                        ? format(parseDateInputValue(vehicleForm.in_service_date) ?? new Date(`${vehicleForm.in_service_date}T00:00:00`), 'MMMM d, yyyy')
                        : ''}</span>
                      <CalendarIcon className="ml-auto h-4 w-4 shrink-0 text-foreground opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseDateInputValue(vehicleForm.in_service_date)}
                      month={inServicePickerMonth}
                      onMonthChange={setInServicePickerMonth}
                      onSelect={(date) => {
                        setVehicleForm((prev) => ({ ...prev, in_service_date: date ? toDateInputValue(date) : '' }));
                        setInServicePickerOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-vehicle-odo">Current Mileage</Label>
                <Input id="garage-vehicle-odo" type="number" inputMode="decimal" value={vehicleForm.current_odometer_miles} onChange={(event) => setVehicleForm((prev) => ({ ...prev, current_odometer_miles: event.target.value }))} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={formBusy}>Cancel</Button>
            <Button data-dialog-confirm="true" type="button" onClick={() => { void saveVehicle(); }} disabled={formBusy}>{formBusy ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {deleteTarget?.name ?? 'this vehicle'} and all related services, servicings, and receipts?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBusy || !deleteTarget}
              onClick={() => {
                if (!deleteTarget) return;
                setDeleteBusy(true);
                void onRemoveVehicle(deleteTarget.id)
                  .then(() => {
                    toast({ title: 'Vehicle deleted' });
                    setDeleteTarget(null);
                  })
                  .catch((error) => {
                    toast({
                      title: 'Failed to delete vehicle',
                      description: error instanceof Error ? error.message : 'Unknown error',
                      variant: 'destructive',
                    });
                  })
                  .finally(() => setDeleteBusy(false));
              }}
            >
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
