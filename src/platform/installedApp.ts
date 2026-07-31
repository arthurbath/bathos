import { getAvailableModules, getModuleById, type PlatformModuleId } from '@/platform/modules';

const INSTALLED_MODULE_SESSION_KEY = 'bathos_installed_module';

const INSTALLED_INTERNAL_PLATFORM_PATHS = new Set([
  '/account',
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/terms',
  '/help',
  '/.lovable/oauth/consent',
]);

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

type BathOSNativeAppDescriptor = {
  schemaVersion?: unknown;
  moduleId?: unknown;
  platform?: unknown;
  quickEntryShortcut?: unknown;
};

type InstalledAppWindow = Window & {
  __bathosNativeApp?: BathOSNativeAppDescriptor;
};

function isPlatformModuleId(value: unknown): value is PlatformModuleId {
  return typeof value === 'string' && getModuleById(value as PlatformModuleId) !== undefined;
}

function isInstallableModuleId(value: unknown): value is PlatformModuleId {
  return isPlatformModuleId(value) && value !== 'admin';
}

function readCachedModuleId(targetWindow: Window): PlatformModuleId | null {
  try {
    const moduleId = targetWindow.sessionStorage.getItem(INSTALLED_MODULE_SESSION_KEY);
    return isInstallableModuleId(moduleId) ? moduleId : null;
  } catch {
    return null;
  }
}

function cacheModuleId(targetWindow: Window, moduleId: PlatformModuleId): void {
  try {
    targetWindow.sessionStorage.setItem(INSTALLED_MODULE_SESSION_KEY, moduleId);
  } catch {
    // Installed navigation still works when private storage is unavailable.
  }
}

export function getModuleIdFromPath(pathname: string): PlatformModuleId | null {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return getAvailableModules({ isAdmin: true })
    .find(({ id }) => normalizedPath === `/${id}` || normalizedPath.startsWith(`/${id}/`))
    ?.id ?? null;
}

export function isStandalonePwa(targetWindow: Window = window): boolean {
  const navigator = targetWindow.navigator as StandaloneNavigator;
  return navigator.standalone === true
    || (
      typeof targetWindow.matchMedia === 'function'
      && targetWindow.matchMedia('(display-mode: standalone)').matches
    );
}

export function getDeclaredNativeModuleId(targetWindow: Window = window): PlatformModuleId | null {
  const descriptor = (targetWindow as InstalledAppWindow).__bathosNativeApp;
  return isInstallableModuleId(descriptor?.moduleId) ? descriptor.moduleId : null;
}

export function getDeclaredNativePlatform(
  targetWindow: Window = window,
): 'ios' | 'macos' | null {
  const platform = (targetWindow as InstalledAppWindow).__bathosNativeApp?.platform;
  return platform === 'ios' || platform === 'macos' ? platform : null;
}

export function getDeclaredNativeQuickEntryShortcut(
  targetWindow: Window = window,
): string | null {
  const shortcut = (targetWindow as InstalledAppWindow).__bathosNativeApp
    ?.quickEntryShortcut;
  return typeof shortcut === 'string' && shortcut.trim() !== ''
    ? shortcut
    : null;
}

export function isInstalledApp(targetWindow: Window = window): boolean {
  return getDeclaredNativeModuleId(targetWindow) !== null || isStandalonePwa(targetWindow);
}

export function resolveInstalledModuleId(targetWindow: Window = window): PlatformModuleId | null {
  if (!isInstalledApp(targetWindow)) return null;

  const declaredModuleId = getDeclaredNativeModuleId(targetWindow);
  if (declaredModuleId) {
    cacheModuleId(targetWindow, declaredModuleId);
    return declaredModuleId;
  }

  const routeModuleId = getModuleIdFromPath(targetWindow.location.pathname);
  if (isInstallableModuleId(routeModuleId)) {
    cacheModuleId(targetWindow, routeModuleId);
    return routeModuleId;
  }

  return readCachedModuleId(targetWindow);
}

export function getInstalledModuleLaunchPath(targetWindow: Window = window): string {
  const moduleId = resolveInstalledModuleId(targetWindow);
  return moduleId ? getModuleById(moduleId)?.launchPath ?? '/' : '/';
}

export function getSignOutDestination(targetWindow: Window = window): string {
  return isInstalledApp(targetWindow) ? getInstalledModuleLaunchPath(targetWindow) : '/';
}

export function isInstalledInternalPath(
  pathname: string,
  moduleId: PlatformModuleId,
): boolean {
  return pathname === `/${moduleId}`
    || pathname.startsWith(`/${moduleId}/`)
    || INSTALLED_INTERNAL_PLATFORM_PATHS.has(pathname);
}

export function shouldOpenInstalledHrefExternally(
  href: string,
  targetWindow: Window = window,
): boolean {
  const moduleId = resolveInstalledModuleId(targetWindow);
  if (!moduleId) return false;

  let destination: URL;
  try {
    destination = new URL(href, targetWindow.location.href);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(destination.protocol)) return true;
  if (destination.origin !== targetWindow.location.origin) return true;

  return !isInstalledInternalPath(destination.pathname, moduleId);
}

export function useInstalledAppMode(): boolean {
  return typeof window !== 'undefined' && isInstalledApp(window);
}
