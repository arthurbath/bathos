import { getModuleByPath } from '@/platform/modules';

export interface AppBranding {
  title: string;
  appName: string;
  iconHref: string;
  appleTouchIconHref: string;
  manifestHref: string;
}

const DEFAULT_BRANDING: AppBranding = {
  title: 'BathOS',
  appName: 'BathOS',
  iconHref: '/favicon.png',
  appleTouchIconHref: '/apple-touch-icon.png',
  manifestHref: '/manifest.json',
};

const MODULE_MANIFESTS: Record<string, string> = {
  budget: '/manifest-budget.json',
  drawers: '/manifest-drawers.json',
  garage: '/manifest-garage.json',
  admin: '/manifest-administration.json',
};

const ROUTE_MANIFESTS: Record<string, string> = {
  '/budget': '/manifest-budget-root.json',
  '/budget/summary': '/manifest-budget.json',
  '/budget/incomes': '/manifest-budget-incomes.json',
  '/budget/expenses': '/manifest-budget-expenses.json',
  '/budget/config': '/manifest-budget-config.json',
  '/budget/restore': '/manifest-budget-restore.json',
  '/drawers': '/manifest-drawers-root.json',
  '/drawers/plan': '/manifest-drawers.json',
  '/drawers/config': '/manifest-drawers-config.json',
  '/garage': '/manifest-garage-root.json',
  '/garage/due': '/manifest-garage.json',
  '/garage/services': '/manifest-garage-services.json',
  '/garage/servicings': '/manifest-garage-servicings.json',
  '/garage/config': '/manifest-garage-config.json',
  '/admin': '/manifest-administration.json',
};

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function resolveBrandingForPath(pathname: string): AppBranding {
  const normalizedPath = normalizePathname(pathname);
  const moduleConfig = getModuleByPath(normalizedPath);
  if (!moduleConfig) {
    return DEFAULT_BRANDING;
  }

  const routeManifest = ROUTE_MANIFESTS[normalizedPath];

  return {
    title: moduleConfig.bookmarkName,
    appName: moduleConfig.bookmarkName,
    iconHref: moduleConfig.webIconPath,
    appleTouchIconHref: moduleConfig.webIconPath,
    manifestHref: routeManifest ?? MODULE_MANIFESTS[moduleConfig.id] ?? DEFAULT_BRANDING.manifestHref,
  };
}
