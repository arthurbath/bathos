export type PlatformModuleId = 'budget' | 'drawers' | 'garage';

export interface PlatformModule {
  id: PlatformModuleId;
  name: string;
  description: string;
  launchPath: string;
  adminOnly?: boolean;
}

const BUDGET_MODULE: PlatformModule = {
  id: 'budget',
  name: 'Budget',
  description: 'Track your expenses, plan a monthly budget, and split costs fairly with housemates',
  launchPath: '/budget/summary',
};

const DRAWERS_MODULE: PlatformModule = {
  id: 'drawers',
  name: 'Drawer Planner',
  description: 'Plan grid-style shelving units and drawer arrangements',
  launchPath: '/drawers/plan',
};

const GARAGE_MODULE: PlatformModule = {
  id: 'garage',
  name: 'Garage',
  description: 'Track vehicle maintenance schedules, shop visits, and due services',
  launchPath: '/garage/due',
  adminOnly: true,
};

interface GetAvailableModulesOptions {
  isAdmin?: boolean;
}

export function getAvailableModules(options?: GetAvailableModulesOptions): PlatformModule[] {
  const modules = [BUDGET_MODULE, DRAWERS_MODULE, GARAGE_MODULE];
  return modules.filter((module) => !module.adminOnly || options?.isAdmin);
}
