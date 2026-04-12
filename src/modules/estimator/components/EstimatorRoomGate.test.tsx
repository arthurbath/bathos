import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EstimatorRoomGate } from '@/modules/estimator/components/EstimatorRoomGate';

const mockUseAuth = vi.fn();

vi.mock('@/platform/components/FeedbackDialog', () => ({
  FeedbackDialog: () => <div data-testid="feedback-dialog" />,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderComponent(props?: Partial<React.ComponentProps<typeof EstimatorRoomGate>>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/estimator/rooms/123456789012345678']}>
        <EstimatorRoomGate
          joinPending={false}
          message={null}
          onJoinRoom={async () => {}}
          {...props}
        />
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

describe('EstimatorRoomGate', () => {
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

  it('renders inside the estimator shell with the default description', () => {
    const { container, root } = renderComponent();
    try {
      expect(container.textContent).toContain('Ticket Estimator');
      expect(container.textContent).toContain('Join Room');
      expect(container.textContent).toContain('Enter a nickname to join this estimation room.');
      expect(container.textContent).not.toContain('Terms');
    } finally {
      cleanup(root, container);
    }
  });

  it('uses the inactive-identity message as the card description', () => {
    const message = 'Your previous room identity is no longer active. Enter a nickname to rejoin.';
    const { container, root } = renderComponent({ message });
    try {
      expect(container.textContent).toContain(message);
      expect(container.textContent).not.toContain('Enter a nickname to join this estimation room.');
    } finally {
      cleanup(root, container);
    }
  });
});
