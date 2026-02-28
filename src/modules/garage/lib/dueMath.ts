import type {
  GarageDueBucket,
  GarageDueItem,
  GarageService,
  GarageServicingService,
  GarageServicingWithRelations,
  GarageVehicle,
} from '@/modules/garage/types/garage';

interface DueDefaults {
  upcomingMiles: number;
  upcomingDays: number;
}

function toDateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

export function resolveVehicleAnchorDate(vehicle: GarageVehicle): string | null {
  if (vehicle.in_service_date) return vehicle.in_service_date;
  if (vehicle.model_year) return `${vehicle.model_year}-01-01`;
  return null;
}

export function monthDiff(now: Date, earlierDateIso: string): number {
  const from = parseDate(earlierDateIso);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

function addMonths(dateIso: string, months: number): Date {
  const source = parseDate(dateIso);
  const sourceDay = source.getDate();
  const target = new Date(source.getFullYear(), source.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(sourceDay, lastDay));
  return target;
}

function daysDiff(now: Date, laterDate: Date): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(laterDate.getFullYear(), laterDate.getMonth(), laterDate.getDate()).getTime();
  return Math.round((end - start) / 86_400_000);
}

function findLastPerformedOutcome(
  serviceId: string,
  servicings: GarageServicingWithRelations[],
): { serviceDate: string | null; mileage: number | null } {
  let bestDate: string | null = null;
  let bestMileage: number | null = null;

  for (const servicing of servicings) {
    const performed = servicing.outcomes.find(
      (outcome: GarageServicingService) => outcome.service_id === serviceId && outcome.status === 'performed',
    );
    if (!performed) continue;

    if (!bestDate || servicing.service_date > bestDate) {
      bestDate = servicing.service_date;
      bestMileage = servicing.odometer_miles;
    }
  }

  return { serviceDate: bestDate, mileage: bestMileage };
}

export function classifyDueBucket(args: {
  remainingMiles: number | null;
  remainingMonths: number | null;
  daysUntilDue: number | null;
  hasInterval: boolean;
  defaults: DueDefaults;
}): GarageDueBucket {
  const {
    remainingMiles,
    remainingMonths,
    daysUntilDue,
    hasInterval,
    defaults,
  } = args;

  if (!hasInterval) return 'excluded_no_interval';

  const remainingValues = [remainingMiles, remainingMonths].filter((value): value is number => value !== null);

  if (remainingValues.some((value) => value < 0)) return 'past_due';
  if (remainingValues.some((value) => value === 0)) return 'due_now';

  const upcomingByMiles = typeof remainingMiles === 'number' && remainingMiles > 0 && remainingMiles <= defaults.upcomingMiles;
  const upcomingByDays = typeof daysUntilDue === 'number' && daysUntilDue >= 0 && daysUntilDue <= defaults.upcomingDays;

  if (upcomingByMiles || upcomingByDays) return 'upcoming';
  return 'not_due';
}

export function computeDueItems(args: {
  services: GarageService[];
  servicings: GarageServicingWithRelations[];
  vehicle: GarageVehicle;
  defaults: DueDefaults;
  now?: Date;
}): GarageDueItem[] {
  const { services, servicings, vehicle, defaults, now = new Date() } = args;
  const anchorDate = resolveVehicleAnchorDate(vehicle);

  return services.map((service) => {
    const lastPerformed = findLastPerformedOutcome(service.id, servicings);
    const hasInterval = Boolean(service.every_miles || service.every_months);

    const mileageBaseline = lastPerformed.mileage ?? 0;
    const remainingMiles = service.every_miles
      ? service.every_miles - (vehicle.current_odometer_miles - mileageBaseline)
      : null;

    const monthBaseline = lastPerformed.serviceDate ?? anchorDate;
    const remainingMonths = service.every_months && monthBaseline
      ? service.every_months - monthDiff(now, monthBaseline)
      : null;

    const dueMileage = service.every_miles ? mileageBaseline + service.every_miles : null;

    const dueDateValue = service.every_months && monthBaseline
      ? addMonths(monthBaseline, service.every_months)
      : null;
    const dueDate = dueDateValue ? toDateOnlyIso(dueDateValue) : null;
    const daysUntilDue = dueDateValue ? daysDiff(now, dueDateValue) : null;

    const bucket = classifyDueBucket({
      remainingMiles,
      remainingMonths,
      daysUntilDue,
      hasInterval,
      defaults,
    });

    return {
      service,
      bucket,
      lastPerformedDate: lastPerformed.serviceDate,
      lastPerformedMileage: lastPerformed.mileage,
      remainingMiles,
      remainingMonths,
      dueMileage,
      dueDate,
      daysUntilDue,
    };
  });
}
