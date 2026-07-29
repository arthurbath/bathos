import { CalendarDays, Inbox, Settings, Trash2 } from 'lucide-react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileBottomNav } from '@/platform/components/MobileBottomNav';

const primaryItems = [
  { path: '/inbox', label: 'Inbox', icon: Inbox },
  { path: '/today', label: 'Today', icon: CalendarDays },
] as const;

const overflowItems = [
  { path: '/trash', label: 'Trash', icon: Trash2 },
  { path: '/config', label: 'Config', icon: Settings },
] as const;

type NativeAppWindow = Window & {
  __bathosNativeApp?: {
    schemaVersion: number;
    moduleId: string;
  };
};

function setNavigatorProperty(name: string, value: unknown) {
  Object.defineProperty(window.navigator, name, {
    configurable: true,
    value,
  });
}

describe('MobileBottomNav', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as NativeAppWindow).__bathosNativeApp;
    setNavigatorProperty('platform', 'MacIntel');
    setNavigatorProperty('userAgent', 'Mozilla/5.0');
    setNavigatorProperty('maxTouchPoints', 0);
    setNavigatorProperty('standalone', false);
  });

  it('preserves the existing direct-link path when no overflow is supplied', async () => {
    const onNavigate = vi.fn();
    render(
      <MobileBottomNav
        items={primaryItems}
        isActive={(path) => path === '/today'}
        onNavigate={onNavigate}
        hrefForPath={(path) => `/tasks${path}`}
      />,
    );

    const nav = await screen.findByRole('navigation', { name: 'Mobile navigation' });
    const viewport = nav.parentElement;
    expect(viewport).toHaveAttribute('data-mobile-bottom-nav-viewport');
    expect(viewport).toHaveClass(
      'pointer-events-none',
      'bottom-[calc(env(safe-area-inset-bottom)+0.5rem)]',
    );
    expect(nav).toHaveClass(
      'w-[calc(100%-2rem)]',
      'rounded-full',
      'border-secondary',
      'bg-secondary/90',
      'backdrop-blur-sm',
      'supports-[backdrop-filter]:bg-secondary/85',
      'pointer-events-auto',
    );
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Today' })).toHaveClass(
      'rounded-full',
      'bg-foreground/[0.12]',
    );

    fireEvent.click(screen.getByRole('link', { name: 'Inbox' }));
    expect(onNavigate).toHaveBeenCalledWith('/inbox');

    onNavigate.mockClear();
    const inboxLink = screen.getByRole('link', { name: 'Inbox' });
    inboxLink.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(inboxLink, { metaKey: true });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('sits closer to the complete safe area in a native iOS app', async () => {
    (window as NativeAppWindow).__bathosNativeApp = {
      schemaVersion: 1,
      moduleId: 'tasks',
    };
    setNavigatorProperty('platform', 'iPhone');
    setNavigatorProperty(
      'userAgent',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    );

    render(
      <MobileBottomNav
        items={primaryItems}
        isActive={(path) => path === '/today'}
        onNavigate={vi.fn()}
      />,
    );

    const viewport = (await screen.findByRole('navigation', {
      name: 'Mobile navigation',
    })).parentElement;
    expect(viewport).toHaveAttribute('data-installed-ios', 'true');
    expect(viewport).toHaveClass(
      'bottom-[calc(env(safe-area-inset-bottom)+0.25rem)]',
    );
    expect(viewport).not.toHaveClass(
      'bottom-[calc(env(safe-area-inset-bottom)+0.5rem)]',
    );
  });

  it('uses the same lower placement in a standalone iPadOS PWA', async () => {
    setNavigatorProperty('platform', 'MacIntel');
    setNavigatorProperty('maxTouchPoints', 5);
    setNavigatorProperty('standalone', true);

    render(
      <MobileBottomNav
        items={primaryItems}
        isActive={(path) => path === '/today'}
        onNavigate={vi.fn()}
      />,
    );

    const viewport = (await screen.findByRole('navigation', {
      name: 'Mobile navigation',
    })).parentElement;
    expect(viewport).toHaveAttribute('data-installed-ios', 'true');
    expect(viewport).toHaveClass(
      'bottom-[calc(env(safe-area-inset-bottom)+0.25rem)]',
    );
  });

  it('renders four direct destinations plus one keyboard-accessible More control', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <MobileBottomNav
        items={[
          ...primaryItems,
          { path: '/upcoming', label: 'Upcoming', icon: CalendarDays },
          { path: '/anytime', label: 'Anytime', icon: CalendarDays },
        ]}
        overflowItems={overflowItems}
        isActive={(path) => path === '/config'}
        onNavigate={onNavigate}
        hrefForPath={(path) => `/tasks${path}`}
      />,
    );

    const nav = await screen.findByRole('navigation', { name: 'Mobile navigation' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
    const more = within(nav).getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-current', 'page');

    more.focus();
    await user.keyboard('{Enter}');
    const config = await screen.findByRole('menuitem', { name: 'Config' });
    expect(config).toHaveAttribute('href', '/tasks/config');
    await waitFor(() => expect(document.activeElement).toHaveAttribute('role', 'menuitem'));

    fireEvent.click(config);
    expect(onNavigate).toHaveBeenCalledWith('/config');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});
