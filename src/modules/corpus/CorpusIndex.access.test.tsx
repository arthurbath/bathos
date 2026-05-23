import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CorpusIndex from '@/modules/corpus/CorpusIndex';

const mockAuth = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth(),
}));

vi.mock('@/platform/components/AuthPage', () => ({
  default: () => <div data-testid="auth-page" />,
}));

vi.mock('@/modules/corpus/components/CorpusShell', () => ({
  CorpusShell: () => <div data-testid="corpus-shell" />,
}));

function renderComponent() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/corpus/documents']}>
        <Routes>
          <Route path="/corpus/documents" element={<CorpusIndex />} />
        </Routes>
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

describe('CorpusIndex access', () => {
  beforeEach(() => {
    mockAuth.mockReset();
  });

  it('shows the corpus shell for signed-in users', () => {
    mockAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      signOut: vi.fn(),
      isSigningOut: false,
      displayName: 'Art',
    });

    const { container, root } = renderComponent();
    try {
      expect(container.querySelector('[data-testid="corpus-shell"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('shows auth page for signed-out users', () => {
    mockAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
      isSigningOut: false,
      displayName: '',
    });

    const { container, root } = renderComponent();
    try {
      expect(container.querySelector('[data-testid="auth-page"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });
});
