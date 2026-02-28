import { describe, expect, it } from 'vitest';
import { getAvailableModules } from '@/platform/modules';

describe('getAvailableModules', () => {
  it('returns non-admin modules for non-admin users', () => {
    const modules = getAvailableModules({ isAdmin: false });

    expect(modules).toHaveLength(2);
    expect(modules.map(module => module.id)).toEqual(['budget', 'drawers']);
    expect(modules[0].launchPath).toBe('/budget/summary');
    expect(modules[1].launchPath).toBe('/drawers/plan');
  });

  it('includes garage for admins', () => {
    const modules = getAvailableModules({ isAdmin: true });

    expect(modules).toHaveLength(3);
    expect(modules.map(module => module.id)).toEqual(['budget', 'drawers', 'garage']);
    expect(modules[2].launchPath).toBe('/garage/due');
  });
});
