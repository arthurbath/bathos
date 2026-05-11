import { COLOR_SWATCHES, normalizePaletteColor } from '@/lib/colors';
import type { WardrobeCategory, WardrobeStatus } from '@/modules/wardrobe/types/wardrobe';

type PaletteColorSlug = (typeof COLOR_SWATCHES)[number]['slug'];

const WARDROBE_STATUS_COLOR_SLUGS: Partial<Record<WardrobeStatus, PaletteColorSlug>> = {
  needs_modulation: 'antique-gold',
  endangered: 'antique-gold',
  seeking_replacement: 'antique-gold',
  pending_removal: 'antique-gold',
  costume: 'deep-violet',
  removed: 'deep-crimson',
};

function getPaletteColorBySlug(slug: PaletteColorSlug | undefined): string | null {
  if (!slug) return null;
  return normalizePaletteColor(COLOR_SWATCHES.find((swatch) => swatch.slug === slug)?.value);
}

export const WARDROBE_CATEGORY_OPTIONS: Array<{ value: WardrobeCategory; label: string }> = [
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'underwear', label: 'Underwear' },
  { value: 'accessories', label: 'Accessories' },
];

export const WARDROBE_STATUS_OPTIONS: Array<{ value: WardrobeStatus; label: string; color: string | null }> = [
  { value: 'active', label: 'Active', color: getPaletteColorBySlug(WARDROBE_STATUS_COLOR_SLUGS.active) },
  { value: 'needs_modulation', label: 'Needs Modulation', color: getPaletteColorBySlug(WARDROBE_STATUS_COLOR_SLUGS.needs_modulation) },
  { value: 'endangered', label: 'Endangered', color: getPaletteColorBySlug(WARDROBE_STATUS_COLOR_SLUGS.endangered) },
  { value: 'seeking_replacement', label: 'Seeking Replacement', color: getPaletteColorBySlug(WARDROBE_STATUS_COLOR_SLUGS.seeking_replacement) },
  { value: 'pending_removal', label: 'Pending Removal', color: getPaletteColorBySlug(WARDROBE_STATUS_COLOR_SLUGS.pending_removal) },
  { value: 'costume', label: 'Costume', color: getPaletteColorBySlug(WARDROBE_STATUS_COLOR_SLUGS.costume) },
  { value: 'removed', label: 'Removed', color: getPaletteColorBySlug(WARDROBE_STATUS_COLOR_SLUGS.removed) },
];

export const WARDROBE_EMPTY_CATEGORY_LABEL = '—';
export const WARDROBE_EMPTY_STATUS_LABEL = '—';

export function getWardrobeCategoryLabel(value: WardrobeCategory | null): string {
  if (value === null) return WARDROBE_EMPTY_CATEGORY_LABEL;
  return WARDROBE_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getWardrobeStatusLabel(value: WardrobeStatus | null): string {
  if (value === null) return WARDROBE_EMPTY_STATUS_LABEL;
  return WARDROBE_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getWardrobeStatusColor(value: WardrobeStatus | null): string | null {
  if (value === null) return null;
  return WARDROBE_STATUS_OPTIONS.find((option) => option.value === value)?.color ?? null;
}
