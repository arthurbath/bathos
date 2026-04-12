import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEstimatorRoom } from '@/modules/estimator/hooks/useEstimatorRoom';

const rpcMock = vi.fn();
const showMutationErrorMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock('@/lib/supabaseRequest', () => ({
  supabaseRequest: async (operation: () => Promise<{ data: unknown; error: unknown }>) => {
    const result = await operation();
    if (result.error) throw result.error;
    return result.data;
  },
  showMutationError: (...args: unknown[]) => showMutationErrorMock(...args),
}));

vi.mock('@/lib/mutationTiming', () => ({
  withMutationTiming: async (_meta: unknown, run: () => Promise<unknown>) => await run(),
}));

function HookHarness({ roomToken }: { roomToken: string }) {
  const room = useEstimatorRoom(roomToken);

  return (
    <div>
      <div
        data-testid="state"
        data-has-identity={String(Boolean(room.identity))}
        data-join-pending={String(room.joinPending)}
        data-loading-snapshot={String(room.loadingSnapshot)}
      >
        {room.snapshot?.room.currentMemberNickname ?? ''}
      </div>
      <div data-testid="gate-message">{room.gateMessage ?? ''}</div>
      <button type="button" data-testid="join" onClick={() => { void room.joinRoom('Art'); }}>join</button>
    </div>
  );
}

function mount(roomToken = '123456789012345678') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <HookHarness roomToken={roomToken} />
      </QueryClientProvider>,
    );
  });

  return { container, root, queryClient };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
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

describe('useEstimatorRoom', () => {
  beforeEach(() => {
    window.localStorage.clear();
    rpcMock.mockReset();
    showMutationErrorMock.mockReset();
  });

  it('joins a room and stores the browser identity', async () => {
    rpcMock.mockImplementation(async (fn: string) => {
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

      if (fn === 'estimator_get_room_snapshot') {
        return {
          data: {
            room: {
              name: 'Sprint Planning',
              roomToken: '123456789012345678',
              joinCode: 'ABC123',
              votingMode: 'fibonacci',
              currentTicketId: null,
              currentMemberId: 'member-1',
              currentMemberNickname: 'Art',
            },
            tickets: [],
            currentTicket: null,
            activeMembers: [
              {
                memberId: 'member-1',
                nickname: 'Art',
                isSelf: true,
                isPresent: true,
                lastSeenAt: '2026-04-12T12:00:00.000Z',
                hasVoted: false,
                voteValue: null,
                votedAt: null,
              },
            ],
            historicalVoters: [],
          },
          error: null,
        };
      }

      if (fn === 'estimator_room_heartbeat') {
        return { data: { memberId: 'member-1', lastSeenAt: '2026-04-12T12:00:00.000Z' }, error: null };
      }

      return { data: null, error: null };
    });

    const { container, root } = mount();
    try {
      const joinButton = container.querySelector('[data-testid="join"]') as HTMLButtonElement | null;
      expect(joinButton).toBeTruthy();

      await act(async () => {
        joinButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await waitForCondition(() => {
        const state = container.querySelector('[data-testid="state"]');
        expect(state?.getAttribute('data-has-identity')).toBe('true');
        expect(state?.textContent).toBe('Art');
      });

      expect(window.localStorage.getItem('estimator_room_identity:123456789012345678')).toContain('"memberId":"member-1"');
    } finally {
      cleanup(root, container);
    }
  });

  it('auto-resumes a stored browser identity', async () => {
    window.localStorage.setItem(
      'estimator_room_identity:123456789012345678',
      JSON.stringify({
        memberId: 'member-2',
        memberSecret: 'secret-2',
        nickname: 'Taylor',
      }),
    );

    rpcMock.mockImplementation(async (fn: string) => {
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
              memberId: 'member-2',
              nickname: 'Taylor',
            },
          },
          error: null,
        };
      }

      if (fn === 'estimator_get_room_snapshot') {
        return {
          data: {
            room: {
              name: 'Sprint Planning',
              roomToken: '123456789012345678',
              joinCode: 'ABC123',
              votingMode: 'fibonacci',
              currentTicketId: null,
              currentMemberId: 'member-2',
              currentMemberNickname: 'Taylor',
            },
            tickets: [],
            currentTicket: null,
            activeMembers: [
              {
                memberId: 'member-2',
                nickname: 'Taylor',
                isSelf: true,
                isPresent: true,
                lastSeenAt: '2026-04-12T12:00:00.000Z',
                hasVoted: false,
                voteValue: null,
                votedAt: null,
              },
            ],
            historicalVoters: [],
          },
          error: null,
        };
      }

      if (fn === 'estimator_room_heartbeat') {
        return { data: { memberId: 'member-2', lastSeenAt: '2026-04-12T12:00:00.000Z' }, error: null };
      }

      return { data: null, error: null };
    });

    const { container, root } = mount();
    try {
      await waitForCondition(() => {
        const state = container.querySelector('[data-testid="state"]');
        expect(state?.getAttribute('data-has-identity')).toBe('true');
        expect(state?.textContent).toBe('Taylor');
      });

      expect(rpcMock).toHaveBeenCalledWith('estimator_join_or_resume_room', {
        _room_token: '123456789012345678',
        _nickname: null,
        _member_id: 'member-2',
        _member_secret: 'secret-2',
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('clears an invalid stored identity and returns to the nickname gate', async () => {
    window.localStorage.setItem(
      'estimator_room_identity:123456789012345678',
      JSON.stringify({
        memberId: 'member-3',
        memberSecret: 'secret-3',
        nickname: 'Jordan',
      }),
    );

    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === 'estimator_join_or_resume_room') {
        return { data: null, error: new Error('Room access denied') };
      }

      return { data: null, error: null };
    });

    const { container, root } = mount();
    try {
      await waitForCondition(() => {
        const state = container.querySelector('[data-testid="state"]');
        const gateMessage = container.querySelector('[data-testid="gate-message"]');
        expect(state?.getAttribute('data-has-identity')).toBe('false');
        expect(gateMessage?.textContent).toContain('Enter a nickname to join this room.');
      });

      expect(window.localStorage.getItem('estimator_room_identity:123456789012345678')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });
});
