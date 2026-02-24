export type PlatformModuleId = 'budget' | 'drawers';

export interface PlatformModule {
  id: PlatformModuleId;
  name: string;
  description: string;
  launchPath: string;
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

export function getAvailableModules(): PlatformModule[] {
  return [BUDGET_MODULE, DRAWERS_MODULE];
}
