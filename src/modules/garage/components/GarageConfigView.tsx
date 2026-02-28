import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Pencil, Trash2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { GarageUserSettings, GarageVehicle } from '@/modules/garage/types/garage';

interface GarageConfigViewProps {
  vehicles: GarageVehicle[];
  activeVehicleId: string | null;
  settings: GarageUserSettings | null;
  autoOpenAddVehicle?: boolean;
  onSetActiveVehicle: (vehicleId: string) => void;
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

function parseDateInputValue(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function toDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function GarageConfigView({
  vehicles,
  activeVehicleId,
  settings,
  autoOpenAddVehicle = false,
  onSetActiveVehicle,
  onAddVehicle,
  onUpdateVehicle,
  onRemoveVehicle,
  onUpdateSettings,
}: GarageConfigViewProps) {
  const [settingsMiles, setSettingsMiles] = useState(String(settings?.upcoming_miles_default ?? 1000));
  const [settingsDays, setSettingsDays] = useState(String(settings?.upcoming_days_default ?? 60));
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>(emptyVehicleState());
  const [inServicePickerOpen, setInServicePickerOpen] = useState(false);
  const [hasAutoOpenedModal, setHasAutoOpenedModal] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<GarageVehicle | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const activeVehicleName = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === activeVehicleId)?.name ?? 'None',
    [activeVehicleId, vehicles],
  );

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
    setSettingsSaving(true);
    try {
      await onUpdateSettings({
        upcoming_miles_default: Math.max(0, Number(settingsMiles) || 0),
        upcoming_days_default: Math.max(0, Number(settingsDays) || 0),
      });
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
    if (!autoOpenAddVehicle) return;
    if (vehicles.length !== 0) return;
    if (formOpen) return;
    if (hasAutoOpenedModal) return;

    openAddVehicle();
    setHasAutoOpenedModal(true);
  }, [autoOpenAddVehicle, formOpen, hasAutoOpenedModal, openAddVehicle, vehicles.length]);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Due Thresholds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="garage-upcoming-miles">Upcoming Miles</Label>
              <Input id="garage-upcoming-miles" type="number" value={settingsMiles} onChange={(event) => setSettingsMiles(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garage-upcoming-days">Upcoming Days</Label>
              <Input id="garage-upcoming-days" type="number" value={settingsDays} onChange={(event) => setSettingsDays(event.target.value)} />
            </div>
          </div>
          <Button type="button" onClick={() => { void saveSettings(); }} disabled={settingsSaving}>{settingsSaving ? 'Saving…' : 'Save Thresholds'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Vehicles</CardTitle>
          <Button type="button" size="sm" onClick={openAddVehicle}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Active vehicle: {activeVehicleName}</p>
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vehicles yet.</p>
          ) : (
            <div className="space-y-2">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{vehicle.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(vehicle.make ?? 'Unknown make')} {(vehicle.model ?? 'Unknown model')} {vehicle.model_year ? `(${vehicle.model_year})` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">Mileage: {vehicle.current_odometer_miles.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={vehicle.id === activeVehicleId ? 'default' : 'outline'}
                      onClick={() => onSetActiveVehicle(vehicle.id)}
                    >
                      {vehicle.id === activeVehicleId ? 'Active' : 'Set Active'}
                    </Button>
                    <Button type="button" size="icon" variant="outline" onClick={() => openEditVehicle(vehicle)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="outline-destructive" onClick={() => setDeleteTarget(vehicle)}>
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
                <Popover open={inServicePickerOpen} onOpenChange={setInServicePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="garage-vehicle-date"
                      type="button"
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !vehicleForm.in_service_date && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {vehicleForm.in_service_date
                        ? format(parseDateInputValue(vehicleForm.in_service_date) ?? new Date(`${vehicleForm.in_service_date}T00:00:00`), 'MMMM d, yyyy')
                        : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseDateInputValue(vehicleForm.in_service_date)}
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
