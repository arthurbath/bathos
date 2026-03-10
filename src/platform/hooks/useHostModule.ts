/**
 * Returns the active module based on the current URL path.
 *
 * - /budget/* → 'budget'
 * - /drawers/* → 'drawers'
 * - /garage/* → 'garage'
 * - /exercise/* → 'exercise'
 * - everything else → null (platform root)
 */

const PATH_MODULE_MAP: Record<string, string> = {
  budget: 'budget',
  drawers: 'drawers',
  garage: 'garage',
  exercise: 'exercise',
};

export type ModuleId = 'budget' | 'drawers' | 'garage' | 'exercise' | null;

export function useHostModule(): ModuleId {
  const firstSegment = window.location.pathname.split('/')[1];
  if (firstSegment && PATH_MODULE_MAP[firstSegment]) {
    return PATH_MODULE_MAP[firstSegment] as ModuleId;
  }
  return null;
}

/**
 * Returns the base path prefix for the current module (e.g. '/budget').
 */
export function useModuleBasePath(): string {
  const firstSegment = window.location.pathname.split('/')[1];
  if (firstSegment && PATH_MODULE_MAP[firstSegment]) {
    return `/${firstSegment}`;
  }
  return '';
}

/**
 * Returns the internal path for a given module.
 */
export function getModuleUrl(moduleId: string): string {
  return `/${moduleId}`;
}
