import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDeclaredNativeModuleId,
  getInstalledModuleLaunchPath,
  getModuleIdFromPath,
  getSignOutDestination,
  isInstalledApp,
  isInstalledInternalPath,
  resolveInstalledModuleId,
  shouldOpenInstalledHrefExternally,
} from '@/platform/installedApp';

type TestWindow = Window & {
  __bathosNativeApp?: {
    schemaVersion: number;
    moduleId: string;
  };
};

function setStandaloneMode(enabled: boolean) {
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: enabled,
  });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: enabled && query === '(display-mode: standalone)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('installed app context', () => {
  beforeEach(() => {
    setStandaloneMode(false);
    sessionStorage.clear();
    Reflect.deleteProperty(window as TestWindow, '__bathosNativeApp');
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('keeps ordinary browser sessions outside installed mode', () => {
    window.history.replaceState(null, '', '/budget/summary');

    expect(isInstalledApp()).toBe(false);
    expect(resolveInstalledModuleId()).toBeNull();
    expect(getSignOutDestination()).toBe('/');
  });

  it('binds a standalone PWA to its launch module and keeps it through platform routes', () => {
    setStandaloneMode(true);
    window.history.replaceState(null, '', '/garage/services');

    expect(isInstalledApp()).toBe(true);
    expect(resolveInstalledModuleId()).toBe('garage');
    expect(getInstalledModuleLaunchPath()).toBe('/garage/due');

    window.history.replaceState(null, '', '/account');
    expect(resolveInstalledModuleId()).toBe('garage');
    expect(getSignOutDestination()).toBe('/garage/due');
  });

  it('uses the explicit native descriptor as the authoritative module', () => {
    (window as TestWindow).__bathosNativeApp = {
      schemaVersion: 1,
      moduleId: 'tasks',
    };
    window.history.replaceState(null, '', '/account');

    expect(getDeclaredNativeModuleId()).toBe('tasks');
    expect(resolveInstalledModuleId()).toBe('tasks');
    expect(getInstalledModuleLaunchPath()).toBe('/tasks/today');
  });

  it('rejects unsupported native module declarations', () => {
    (window as TestWindow).__bathosNativeApp = {
      schemaVersion: 1,
      moduleId: 'unknown',
    };

    expect(getDeclaredNativeModuleId()).toBeNull();
    expect(isInstalledApp()).toBe(false);
  });

  it('classifies module, platform, cross-module, external, and protocol links', () => {
    setStandaloneMode(true);
    window.history.replaceState(null, '', '/tasks/today');
    expect(resolveInstalledModuleId()).toBe('tasks');

    expect(isInstalledInternalPath('/tasks/upcoming', 'tasks')).toBe(true);
    expect(isInstalledInternalPath('/account', 'tasks')).toBe(true);
    expect(isInstalledInternalPath('/budget/summary', 'tasks')).toBe(false);
    expect(shouldOpenInstalledHrefExternally('/tasks/config')).toBe(false);
    expect(shouldOpenInstalledHrefExternally('/account')).toBe(false);
    expect(shouldOpenInstalledHrefExternally('/')).toBe(true);
    expect(shouldOpenInstalledHrefExternally('/wardrobe/items')).toBe(true);
    expect(shouldOpenInstalledHrefExternally('https://example.test/read')).toBe(true);
    expect(shouldOpenInstalledHrefExternally('message://synthetic-message')).toBe(true);
  });

  it('maps every module route to its platform module identifier', () => {
    expect(getModuleIdFromPath('/budget/config')).toBe('budget');
    expect(getModuleIdFromPath('/drawers/plan')).toBe('drawers');
    expect(getModuleIdFromPath('/garage/due')).toBe('garage');
    expect(getModuleIdFromPath('/snake/weights')).toBe('snake');
    expect(getModuleIdFromPath('/tasks/today')).toBe('tasks');
    expect(getModuleIdFromPath('/wardrobe/items')).toBe('wardrobe');
    expect(getModuleIdFromPath('/help')).toBeNull();
  });
});
