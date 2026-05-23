import { describe, expect, it } from 'vitest';
import { getAvailableModules } from '@/platform/modules';

describe('getAvailableModules', () => {
  it('returns non-admin modules for non-admin users', () => {
    const modules = getAvailableModules({ isAdmin: false });

    expect(modules).toHaveLength(6);
    expect(modules.map(module => module.id)).toEqual(['budget', 'corpus', 'drawers', 'garage', 'estimator', 'wardrobe']);
    expect(modules[0].launchPath).toBe('/budget/summary');
    expect(modules[1].launchPath).toBe('/corpus/documents');
    expect(modules[2].launchPath).toBe('/drawers/plan');
    expect(modules[3].launchPath).toBe('/garage/due');
    expect(modules[4].launchPath).toBe('/estimator');
    expect(modules[5].launchPath).toBe('/wardrobe/items');
    expect(modules[5].iconPath).toBe('/module-wardrobe.png');
  });

  it('includes admin-only modules for admins', () => {
    const modules = getAvailableModules({ isAdmin: true });

    expect(modules).toHaveLength(8);
    expect(modules.map(module => module.id)).toEqual(['budget', 'corpus', 'drawers', 'garage', 'estimator', 'wardrobe', 'exercise', 'admin']);
    expect(modules[1].launchPath).toBe('/corpus/documents');
    expect(modules[3].launchPath).toBe('/garage/due');
    expect(modules[4].launchPath).toBe('/estimator');
    expect(modules[5].launchPath).toBe('/wardrobe/items');
    expect(modules[5].iconPath).toBe('/module-wardrobe.png');
    expect(modules[6].launchPath).toBe('/exercise/routines');
    expect(modules[7].launchPath).toBe('/admin');
  });
});
