import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToplineHeader } from '@/platform/components/ToplineHeader';

const mockNavigate = vi.fn();
const mockIsAdmin = vi.fn();
const mockIsMobile = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/platform/hooks/useIsAdmin', () => ({
  useIsAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockIsMobile(),
}));

vi.mock('@/platform/components/FeedbackDialog', () => ({
  FeedbackDialog: ({ trigger }: { trigger?: React.ReactNode }) => (
    trigger ? <>{trigger}</> : <div data-testid="feedback-dialog" />
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div role="menu">{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div role="menuitem">{children}</div>,
}));

function mount(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function menuItemLabels(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[role="menuitem"]'))
    .map((item) => item.textContent?.replace(/\s+/g, ' ').trim())
    .filter((label): label is string => Boolean(label));
}

function mockStandaloneMode(enabled: boolean) {
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

describe('ToplineHeader administration access placement', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockIsAdmin.mockReset();
    mockIsMobile.mockReset();
    mockStandaloneMode(false);
  });

  it('shows admin icon in the topnav on desktop', () => {
    mockIsAdmin.mockReturnValue({ isAdmin: true, loading: false, resolved: true });
    mockIsMobile.mockReturnValue(false);

    const { container, root } = mount(
      <ToplineHeader title="Budget" userId="user-1" displayName="Art" onSignOut={vi.fn()} />,
    );

    try {
      const adminIconButton = container.querySelector('[title="Administration"]');
      expect(adminIconButton).toBeTruthy();

      expect(menuItemLabels(container)).not.toContain('Administration');
    } finally {
      unmount(root, container);
    }
  });

  it('moves admin access into the user menu on mobile above Account', () => {
    mockIsAdmin.mockReturnValue({ isAdmin: true, loading: false, resolved: true });
    mockIsMobile.mockReturnValue(true);

    const { container, root } = mount(
      <ToplineHeader title="Budget" userId="user-1" displayName="Art" onSignOut={vi.fn()} />,
    );

    try {
      const adminIconButton = container.querySelector('[title="Administration"]');
      expect(adminIconButton).toBeNull();

      const labels = menuItemLabels(container);

      expect(labels[0]).toBe('Administration');
      expect(labels[1]).toBe('Account');
      expect(labels[2]).toBe('Feedback');
      expect(labels[3]).toBe('Sign Out');
    } finally {
      unmount(root, container);
    }
  });
});

describe('ToplineHeader iOS standalone safe area', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockIsAdmin.mockReset();
    mockIsMobile.mockReset();
    mockIsAdmin.mockReturnValue({ isAdmin: false, loading: false, resolved: true });
    mockIsMobile.mockReturnValue(true);
  });

  it('adds top safe-area padding in iOS standalone mode', () => {
    mockStandaloneMode(true);
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });

    const { container, root } = mount(
      <ToplineHeader title="Budget" userId="user-1" displayName="Art" onSignOut={vi.fn()} />,
    );

    try {
      const header = container.querySelector('header');
      expect(header).toBeTruthy();
      expect(header?.className).toContain('pt-[env(safe-area-inset-top)]');
    } finally {
      unmount(root, container);
    }
  });
});
