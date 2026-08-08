import { describe, expect, it } from 'vitest';
import { SquareCheckBig } from 'lucide-react';
import { SnakeIcon } from '@/components/icons/SnakeIcon';
import { getAvailableModules } from '@/platform/modules';

describe('getAvailableModules', () => {
  it('returns non-admin modules for non-admin users', () => {
    const modules = getAvailableModules({ isAdmin: false });

    expect(modules).toHaveLength(5);
    expect(modules.map(module => module.id)).toEqual(['budget', 'drawers', 'garage', 'snake', 'wardrobe']);
    expect(modules[0].launchPath).toBe('/budget/summary');
    expect(modules[1].launchPath).toBe('/drawers/plan');
    expect(modules[2].launchPath).toBe('/garage/due');
    expect(modules[3].launchPath).toBe('/snake/weights');
    expect(modules[3].description).toBe('Track the growth of your ball python');
    expect(modules[3].icon).toBe(SnakeIcon);
    expect(modules[3].iconPath).toBe('/module-snake.png');
    expect(modules[4].launchPath).toBe('/wardrobe/items');
    expect(modules[4].iconPath).toBe('/module-wardrobe.png');
  });

  it('includes a restricted module for an explicitly granted non-admin user', () => {
    const modules = getAvailableModules({
      isAdmin: false,
      moduleAccess: { tasks: { isRestricted: true, hasAccess: true } },
    });

    const tasks = modules.find((module) => module.id === 'tasks');
    expect(tasks?.launchPath).toBe('/tasks/today');
    expect(tasks?.description).toBe('Plan and complete personal tasks');
    expect(tasks?.icon).toBe(SquareCheckBig);
    expect(tasks?.restrictedByDefault).toBe(true);
  });

  it('honors a server-managed restriction for any ordinary module', () => {
    const modules = getAvailableModules({
      isAdmin: false,
      moduleAccess: {
        budget: { isRestricted: true, hasAccess: false },
        tasks: { isRestricted: false, hasAccess: true },
      },
    });

    expect(modules.some((module) => module.id === 'budget')).toBe(false);
    expect(modules.some((module) => module.id === 'tasks')).toBe(true);
  });

  it('includes admin-only modules for admins', () => {
    const modules = getAvailableModules({ isAdmin: true });

    expect(modules).toHaveLength(7);
    expect(modules.map(module => module.id)).toEqual(['budget', 'drawers', 'garage', 'snake', 'tasks', 'wardrobe', 'admin']);
    expect(modules[1].launchPath).toBe('/drawers/plan');
    expect(modules[2].launchPath).toBe('/garage/due');
    expect(modules[3].launchPath).toBe('/snake/weights');
    expect(modules[4].launchPath).toBe('/tasks/today');
    expect(modules[5].launchPath).toBe('/wardrobe/items');
    expect(modules[5].iconPath).toBe('/module-wardrobe.png');
    expect(modules[6].launchPath).toBe('/admin');
  });
});
