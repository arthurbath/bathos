import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pencil, Trash2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { GarageUserSettings, GarageVehicle } from '@/modules/garage/types/garage';

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

function formatVehicleLabel(vehicle: GarageVehicle): string {
  const year = vehicle.model_year ? String(vehicle.model_year) : 'Unknown year';
  const make = vehicle.make?.trim() || 'Unknown make';
  const model = vehicle.model?.trim() || 'Unknown model';
  return `${year} ${make} ${model}`;
}

function formatVehicleMileage(miles: number): string {
  if (miles >= 10_000) {
    const thousands = miles / 1_000;
    const compact = Number.isInteger(thousands) ? String(thousands) : thousands.toFixed(1).replace(/\.0$/, '');
    return `${compact}k miles`;
  }
  return `${miles.toLocaleString()} miles`;
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

  const openAddVehicle = useCallback(() => {
    setVehicleForm(emptyVehicleState());
    setInServicePickerOpen(false);
    setFormOpen(true);
  }, []);

  const openEditVehicle = (vehicle: GarageVehicle) => {
    setVehicleForm({
      id: vehicle.id,
      name: vehicle.name,
      make: vehicle.make ?? '',
      model: vehicle.model ?? '',
      model_year: vehicle.model_year ? String(vehicle.model_year) : '',
      in_service_date: vehicle.in_service_date ?? '',
      current_odometer_miles: String(vehicle.current_odometer_miles),
      is_active: vehicle.is_active,
    });
    setInServicePickerOpen(false);
    setFormOpen(true);
  };

  const saveVehicle = async () => {
    const name = vehicleForm.name.trim();
    if (!name) {
      toast({ title: 'Vehicle name required', variant: 'destructive' });
      return;
    }

    const modelYear = toNumberOrNull(vehicleForm.model_year);
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

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Thresholds for <em>Upcoming</em></CardTitle>
          <p className="text-sm text-muted-foreground">
            The mileage and time windows used to mark services as upcoming.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="garage-upcoming-miles">Miles</Label>
              <Input id="garage-upcoming-miles" type="number" value={settingsMiles} onChange={(event) => setSettingsMiles(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garage-upcoming-months">Months</Label>
              <Input id="garage-upcoming-months" type="number" value={settingsMonths} onChange={(event) => setSettingsMonths(event.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => { void saveSettings(); }} disabled={settingsSaving || !thresholdsChanged}>{settingsSaving ? 'Saving…' : 'Save'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Vehicles</CardTitle>
          <Button type="button" variant="outline-success" size="sm" className="h-8 w-8 p-0" aria-label="Add vehicle" onClick={openAddVehicle}>
            +
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vehicles yet.</p>
          ) : (
            <div className="space-y-2">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{vehicle.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatVehicleLabel(vehicle)}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatVehicleMileage(vehicle.current_odometer_miles)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openEditVehicle(vehicle)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="outline-destructive" onClick={() => setDeleteTarget(vehicle)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                <Input id="garage-vehicle-year" type="number" value={vehicleForm.model_year} onChange={(event) => setVehicleForm((prev) => ({ ...prev, model_year: event.target.value }))} />
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
                      <CalendarIcon className="ml-auto h-4 w-4 shrink-0" />
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
                <Input id="garage-vehicle-odo" type="number" value={vehicleForm.current_odometer_miles} onChange={(event) => setVehicleForm((prev) => ({ ...prev, current_odometer_miles: event.target.value }))} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={formBusy}>Cancel</Button>
            <Button type="button" onClick={() => { void saveVehicle(); }} disabled={formBusy}>{formBusy ? 'Saving…' : 'Save'}</Button>
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
