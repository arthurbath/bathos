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

export function resolveBrandingForPath(pathname: string): AppBranding {
  const moduleConfig = getModuleByPath(pathname);
  if (!moduleConfig) {
    return DEFAULT_BRANDING;
  }

  return {
    title: moduleConfig.bookmarkName,
    appName: moduleConfig.bookmarkName,
    iconHref: moduleConfig.webIconPath,
    appleTouchIconHref: moduleConfig.webIconPath,
    manifestHref: MODULE_MANIFESTS[moduleConfig.id] ?? DEFAULT_BRANDING.manifestHref,
  };
}
