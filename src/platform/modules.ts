import type { LucideIcon } from 'lucide-react';
import { BookOpenText, Calculator, CarFront, CircleDollarSign, Dumbbell, ShelvingUnit, Shield, Shirt } from 'lucide-react';

export type PlatformModuleId = 'budget' | 'drawers' | 'garage' | 'estimator' | 'exercise' | 'wardrobe' | 'corpus' | 'admin';

export interface PlatformModule {
  id: PlatformModuleId;
  name: string;
  description: string;
  launchPath: string;
  icon: LucideIcon;
  iconPath?: string;
  adminOnly?: boolean;
}

const BUDGET_MODULE: PlatformModule = {
  id: 'budget',
  name: 'Budget',
  description: 'Track your expenses, plan a monthly budget, and split costs fairly with housemates',
  launchPath: '/budget/summary',
  icon: CircleDollarSign,
  iconPath: '/module-budget.png',
};

const DRAWERS_MODULE: PlatformModule = {
  id: 'drawers',
  name: 'Drawers',
  description: 'Plan grid-style shelving units and drawer arrangements',
  launchPath: '/drawers/plan',
  icon: ShelvingUnit,
  iconPath: '/module-drawers.png',
};

const GARAGE_MODULE: PlatformModule = {
  id: 'garage',
  name: 'Garage',
  description: 'Track vehicle maintenance schedules, shop visits, and due services',
  launchPath: '/garage/due',
  icon: CarFront,
  iconPath: '/module-garage.png',
};

const ESTIMATOR_MODULE: PlatformModule = {
  id: 'estimator',
  name: 'Ticket Estimator',
  description: 'Create a public room and estimate tickets together',
  launchPath: '/estimator',
  icon: Calculator,
  iconPath: '/module-estimator.png',
};

const EXERCISE_MODULE: PlatformModule = {
  id: 'exercise',
  name: 'Exercise',
  description: 'Define exercises, build routines, and run through them one step at a time',
  launchPath: '/exercise/routines',
  icon: Dumbbell,
  iconPath: '/module-exercise.png',
  adminOnly: true,
};

const WARDROBE_MODULE: PlatformModule = {
  id: 'wardrobe',
  name: 'Wardrobe',
  description: 'Track wardrobe items, sizing, links, and item status',
  launchPath: '/wardrobe/items',
  icon: Shirt,
  iconPath: '/module-wardrobe.png',
};

const CORPUS_MODULE: PlatformModule = {
  id: 'corpus',
  name: 'Corpus',
  description: 'Manage personal writing samples, style rules, and MCP-ready reference documents',
  launchPath: '/corpus/documents',
  icon: BookOpenText,
};

const ADMINISTRATION_MODULE: PlatformModule = {
  id: 'admin',
  name: 'Administration',
  description: 'Access administrative tools, diagnostics, and platform management',
  launchPath: '/admin',
  icon: Shield,
  iconPath: '/module-administration.png',
  adminOnly: true,
};

const PLATFORM_MODULES: PlatformModule[] = [BUDGET_MODULE, CORPUS_MODULE, DRAWERS_MODULE, GARAGE_MODULE, ESTIMATOR_MODULE, WARDROBE_MODULE, EXERCISE_MODULE, ADMINISTRATION_MODULE];

interface GetAvailableModulesOptions {
  isAdmin?: boolean;
}

export function getAvailableModules(options?: GetAvailableModulesOptions): PlatformModule[] {
  return PLATFORM_MODULES.filter((module) => !module.adminOnly || options?.isAdmin);
}

export function getModuleById(moduleId: PlatformModuleId): PlatformModule | undefined {
  return PLATFORM_MODULES.find((module) => module.id === moduleId);
}
