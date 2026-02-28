import { useEffect, useMemo, useState } from 'react';
import { CarFront, ClipboardCheck, ListChecks, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';
import { useGarageVehicles } from '@/modules/garage/hooks/useGarageVehicles';
import { useGarageServices } from '@/modules/garage/hooks/useGarageServices';
import { useGarageServicings } from '@/modules/garage/hooks/useGarageServicings';
import { useGarageDue } from '@/modules/garage/hooks/useGarageDue';
import { GarageDueView } from '@/modules/garage/components/GarageDueView';
import { GarageServicesGrid } from '@/modules/garage/components/GarageServicesGrid';
import { GarageServicingsGrid } from '@/modules/garage/components/GarageServicingsGrid';
import { GarageConfigView } from '@/modules/garage/components/GarageConfigView';
import { handleClientSideLinkNavigation } from '@/lib/navigation';

interface GarageShellProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
}

const SELECTED_VEHICLE_KEY = 'garage_selected_vehicle_id';

export function GarageShell({ userId, displayName, onSignOut }: GarageShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = useModuleBasePath();

  const navItems = [
    { path: '/due', label: 'Due', icon: ListChecks },
    { path: '/services', label: 'Services', icon: ClipboardCheck },
    { path: '/servicings', label: 'Servicings', icon: CarFront },
    { path: '/config', label: 'Config', icon: Settings },
  ] as const;

  const {
    vehicles,
    settings,
    activeVehicle,
    loading: vehiclesLoading,
    addVehicle,
    updateVehicle,
    removeVehicle,
    upsertSettings,
  } = useGarageVehicles(userId);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = window.localStorage.getItem(SELECTED_VEHICLE_KEY);
    if (cached) {
      setSelectedVehicleId(cached);
    }
  }, []);

  useEffect(() => {
    if (vehicles.length === 0) {
      setSelectedVehicleId(null);
      return;
    }

    const selectedExists = selectedVehicleId && vehicles.some((vehicle) => vehicle.id === selectedVehicleId);
    if (selectedExists) return;

    const fallback = activeVehicle?.id ?? vehicles[0].id;
    setSelectedVehicleId(fallback);
  }, [activeVehicle?.id, selectedVehicleId, vehicles]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedVehicleId) {
      window.localStorage.setItem(SELECTED_VEHICLE_KEY, selectedVehicleId);
    } else {
      window.localStorage.removeItem(SELECTED_VEHICLE_KEY);
    }
  }, [selectedVehicleId]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId, vehicles],
  );

  const {
    services,
    loading: servicesLoading,
    addService,
    updateService,
    removeService,
  } = useGarageServices(userId, selectedVehicle?.id);

  const {
    servicings,
    loading: servicingsLoading,
    addServicing,
    updateServicing,
    removeServicing,
    removeReceipt,
    createReceiptSignedUrl,
  } = useGarageServicings(userId, selectedVehicle?.id);

  const { grouped } = useGarageDue({
    services,
    servicings,
    vehicle: selectedVehicle,
    settings,
  });

  const isDueRoute = location.pathname.endsWith('/due') || location.pathname === `${basePath}` || location.pathname === `${basePath}/`;
  const isServicesRoute = location.pathname.endsWith('/services');
  const isServicingsRoute = location.pathname.endsWith('/servicings');
  const isConfigRoute = location.pathname.endsWith('/config');
  const isFullViewGridRoute = isServicesRoute || isServicingsRoute;

  useEffect(() => {
    if (location.pathname === '/garage' || location.pathname === '/garage/') {
      navigate(`${basePath}/due`, { replace: true });
    }
  }, [basePath, location.pathname, navigate]);

  useEffect(() => {
    if (vehiclesLoading) return;
    if (vehicles.length !== 0) return;
    if (isConfigRoute) return;
    navigate(`${basePath}/config`, { replace: true });
  }, [basePath, isConfigRoute, navigate, vehicles.length, vehiclesLoading]);

  const handleOpenReceipt = async (storagePath: string) => {
    const signedUrl = await createReceiptSignedUrl(storagePath);
    window.open(signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSetActiveVehicle = async (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);

    try {
      const updates = vehicles.map((vehicle) =>
        updateVehicle(vehicle.id, { is_active: vehicle.id === vehicleId }),
      );
      await Promise.all(updates);
    } catch (error) {
      toast({
        title: 'Failed to update active vehicle',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (vehiclesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={`relative isolate bg-background ${isFullViewGridRoute ? 'h-dvh overflow-y-hidden overflow-x-visible flex flex-col' : 'min-h-screen pb-24 md:pb-4'}`}>
      <ToplineHeader
        title="Garage"
        userId={userId}
        displayName={displayName}
        onSignOut={onSignOut}
        showAppSwitcher
      />

      <div className="mx-auto hidden w-full max-w-5xl px-4 pt-6 md:block">
        <nav className="hidden w-full grid-cols-4 gap-0.5 rounded-lg border border-[hsl(var(--grid-sticky-line))] bg-[hsl(var(--switch-off))] p-1 text-muted-foreground md:grid">
          {navItems.map(({ path, label, icon: Icon }) => {
            const fullPath = `${basePath}${path}`;
            const active = location.pathname === fullPath || location.pathname === path;
            return (
              <a
                key={path}
                href={fullPath}
                onClick={(event) => handleClientSideLinkNavigation(event, navigate, fullPath)}
                className={`inline-flex items-center justify-center gap-0 sm:gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${active ? 'bg-background text-foreground' : 'text-foreground hover:bg-background/50'}`}
              >
                <Icon className="hidden h-4 w-4 sm:inline" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      <main className={isFullViewGridRoute ? 'flex w-full flex-1 min-h-0 flex-col gap-4 pt-0 pb-[calc(env(safe-area-inset-bottom)+3.75rem)] md:pt-6 md:pb-0' : 'mx-auto max-w-5xl space-y-4 px-4 py-4 md:py-6'}>
        {vehicles.length > 1 && (
          <div className={isFullViewGridRoute ? 'mx-auto w-full max-w-5xl px-4' : ''}>
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 pt-6">
                <Select
                  value={selectedVehicle?.id ?? ''}
                  onValueChange={(value) => {
                    void handleSetActiveVehicle(value);
                  }}
                >
                  <SelectTrigger className="w-full md:w-[320px]">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isConfigRoute && (
                  <Button asChild type="button" variant="outline">
                    <a
                      href={`${basePath}/config`}
                      onClick={(event) => handleClientSideLinkNavigation(event, navigate, `${basePath}/config`)}
                    >
                      Configure
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedVehicle && !isConfigRoute ? (
          <div className={isFullViewGridRoute ? 'mx-auto w-full max-w-5xl px-4' : ''}>
            <Card>
              <CardContent className="space-y-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">Create a vehicle in Config before tracking services.</p>
                <Button asChild type="button">
                  <a
                    href={`${basePath}/config`}
                    onClick={(event) => handleClientSideLinkNavigation(event, navigate, `${basePath}/config`)}
                  >
                    Go to Config
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {isDueRoute && selectedVehicle && <GarageDueView grouped={grouped} />}
            {isServicesRoute && selectedVehicle && (
              <div className="flex-1 min-h-0">
                <GarageServicesGrid
                  userId={userId}
                  services={services}
                  servicings={servicings}
                  loading={servicesLoading}
                  vehicleName={selectedVehicle.name}
                  fullView
                  onAddService={addService}
                  onUpdateService={updateService}
                  onDeleteService={removeService}
                />
              </div>
            )}
            {isServicingsRoute && selectedVehicle && (
              <div className="flex-1 min-h-0">
                <GarageServicingsGrid
                  userId={userId}
                  services={services}
                  servicings={servicings}
                  loading={servicingsLoading}
                  vehicleName={selectedVehicle.name}
                  fullView
                  onAddServicing={addServicing}
                  onUpdateServicing={updateServicing}
                  onDeleteServicing={removeServicing}
                  onOpenReceipt={handleOpenReceipt}
                  onDeleteReceipt={removeReceipt}
                />
              </div>
            )}
            {isConfigRoute && (
              <GarageConfigView
                vehicles={vehicles}
                activeVehicleId={selectedVehicle?.id ?? null}
                settings={settings}
                autoOpenAddVehicle={vehicles.length === 0}
                onSetActiveVehicle={(vehicleId) => {
                  void handleSetActiveVehicle(vehicleId);
                }}
                onAddVehicle={addVehicle}
                onUpdateVehicle={updateVehicle}
                onRemoveVehicle={removeVehicle}
                onUpdateSettings={upsertSettings}
              />
            )}
          </>
        )}
      </main>

      <MobileBottomNav
        items={navItems}
        isActive={(path) => location.pathname.endsWith(path)}
        hrefForPath={(path) => `${basePath}${path}`}
        onNavigate={(path) => navigate(`${basePath}${path}`)}
      />
    </div>
  );
}
