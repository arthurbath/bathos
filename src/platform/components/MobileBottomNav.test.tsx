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
  { path: '/config', label: 'Settings', icon: Settings },
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
      'p-1',
      'backdrop-blur-sm',
      'supports-[backdrop-filter]:bg-secondary/85',
      'gap-0',
      'pointer-events-auto',
    );
    expect(nav).not.toHaveClass('p-1.5');
    expect(nav).not.toHaveClass('gap-0.5');
    expect(nav).not.toHaveClass('gap-1');
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Today' })).toHaveClass(
      'rounded-full',
      'px-0.5',
      'bg-foreground/[0.12]',
    );
    const inboxLink = screen.getByRole('link', { name: 'Inbox' });
    expect(inboxLink).not.toHaveClass('hover:bg-foreground/[0.07]');
    expect(inboxLink).not.toHaveClass('hover:text-foreground');

    fireEvent.click(screen.getByRole('link', { name: 'Inbox' }));
    expect(onNavigate).toHaveBeenCalledWith('/inbox');

    onNavigate.mockClear();
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

    const { unmount } = render(
      <MobileBottomNav
        items={primaryItems}
        isActive={(path) => path === '/today'}
        onNavigate={vi.fn()}
      />,
    );

    const viewport = (await screen.findByRole('navigation', {
      name: 'Mobile navigation',
    })).parentElement;
    expect(viewport).toHaveAttribute('data-installed-touch', 'true');
    expect(viewport).toHaveAttribute('data-native-touch', 'true');
    expect(viewport).not.toHaveAttribute('data-standalone-touch');
    expect(viewport).toHaveClass(
      'bottom-0.5',
    );
    expect(viewport).not.toHaveClass(
      'bottom-[calc(env(safe-area-inset-bottom)+0.5rem)]',
    );
    expect(document.documentElement).toHaveAttribute(
      'data-mobile-bottom-nav-installed-touch',
      'true',
    );

    unmount();
    expect(document.documentElement).not.toHaveAttribute(
      'data-mobile-bottom-nav-installed-touch',
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
    expect(viewport).toHaveAttribute('data-installed-touch', 'true');
    expect(viewport).not.toHaveAttribute('data-native-touch');
    expect(viewport).toHaveAttribute('data-standalone-touch', 'true');
    expect(viewport).toHaveClass(
      'bottom-[calc(env(safe-area-inset-bottom)+0.125rem)]',
    );
    expect(document.documentElement).toHaveAttribute(
      'data-mobile-bottom-nav-installed-touch',
      'true',
    );
  });

  it('retains the ordinary web offset on a touch device outside installed mode', async () => {
    setNavigatorProperty('platform', 'iPhone');
    setNavigatorProperty('maxTouchPoints', 5);
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
    expect(viewport).not.toHaveAttribute('data-installed-touch');
    expect(viewport).not.toHaveAttribute('data-native-touch');
    expect(viewport).not.toHaveAttribute('data-standalone-touch');
    expect(viewport).toHaveClass(
      'bottom-[calc(env(safe-area-inset-bottom)+0.5rem)]',
    );
    expect(viewport).not.toHaveClass(
      'bottom-[calc(env(safe-area-inset-bottom)+0.125rem)]',
    );
    expect(document.documentElement).not.toHaveAttribute(
      'data-mobile-bottom-nav-installed-touch',
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
    const config = await screen.findByRole('menuitem', { name: 'Settings' });
    expect(config).toHaveAttribute('href', '/tasks/config');
    await waitFor(() => expect(document.activeElement).toHaveAttribute('role', 'menuitem'));

    fireEvent.click(config);
    expect(onNavigate).toHaveBeenCalledWith('/config');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});
