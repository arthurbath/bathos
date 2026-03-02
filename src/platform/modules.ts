import type { LucideIcon } from 'lucide-react';
import { CarFront, CircleDollarSign, ShelvingUnit, Shield } from 'lucide-react';

export type PlatformModuleId = 'budget' | 'drawers' | 'garage' | 'admin';

export interface PlatformModule {
  id: PlatformModuleId;
  name: string;
  bookmarkName: string;
  description: string;
  launchPath: string;
  startPath: string;
  scope: string;
  webIconPath: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const BUDGET_MODULE: PlatformModule = {
  id: 'budget',
  name: 'Budget',
  bookmarkName: 'Budget',
  description: 'Track your expenses, plan a monthly budget, and split costs fairly with housemates',
  launchPath: '/budget/summary',
  startPath: '/budget/summary',
  scope: '/budget/',
  webIconPath: '/module-budget.png',
  icon: CircleDollarSign,
};

const DRAWERS_MODULE: PlatformModule = {
  id: 'drawers',
  name: 'Drawer Planner',
  bookmarkName: 'Drawer Planner',
  description: 'Plan grid-style shelving units and drawer arrangements',
  launchPath: '/drawers/plan',
  startPath: '/drawers/plan',
  scope: '/drawers/',
  webIconPath: '/module-drawer-planner.png',
  icon: ShelvingUnit,
};

const GARAGE_MODULE: PlatformModule = {
  id: 'garage',
  name: 'Garage',
  bookmarkName: 'Garage',
  description: 'Track vehicle maintenance schedules, shop visits, and due services',
  launchPath: '/garage/due',
  startPath: '/garage/due',
  scope: '/garage/',
  webIconPath: '/module-garage.png',
  icon: CarFront,
};

const ADMINISTRATION_MODULE: PlatformModule = {
  id: 'admin',
  name: 'Administration',
  bookmarkName: 'Administration',
  description: 'Access administrative tools, diagnostics, and platform management',
  launchPath: '/admin',
  startPath: '/admin',
  scope: '/admin',
  webIconPath: '/module-administration.png',
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

function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  if (pathname === '/') return pathname;
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function pathMatchesScope(pathname: string, scope: string): boolean {
  const normalizedPath = normalizePathname(pathname);
  const normalizedScope = normalizePathname(scope);
  return normalizedPath === normalizedScope || normalizedPath.startsWith(`${normalizedScope}/`);
}

export function getModuleByPath(pathname: string): PlatformModule | undefined {
  return PLATFORM_MODULES.find((module) => pathMatchesScope(pathname, module.scope));
}
