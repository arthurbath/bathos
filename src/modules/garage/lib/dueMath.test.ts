import { describe, expect, it } from 'vitest';
import { computeDueItems, monthDiff, resolveVehicleAnchorDate } from '@/modules/garage/lib/dueMath';
import type { GarageService, GarageServicingWithRelations, GarageVehicle } from '@/modules/garage/types/garage';

function makeVehicle(overrides?: Partial<GarageVehicle>): GarageVehicle {
  return {
    id: 'vehicle-1',
    user_id: 'user-1',
    name: 'Vehicle',
    make: null,
    model: null,
    model_year: 2013,
    in_service_date: '2016-05-14',
    current_odometer_miles: 111000,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeService(overrides?: Partial<GarageService>): GarageService {
  return {
    id: 'service-1',
    user_id: 'user-1',
    vehicle_id: 'vehicle-1',
    name: 'Oil Change',
    type: 'replacement',
    monitoring: false,
    cadence_type: 'recurring',
    every_miles: 10000,
    every_months: 12,
    sort_order: 1,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeServicing(overrides?: Partial<GarageServicingWithRelations>): GarageServicingWithRelations {
  return {
    id: 'servicing-1',
    user_id: 'user-1',
    vehicle_id: 'vehicle-1',
    service_date: '2025-06-01',
    odometer_miles: 105000,
    shop_name: null,
    notes: null,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    outcomes: [
      {
        id: 'outcome-1',
        user_id: 'user-1',
        vehicle_id: 'vehicle-1',
        servicing_id: 'servicing-1',
        service_id: 'service-1',
        status: 'performed',
        created_at: '2025-06-01T00:00:00Z',
      },
    ],
    receipts: [],
    ...overrides,
  };
}

describe('dueMath', () => {
  it('resolves anchor date from in-service date', () => {
    expect(resolveVehicleAnchorDate(makeVehicle())).toBe('2016-05-14');
  });

  it('falls back to model year when in-service date is missing', () => {
    expect(resolveVehicleAnchorDate(makeVehicle({ in_service_date: null, model_year: 2013 }))).toBe('2013-01-01');
  });

  it('computes month diffs with day-sensitive flooring', () => {
    expect(monthDiff(new Date('2026-02-27T12:00:00Z'), '2025-01-28')).toBe(12);
    expect(monthDiff(new Date('2026-02-27T12:00:00Z'), '2025-01-27')).toBe(13);
  });

  it('marks miles-only service as due_now when remaining miles is zero', () => {
    const service = makeService({ every_months: null, every_miles: 6000 });
    const item = computeDueItems({
      services: [service],
      servicings: [makeServicing({ odometer_miles: 105000 })],
      vehicle: makeVehicle({ current_odometer_miles: 111000 }),
      defaults: { upcomingMiles: 1000, upcomingDays: 60 },
      now: new Date('2026-02-27T12:00:00Z'),
    })[0];

    expect(item.remainingMiles).toBe(0);
    expect(item.bucket).toBe('due_now');
  });

  it('marks service as past_due when either configured dimension is past due', () => {
    const service = makeService({ every_miles: 5000, every_months: 24 });
    const item = computeDueItems({
      services: [service],
      servicings: [makeServicing({ service_date: '2023-01-01', odometer_miles: 90000 })],
      vehicle: makeVehicle({ current_odometer_miles: 111000 }),
      defaults: { upcomingMiles: 1000, upcomingDays: 60 },
      now: new Date('2026-02-27T12:00:00Z'),
    })[0];

    expect(item.bucket).toBe('past_due');
  });

  it('excludes services with no Every values from due buckets', () => {
    const service = makeService({ cadence_type: 'recurring', every_miles: null, every_months: null });
    const item = computeDueItems({
      services: [service],
      servicings: [makeServicing()],
      vehicle: makeVehicle(),
      defaults: { upcomingMiles: 1000, upcomingDays: 60 },
      now: new Date('2026-02-27T12:00:00Z'),
    })[0];

    expect(item.bucket).toBe('excluded_no_interval');
  });

  it('uses vehicle anchor date when no performed history exists', () => {
    const service = makeService({ every_miles: null, every_months: 12 });
    const item = computeDueItems({
      services: [service],
      servicings: [],
      vehicle: makeVehicle({ in_service_date: '2026-01-01' }),
      defaults: { upcomingMiles: 1000, upcomingDays: 60 },
      now: new Date('2026-02-27T12:00:00Z'),
    })[0];

    expect(item.remainingMonths).toBe(11);
    expect(item.bucket).toBe('not_due');
  });
});
