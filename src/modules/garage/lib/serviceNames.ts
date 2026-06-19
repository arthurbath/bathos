import type { GarageService } from '@/modules/garage/types/garage';

export const GARAGE_SERVICE_NAME_REQUIRED_ERROR = 'Name is required.';

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
    return GARAGE_SERVICE_NAME_REQUIRED_ERROR;
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
