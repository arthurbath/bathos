import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EstimatorLandingPage } from '@/modules/estimator/components/EstimatorLandingPage';

const mockNavigate = vi.fn();
const rpcMock = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/platform/components/FeedbackDialog', () => ({
  FeedbackDialog: () => <div data-testid="feedback-dialog" />,
}));

vi.mock('@/platform/components/HeaderUserControls', () => ({
  HeaderUserControls: ({ leadingAccessory }: { leadingAccessory?: React.ReactNode }) => (
    <div data-testid="header-user-controls">{leadingAccessory}</div>
  ),
}));

function renderComponent() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/estimator']}>
        <EstimatorLandingPage />
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

async function setInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  expect(descriptor?.set).toBeTruthy();

  await act(async () => {
    descriptor!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function waitForCondition(assertion: () => void, timeoutMs = 1500) {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    });
  }

  throw lastError instanceof Error ? lastError : new Error('Condition not met before timeout');
}

describe('EstimatorLandingPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockNavigate.mockReset();
    rpcMock.mockReset();
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

  it('creates a room and navigates to its public URL', async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === 'estimator_create_room') {
        return {
          data: {
            roomToken: '123456789012345678',
            joinCode: 'ABC123',
            name: 'Sprint Planning',
            votingMode: 'fibonacci',
          },
          error: null,
        };
      }

      if (fn === 'estimator_join_or_resume_room') {
        return {
          data: {
            room: {
              name: 'Sprint Planning',
              roomToken: '123456789012345678',
              joinCode: 'ABC123',
              votingMode: 'fibonacci',
            },
            member: {
              memberId: 'member-1',
              nickname: 'Art',
              memberSecret: 'secret-1',
            },
          },
          error: null,
        };
      }

      return { data: null, error: null };
    });

    const { container, root } = renderComponent();
    try {
      expect(container.textContent).toContain('T-shirt Sizing');
      expect(container.textContent).not.toContain('Join Room');
      expect(container.textContent).not.toContain('Terms');
      expect(container.textContent).not.toContain('Create a room, share its link, and estimate tickets together without signing in.');
      expect(container.querySelector('[title="All apps"]')).toBeNull();
      const fibonacciToggle = container.querySelector<HTMLButtonElement>('button[aria-label="Fibonacci sizing"]');
      const roomNameInput = container.querySelector<HTMLInputElement>('#estimator-room-name');
      const nicknameInput = container.querySelector<HTMLInputElement>('#estimator-room-nickname');
      const createForm = roomNameInput?.closest('form') ?? null;
      const createRoomButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create Room');

      expect(fibonacciToggle?.className).toContain('data-[state=on]:bg-primary');
      expect(fibonacciToggle?.className).toContain('data-[state=on]:text-primary-foreground');
      expect(createRoomButton?.className).toContain('bg-success');
      expect(roomNameInput).toBeTruthy();
      expect(nicknameInput).toBeTruthy();
      expect(createForm).toBeTruthy();

      await setInputValue(roomNameInput!, 'Sprint Planning');
      await setInputValue(nicknameInput!, 'Art');

      await act(async () => {
        createForm!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      await waitForCondition(() => {
        expect(rpcMock).toHaveBeenCalledWith('estimator_create_room', {
          _name: 'Sprint Planning',
          _voting_mode: 'fibonacci',
        });
        expect(rpcMock).toHaveBeenCalledWith('estimator_join_or_resume_room', {
          _room_token: '123456789012345678',
          _nickname: 'Art',
          _member_id: null,
          _member_secret: null,
        });
        expect(mockNavigate).toHaveBeenCalledWith('/estimator/rooms/123456789012345678');
      });
      expect(window.localStorage.getItem('estimator_room_identity:123456789012345678')).toContain('"nickname":"Art"');
    } finally {
      cleanup(root, container);
    }
  });

  it('shows the launcher button when an authenticated user visits the landing page', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      displayName: 'Art',
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

    const { container, root } = renderComponent();
    try {
      expect(container.querySelector('[title="All apps"]')).toBeTruthy();
      expect(container.querySelector<HTMLInputElement>('#estimator-room-nickname')?.value).toBe('Art');
    } finally {
      cleanup(root, container);
    }
  });
});
