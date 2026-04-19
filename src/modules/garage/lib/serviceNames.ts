import type { GarageService } from '@/modules/garage/types/garage';

export function trimGarageServiceName(value: string) {
  return value.trim();
}

export function normalizeGarageServiceName(value: string) {
  return trimGarageServiceName(value).toLocaleLowerCase();
}

export function validateGarageServiceName(
  rawValue: string,
  services: Pick<GarageService, 'id' | 'name'>[],
  excludedServiceId?: string,
) {
  const trimmed = trimGarageServiceName(rawValue);
  if (!trimmed) {
    return 'Name is required.';
  }

  const normalized = normalizeGarageServiceName(trimmed);
  const duplicate = services.find((service) => (
    service.id !== excludedServiceId && normalizeGarageServiceName(service.name) === normalized
  ));

  if (duplicate) {
    return 'Name must be unique for this vehicle.';
  }

  return null;
}
