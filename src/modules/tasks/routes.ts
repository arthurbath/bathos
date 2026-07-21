import { matchPath } from 'react-router-dom';

export const TASK_ROUTE_PATHS = [
  '/tasks/inbox',
  '/tasks/today',
  '/tasks/upcoming',
  '/tasks/anytime',
  '/tasks/someday',
  '/tasks/logbook',
  '/tasks/trash',
  '/tasks/projects',
  '/tasks/projects/:projectId',
  '/tasks/areas/:areaId',
  '/tasks/templates',
] as const;

export function isSupportedTaskRoute(pathname: string): boolean {
  return TASK_ROUTE_PATHS.some((path) => matchPath({ path, end: true }, pathname) !== null);
}
