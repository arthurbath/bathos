import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstalledAppAccountCard } from '@/platform/components/InstalledAppAccountCard';

vi.mock('@/platform/components/FeedbackDialog', () => ({
  FeedbackDialog: ({ trigger }: { trigger?: React.ReactNode }) => <>{trigger}</>,
}));

function setStandaloneMode(enabled: boolean) {
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: enabled,
  });
}

function mount(onSignOut = vi.fn()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/tasks/config']}>
        <InstalledAppAccountCard userId="user-1" displayName="Art" onSignOut={onSignOut} />
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

describe('InstalledAppAccountCard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/tasks/config');
    setStandaloneMode(false);
  });

  it('is absent in ordinary browser mode', () => {
    const { container, root } = mount();
    try {
      expect(container.querySelector('[data-installed-account-card]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('shows identity and all installed account actions', () => {
    setStandaloneMode(true);
    const onSignOut = vi.fn();
    const { container, root } = mount(onSignOut);

    try {
      expect(container.querySelector('[data-installed-account-card]')).toBeTruthy();
      expect(container.textContent).toContain('Art');
      expect(container.textContent).toContain('Account');
      expect(container.textContent).toContain('Feedback');
      expect(container.textContent).toContain('Sign Out');

      const signOut = Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Sign Out'));
      act(() => signOut?.click());
      expect(onSignOut).toHaveBeenCalledOnce();
    } finally {
      cleanup(root, container);
    }
  });
});
