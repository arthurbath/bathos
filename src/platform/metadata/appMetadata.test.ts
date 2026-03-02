import { describe, expect, it } from 'vitest';
import { resolveBrandingForPath } from '@/platform/metadata/appMetadata';

describe('resolveBrandingForPath', () => {
  it('returns budget metadata for budget routes', () => {
    const metadata = resolveBrandingForPath('/budget/summary');
    expect(metadata).toEqual({
      title: 'Budget',
      appName: 'Budget',
      iconHref: '/module-budget.png',
      appleTouchIconHref: '/module-budget.png',
      manifestHref: '/manifest-budget.json',
    });

    expect(resolveBrandingForPath('/budget/expenses')).toEqual({
      title: 'Budget',
      appName: 'Budget',
      iconHref: '/module-budget.png',
      appleTouchIconHref: '/module-budget.png',
      manifestHref: '/manifest-budget-expenses.json',
    });
  });

  it('returns drawers metadata for drawers routes', () => {
    const metadata = resolveBrandingForPath('/drawers/plan');
    expect(metadata).toEqual({
      title: 'Drawer Planner',
      appName: 'Drawer Planner',
      iconHref: '/module-drawer-planner.png',
      appleTouchIconHref: '/module-drawer-planner.png',
      manifestHref: '/manifest-drawers.json',
    });

    expect(resolveBrandingForPath('/drawers/config')).toEqual({
      title: 'Drawer Planner',
      appName: 'Drawer Planner',
      iconHref: '/module-drawer-planner.png',
      appleTouchIconHref: '/module-drawer-planner.png',
      manifestHref: '/manifest-drawers-config.json',
    });
  });

  it('returns garage metadata for garage routes', () => {
    const metadata = resolveBrandingForPath('/garage/due');
    expect(metadata).toEqual({
      title: 'Garage',
      appName: 'Garage',
      iconHref: '/module-garage.png',
      appleTouchIconHref: '/module-garage.png',
      manifestHref: '/manifest-garage.json',
    });

    expect(resolveBrandingForPath('/garage/services')).toEqual({
      title: 'Garage',
      appName: 'Garage',
      iconHref: '/module-garage.png',
      appleTouchIconHref: '/module-garage.png',
      manifestHref: '/manifest-garage-services.json',
    });
  });

  it('returns administration metadata for admin routes', () => {
    const metadata = resolveBrandingForPath('/admin');
    expect(metadata).toEqual({
      title: 'Administration',
      appName: 'Administration',
      iconHref: '/module-administration.png',
      appleTouchIconHref: '/module-administration.png',
      manifestHref: '/manifest-administration.json',
    });
  });

  it('returns BathOS metadata for platform routes', () => {
    expect(resolveBrandingForPath('/')).toEqual({
      title: 'BathOS',
      appName: 'BathOS',
      iconHref: '/favicon.png',
      appleTouchIconHref: '/apple-touch-icon.png',
      manifestHref: '/manifest.json',
    });
    expect(resolveBrandingForPath('/account')).toEqual({
      title: 'BathOS',
      appName: 'BathOS',
      iconHref: '/favicon.png',
      appleTouchIconHref: '/apple-touch-icon.png',
      manifestHref: '/manifest.json',
    });
    expect(resolveBrandingForPath('/terms')).toEqual({
      title: 'BathOS',
      appName: 'BathOS',
      iconHref: '/favicon.png',
      appleTouchIconHref: '/apple-touch-icon.png',
      manifestHref: '/manifest.json',
    });
  });

  it('returns BathOS metadata for unknown routes', () => {
    const metadata = resolveBrandingForPath('/does-not-exist');
    expect(metadata).toEqual({
      title: 'BathOS',
      appName: 'BathOS',
      iconHref: '/favicon.png',
      appleTouchIconHref: '/apple-touch-icon.png',
      manifestHref: '/manifest.json',
    });
  });

  it('normalizes trailing slash routes', () => {
    expect(resolveBrandingForPath('/budget/summary/')).toEqual({
      title: 'Budget',
      appName: 'Budget',
      iconHref: '/module-budget.png',
      appleTouchIconHref: '/module-budget.png',
      manifestHref: '/manifest-budget.json',
    });
  });
});
