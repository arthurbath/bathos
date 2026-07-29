import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const manifestPaths = [
  'public/manifest.json',
  'public/manifest-admin.json',
  'public/manifest-budget.json',
  'public/manifest-drawers.json',
  'public/manifest-garage.json',
  'public/manifest-snake.json',
  'public/manifest-wardrobe.json',
  'public/admin/manifest.json',
  'public/budget/manifest.json',
  'public/drawers/manifest.json',
  'public/garage/manifest.json',
  'public/snake/manifest.json',
  'public/tasks/manifest.json',
  'public/wardrobe/manifest.json',
] as const;

describe('static BathOS PWA manifests', () => {
  it.each(manifestPaths)('%s uses the canonical dark launch surface', (path) => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as {
      background_color?: string;
      theme_color?: string;
    };

    expect(manifest.background_color).toBe('#0d0d0d');
    expect(manifest.theme_color).toBe('#0d0d0d');
  });
});
