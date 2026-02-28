import { useMemo } from 'react';
import { computeDueItems } from '@/modules/garage/lib/dueMath';
import type {
  GarageDueItem,
  GarageService,
  GarageServicingWithRelations,
  GarageUserSettings,
  GarageVehicle,
} from '@/modules/garage/types/garage';

export function useGarageDue(args: {
  services: GarageService[];
  servicings: GarageServicingWithRelations[];
  vehicle: GarageVehicle | null;
  settings: GarageUserSettings | null;
}) {
  const { services, servicings, vehicle, settings } = args;

  const dueItems = useMemo<GarageDueItem[]>(() => {
    if (!vehicle) return [];

    return computeDueItems({
      services,
      servicings,
      vehicle,
      defaults: {
        upcomingMiles: settings?.upcoming_miles_default ?? 1000,
        upcomingDays: settings?.upcoming_days_default ?? 60,
      },
    }).sort((a, b) => {
      const bucketOrder = {
        past_due: 0,
        due_now: 1,
        upcoming: 2,
        not_due: 3,
        excluded_no_interval: 4,
      } as const;

      const bucketDiff = bucketOrder[a.bucket] - bucketOrder[b.bucket];
      if (bucketDiff !== 0) return bucketDiff;

      const milesA = a.remainingMiles ?? Number.MAX_SAFE_INTEGER;
      const milesB = b.remainingMiles ?? Number.MAX_SAFE_INTEGER;
      if (milesA !== milesB) return milesA - milesB;

      const daysA = a.daysUntilDue ?? Number.MAX_SAFE_INTEGER;
      const daysB = b.daysUntilDue ?? Number.MAX_SAFE_INTEGER;
      if (daysA !== daysB) return daysA - daysB;

      return a.service.name.localeCompare(b.service.name);
    });
  }, [services, servicings, settings?.upcoming_days_default, settings?.upcoming_miles_default, vehicle]);

  const grouped = useMemo(
    () => ({
      due: dueItems.filter((item) => item.bucket === 'past_due' || item.bucket === 'due_now'),
      upcoming: dueItems.filter((item) => item.bucket === 'upcoming'),
      notDue: dueItems.filter((item) => item.bucket === 'not_due'),
      excluded: dueItems.filter((item) => item.bucket === 'excluded_no_interval'),
    }),
    [dueItems],
  );

  return {
    dueItems,
    grouped,
  };
}
