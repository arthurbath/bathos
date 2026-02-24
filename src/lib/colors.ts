export const COLOR_SWATCHES = [
  { value: '#b91c1c', slug: 'deep-crimson', label: 'Deep Crimson' },
  { value: '#c2410c', slug: 'burnt-orange', label: 'Burnt Orange' },
  { value: '#b45309', slug: 'antique-gold', label: 'Antique Gold' },
  { value: '#15803d', slug: 'forest-green', label: 'Forest Green' },
  { value: '#0e7490', slug: 'ocean-cyan', label: 'Ocean Cyan' },
  { value: '#1d4ed8', slug: 'cobalt-blue', label: 'Cobalt Blue' },
  { value: '#4338ca', slug: 'midnight-indigo', label: 'Midnight Indigo' },
  { value: '#6d28d9', slug: 'deep-violet', label: 'Deep Violet' },
  { value: '#be185d', slug: 'berry-magenta', label: 'Berry Magenta' },
  { value: '#374151', slug: 'slate-gray', label: 'Slate Gray' },
] as const;

export const COLOR_PALETTE = COLOR_SWATCHES.map((swatch) => swatch.value) as readonly string[];

export const COLOR_LABELS: Record<string, string> = Object.fromEntries(
  COLOR_SWATCHES.map((swatch) => [swatch.value, swatch.label]),
);

export const COLOR_SLUGS: Record<string, string> = Object.fromEntries(
  COLOR_SWATCHES.map((swatch) => [swatch.value, swatch.slug]),
);

const LEGACY_TO_CURRENT_COLOR: Record<string, string> = {
  '#fecaca': '#b91c1c',
  '#fca5a5': '#b91c1c',
  '#fed7aa': '#c2410c',
  '#fdba74': '#c2410c',
  '#fde68a': '#b45309',
  '#fcd34d': '#b45309',
  '#bbf7d0': '#15803d',
  '#86efac': '#15803d',
  '#a5f3fc': '#0e7490',
  '#5eead4': '#0e7490',
  '#bfdbfe': '#1d4ed8',
  '#7dd3fc': '#1d4ed8',
  '#c7d2fe': '#4338ca',
  '#93c5fd': '#4338ca',
  '#ddd6fe': '#6d28d9',
  '#ede9fe': '#6d28d9',
  '#a78bfa': '#6d28d9',
  '#fbcfe8': '#be185d',
  '#f0abfc': '#be185d',
  '#e5e7eb': '#374151',
  '#9ca3af': '#374151',
};

export function normalizePaletteColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const normalized = color.toLowerCase();
  return LEGACY_TO_CURRENT_COLOR[normalized] ?? normalized;
}
