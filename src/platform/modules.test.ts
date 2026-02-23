import { describe, expect, it } from 'vitest';
import { getAvailableModules } from '@/platform/modules';

describe('getAvailableModules', () => {
  it('returns budget and drawers for all users', () => {
    const modules = getAvailableModules();

    expect(modules).toHaveLength(2);
    expect(modules.map(module => module.id)).toEqual(['budget', 'drawers']);
    expect(modules[0].launchPath).toBe('/budget/summary');
    expect(modules[1].launchPath).toBe('/drawers/plan');
  });
});
