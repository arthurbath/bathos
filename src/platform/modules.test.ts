import { describe, expect, it } from 'vitest';
import { getAvailableModules } from '@/platform/modules';

describe('getAvailableModules', () => {
  it('returns non-admin modules for non-admin users', () => {
    const modules = getAvailableModules({ isAdmin: false });

    expect(modules).toHaveLength(3);
    expect(modules.map(module => module.id)).toEqual(['budget', 'drawers', 'garage']);
    expect(modules[0].launchPath).toBe('/budget/summary');
    expect(modules[1].launchPath).toBe('/drawers/plan');
    expect(modules[2].launchPath).toBe('/garage/due');
  });

  it('includes garage for admins', () => {
    const modules = getAvailableModules({ isAdmin: true });

    expect(modules).toHaveLength(5);
    expect(modules.map(module => module.id)).toEqual(['budget', 'drawers', 'garage', 'exercise', 'admin']);
    expect(modules[2].launchPath).toBe('/garage/due');
    expect(modules[3].launchPath).toBe('/exercise/routines');
    expect(modules[4].launchPath).toBe('/admin');
  });
});
