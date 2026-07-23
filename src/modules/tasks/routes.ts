import { matchPath } from 'react-router-dom';

export const TASK_ROUTE_PATHS = [
  '/tasks/today',
  '/tasks/upcoming',
  '/tasks/anytime',
  '/tasks/someday',
  '/tasks/done',
  '/tasks/projects',
  '/tasks/projects/:projectId',
  '/tasks/areas/:areaId',
  '/tasks/templates',
  '/tasks/config',
  '/tasks/search',
] as const;

export function isSupportedTaskRoute(pathname: string): boolean {
  return TASK_ROUTE_PATHS.some((path) => matchPath({ path, end: true }, pathname) !== null);
}
