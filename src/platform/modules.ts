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
  description: 'Track shared expenses and split costs fairly.',
  launchPath: '/budget/summary',
};

const DRAWERS_MODULE: PlatformModule = {
  id: 'drawers',
  name: 'Drawer Planner',
  description: 'Plan Kallax-style cubbies and insert arrangements.',
  launchPath: '/drawers/plan',
};

export function getAvailableModules(): PlatformModule[] {
  return [BUDGET_MODULE, DRAWERS_MODULE];
}
