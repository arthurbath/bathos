import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EstimatorIndex from '@/modules/estimator/EstimatorIndex';

const mockUseAuth = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/platform/components/FeedbackDialog', () => ({
  FeedbackDialog: () => <div data-testid="feedback-dialog" />,
}));

function renderComponent() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/estimator']}>
        <Routes>
          <Route path="/estimator" element={<EstimatorIndex />} />
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

describe('EstimatorIndex access', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      displayName: '',
      loading: false,
      isSigningOut: false,
      passwordRecoveryDetected: false,
      setDisplayName: vi.fn(),
      clearPasswordRecovery: vi.fn(),
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
    });
  });

  it('renders the public landing page without auth', () => {
    const { container, root } = renderComponent();
    try {
      expect(container.textContent).toContain('Ticket Estimator');
      expect(container.textContent).toContain('Create Room');
      expect(container.textContent).toContain('T-shirt Sizing');
      expect(container.textContent).toContain('Your Nickname');
      expect(container.textContent).not.toContain('Join Room');
      expect(container.textContent).not.toContain('Create a room, share its link, and estimate tickets together without signing in.');
      expect(container.querySelector('[title="All apps"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });
});
