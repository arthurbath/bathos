import type { LucideIcon } from 'lucide-react';
import { CarFront, CircleDollarSign, ShelvingUnit, Shield } from 'lucide-react';

export type PlatformModuleId = 'budget' | 'drawers' | 'garage' | 'admin';

export interface PlatformModule {
  id: PlatformModuleId;
  name: string;
  description: string;
  launchPath: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const BUDGET_MODULE: PlatformModule = {
  id: 'budget',
  name: 'Budget',
  description: 'Track your expenses, plan a monthly budget, and split costs fairly with housemates',
  launchPath: '/budget/summary',
  icon: CircleDollarSign,
};

const DRAWERS_MODULE: PlatformModule = {
  id: 'drawers',
  name: 'Drawer Planner',
  description: 'Plan grid-style shelving units and drawer arrangements',
  launchPath: '/drawers/plan',
  icon: ShelvingUnit,
};

const GARAGE_MODULE: PlatformModule = {
  id: 'garage',
  name: 'Garage',
  description: 'Track vehicle maintenance schedules, shop visits, and due services',
  launchPath: '/garage/due',
  icon: CarFront,
};

const ADMINISTRATION_MODULE: PlatformModule = {
  id: 'admin',
  name: 'Administration',
  description: 'Access administrative tools, diagnostics, and platform management',
  launchPath: '/admin',
  icon: Shield,
  adminOnly: true,
};

const PLATFORM_MODULES: PlatformModule[] = [BUDGET_MODULE, DRAWERS_MODULE, GARAGE_MODULE, ADMINISTRATION_MODULE];

interface GetAvailableModulesOptions {
  isAdmin?: boolean;
}

export function getAvailableModules(options?: GetAvailableModulesOptions): PlatformModule[] {
  return PLATFORM_MODULES.filter((module) => !module.adminOnly || options?.isAdmin);
}

export function getModuleById(moduleId: PlatformModuleId): PlatformModule | undefined {
  return PLATFORM_MODULES.find((module) => module.id === moduleId);
}
