import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WardrobeShell } from '@/modules/wardrobe/components/WardrobeShell';

vi.mock('@/platform/components/ToplineHeader', () => ({
  ToplineHeader: () => <header data-testid="topline-header" />,
}));

vi.mock('@/platform/components/InstalledAppAccountCard', () => ({
  InstalledAppAccountCard: () => <section data-testid="installed-account-card">Account</section>,
}));

vi.mock('@/platform/hooks/useHostModule', () => ({
  useModuleBasePath: () => '/wardrobe',
}));

vi.mock('@/modules/wardrobe/hooks/useWardrobeItems', () => ({
  useWardrobeItems: () => ({
    items: [],
    loading: false,
    addItem: async () => ({}),
    updateItem: async () => ({}),
    removeItem: async () => {},
  }),
}));

vi.mock('@/modules/wardrobe/components/WardrobeItemsGrid', () => ({
  WardrobeItemsGrid: ({ fullViewTopBorder }: { fullViewTopBorder?: boolean }) => (
    <div data-testid="wardrobe-grid" data-full-view-top-border={String(fullViewTopBorder)} />
  ),
}));

function renderShell(initialEntry = '/wardrobe/items') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <WardrobeShell userId="user-1" displayName="Art" onSignOut={async () => {}} />
      </MemoryRouter>,
    );
  });

  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('WardrobeShell layout', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: false,
    });
  });

  it('collapses desktop top spacing for the single full-view grid and keeps one mobile nav item', async () => {
    const { container, root } = renderShell();

    try {
      await act(async () => {});

      const main = container.querySelector('main') as HTMLElement | null;
      expect(main).toHaveClass('pt-0');
      expect(main?.className).not.toContain('md:pt-6');
      expect(main?.className).toContain('pb-[calc(env(safe-area-inset-bottom)+3.75rem+4px)]');
      expect(container.querySelector('[data-testid="wardrobe-grid"]')?.getAttribute('data-full-view-top-border')).toBe('false');

      const mobileNav = document.body.querySelector('nav[aria-label="Mobile navigation"]') as HTMLElement | null;
      expect(mobileNav).toBeTruthy();

      const links = Array.from(mobileNav?.querySelectorAll('a') ?? []);
      expect(links).toHaveLength(1);
      expect(links[0].textContent).toContain('Items');
      expect(links[0].getAttribute('aria-current')).toBe('page');
      expect(links[0].getAttribute('href')).toBe('/wardrobe/items');
    } finally {
      cleanup(root, container);
    }
  });

  it('adds an installed-only Config destination with the account card', async () => {
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: true,
    });
    const { container, root } = renderShell('/wardrobe/config');

    try {
      await act(async () => {});

      expect(container.querySelector('[data-testid="installed-account-card"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="wardrobe-grid"]')).toBeNull();
      const mobileNav = document.body.querySelector('nav[aria-label="Mobile navigation"]');
      const links = Array.from(mobileNav?.querySelectorAll('a') ?? []);
      expect(links).toHaveLength(2);
      expect(links.map((link) => link.textContent?.trim())).toEqual(['Items', 'Config']);
      expect(links[1]).toHaveAttribute('aria-current', 'page');
    } finally {
      cleanup(root, container);
    }
  });

  it('redirects ordinary web access to the installed-only Config route', async () => {
    const { container, root } = renderShell('/wardrobe/config');

    try {
      await act(async () => {});

      expect(container.querySelector('[data-testid="installed-account-card"]')).toBeNull();
      expect(container.querySelector('[data-testid="wardrobe-grid"]')).toBeTruthy();
      const links = Array.from(
        document.body.querySelectorAll('nav[aria-label="Mobile navigation"] a'),
      );
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute('href', '/wardrobe/items');
    } finally {
      cleanup(root, container);
    }
  });
});
