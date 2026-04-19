import type { GarageServiceType } from '@/modules/garage/types/garage';

export const GARAGE_SERVICE_TYPE_OPTIONS: Array<{ value: GarageServiceType; label: string }> = [
  { value: 'replacement', label: 'Replacement' },
  { value: 'clean_lube', label: 'Clean/Lube' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'check', label: 'Check' },
];

export const GARAGE_EMPTY_SERVICE_TYPE_LABEL = '—';

export function getGarageServiceTypeLabel(value: GarageServiceType | null): string {
  if (value === null) return GARAGE_EMPTY_SERVICE_TYPE_LABEL;
  return GARAGE_SERVICE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
