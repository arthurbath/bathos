import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toUserFacingErrorMessage } from '@/lib/networkErrors';
import { showMutationError, supabaseRequest } from '@/lib/supabaseRequest';
import { withMutationTiming } from '@/lib/mutationTiming';
import {
  ESTIMATOR_HEARTBEAT_MS,
  ESTIMATOR_SNAPSHOT_POLL_MS,
} from '@/modules/estimator/lib/constants';
import {
  isEstimatorAccessDeniedError,
  isEstimatorMissingRoomError,
  parseEstimatorRoomSnapshot,
  parseEstimatorSessionInfo,
} from '@/modules/estimator/lib/parsers';
import {
  clearEstimatorStoredIdentity,
  readEstimatorStoredIdentity,
  writeEstimatorStoredIdentity,
} from '@/modules/estimator/lib/storage';
import type {
  EstimatorRoomSnapshot,
  EstimatorStoredIdentity,
  EstimatorVoteValue,
  EstimatorVotingMode,
} from '@/modules/estimator/types/estimator';

function getRoomSnapshotQueryKey(roomToken: string, memberId: string | null) {
  return ['estimator', 'room', roomToken, memberId ?? 'guest'] as const;
}

function reorderSnapshotTickets(
  snapshot: EstimatorRoomSnapshot,
  ticketId: string,
  targetIndex: number,
): EstimatorRoomSnapshot {
  const sourceIndex = snapshot.tickets.findIndex((ticket) => ticket.id === ticketId);
  if (sourceIndex < 0) return snapshot;

  const boundedTargetIndex = Math.max(0, Math.min(snapshot.tickets.length - 1, targetIndex));
  if (boundedTargetIndex === sourceIndex) return snapshot;

  const nextTickets = [...snapshot.tickets];
  const [movedTicket] = nextTickets.splice(sourceIndex, 1);
  nextTickets.splice(boundedTargetIndex, 0, movedTicket);

  const normalizedTickets = nextTickets.map((ticket, index) => ({
    ...ticket,
    sortOrder: index,
  }));

  return {
    ...snapshot,
    tickets: normalizedTickets,
    currentTicket: snapshot.currentTicket
      ? {
          ...snapshot.currentTicket,
          sortOrder: normalizedTickets.findIndex((ticket) => ticket.id === snapshot.currentTicket?.id),
        }
      : null,
  };
}

function useDocumentVisibility(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');

  useEffect(() => {
    const handleVisibilityChange = () => {
      setVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return visible;
}

interface RunMutationOptions {
  action: string;
  fn: () => Promise<void>;
}

export function useEstimatorRoom(roomToken: string) {
  const queryClient = useQueryClient();
  const isVisible = useDocumentVisibility();
  const [identity, setIdentity] = useState<EstimatorStoredIdentity | null>(() => readEstimatorStoredIdentity(roomToken));
  const [initializingIdentity, setInitializingIdentity] = useState(() => readEstimatorStoredIdentity(roomToken) !== null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [joinPending, setJoinPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    const storedIdentity = readEstimatorStoredIdentity(roomToken);
    setIdentity(storedIdentity);
    setInitializingIdentity(storedIdentity !== null);
    setGateMessage(null);
  }, [roomToken]);

  const clearIdentity = useCallback((message?: string) => {
    clearEstimatorStoredIdentity(roomToken);
    setIdentity(null);
    setInitializingIdentity(false);
    setGateMessage(message ?? null);
  }, [roomToken]);

  useEffect(() => {
    if (!identity) {
      setInitializingIdentity(false);
      return;
    }

    let cancelled = false;

    const resumeIdentity = async () => {
      setInitializingIdentity(true);

      try {
        const payload = await supabaseRequest(() =>
          supabase.rpc('estimator_join_or_resume_room', {
            _room_token: roomToken,
            _nickname: null,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
          }),
        );
        const session = parseEstimatorSessionInfo(payload);
        const nextIdentity: EstimatorStoredIdentity = {
          memberId: session.member.memberId,
          memberSecret: identity.memberSecret,
          nickname: session.member.nickname,
        };

        if (cancelled) return;

        writeEstimatorStoredIdentity(roomToken, nextIdentity);
        setIdentity((current) => {
          if (
            current &&
            current.memberId === nextIdentity.memberId &&
            current.memberSecret === nextIdentity.memberSecret &&
            current.nickname === nextIdentity.nickname
          ) {
            return current;
          }
          return nextIdentity;
        });
        setGateMessage(null);
      } catch (error) {
        if (cancelled) return;

        if (isEstimatorAccessDeniedError(error) || isEstimatorMissingRoomError(error)) {
          clearIdentity('Enter a nickname to join this room.');
          return;
        }
      } finally {
        if (!cancelled) {
          setInitializingIdentity(false);
        }
      }
    };

    void resumeIdentity();

    return () => {
      cancelled = true;
    };
  }, [clearIdentity, identity, roomToken]);

  const snapshotQuery = useQuery({
    queryKey: getRoomSnapshotQueryKey(roomToken, identity?.memberId ?? null),
    enabled: !!identity && !initializingIdentity,
    queryFn: async (): Promise<EstimatorRoomSnapshot> => {
      if (!identity) {
        throw new Error('Room identity is required');
      }

      const payload = await supabaseRequest(() =>
        supabase.rpc('estimator_get_room_snapshot', {
          _room_token: roomToken,
          _member_id: identity.memberId,
          _member_secret: identity.memberSecret,
        }),
      );

      return parseEstimatorRoomSnapshot(payload);
    },
    refetchInterval: identity && isVisible ? ESTIMATOR_SNAPSHOT_POLL_MS : false,
    retry: (failureCount, error) => !isEstimatorAccessDeniedError(error) && failureCount < 2,
  });

  useEffect(() => {
    if (!snapshotQuery.error) return;
    if (!isEstimatorAccessDeniedError(snapshotQuery.error)) return;
    clearIdentity('Your previous room identity is no longer active. Enter a nickname to rejoin.');
  }, [clearIdentity, snapshotQuery.error]);

  useEffect(() => {
    if (!identity || !isVisible || initializingIdentity) return;

    let cancelled = false;

    const sendHeartbeat = async () => {
      try {
        await supabaseRequest(() =>
          supabase.rpc('estimator_room_heartbeat', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
          }),
        );
      } catch (error) {
        if (cancelled) return;
        if (isEstimatorAccessDeniedError(error)) {
          clearIdentity('Your previous room identity is no longer active. Enter a nickname to rejoin.');
        }
      }
    };

    void sendHeartbeat();
    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, ESTIMATOR_HEARTBEAT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [clearIdentity, identity, initializingIdentity, isVisible, roomToken]);

  const invalidateSnapshot = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: getRoomSnapshotQueryKey(roomToken, identity?.memberId ?? null),
    });
  }, [identity?.memberId, queryClient, roomToken]);

  const runMutation = useCallback(async ({ action, fn }: RunMutationOptions) => {
    setPendingAction(action);

    try {
      await withMutationTiming({ module: 'estimator', action }, fn);
      await invalidateSnapshot();
    } catch (error) {
      if (isEstimatorAccessDeniedError(error)) {
        clearIdentity('Your previous room identity is no longer active. Enter a nickname to rejoin.');
      } else {
        showMutationError(error);
      }
      throw error;
    } finally {
      setPendingAction(null);
    }
  }, [clearIdentity, invalidateSnapshot]);

  const joinRoom = useCallback(async (nickname: string) => {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      throw new Error('Nickname is required');
    }

    setJoinPending(true);

    try {
      const payload = await withMutationTiming({ module: 'estimator', action: 'room.join' }, async () =>
        await supabaseRequest(() =>
          supabase.rpc('estimator_join_or_resume_room', {
            _room_token: roomToken,
            _nickname: trimmedNickname,
            _member_id: null,
            _member_secret: null,
          }),
        ),
      );

      const session = parseEstimatorSessionInfo(payload);
      if (!session.member.memberSecret) {
        throw new Error('Room session is missing its member secret.');
      }

      const nextIdentity: EstimatorStoredIdentity = {
        memberId: session.member.memberId,
        memberSecret: session.member.memberSecret,
        nickname: session.member.nickname,
      };

      writeEstimatorStoredIdentity(roomToken, nextIdentity);
      setIdentity(nextIdentity);
      setGateMessage(null);
      await queryClient.invalidateQueries({ queryKey: ['estimator', 'room', roomToken] });
    } catch (error) {
      showMutationError(error);
      throw error;
    } finally {
      setJoinPending(false);
    }
  }, [queryClient, roomToken]);

  const updateStoredNickname = useCallback((nickname: string) => {
    setIdentity((current) => {
      if (!current) return current;
      const nextIdentity = { ...current, nickname };
      writeEstimatorStoredIdentity(roomToken, nextIdentity);
      return nextIdentity;
    });
  }, [roomToken]);

  const renameSelf = useCallback(async (nickname: string) => {
    const trimmedNickname = nickname.trim();
    if (!identity) throw new Error('Join the room first');
    if (!trimmedNickname) throw new Error('Nickname is required');

    await runMutation({
      action: 'room.rename',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_rename_room_member', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _nickname: trimmedNickname,
          }),
        );
        updateStoredNickname(trimmedNickname);
      },
    });
  }, [identity, roomToken, runMutation, updateStoredNickname]);

  const renameRoom = useCallback(async (name: string) => {
    const trimmedName = name.trim();
    if (!identity) throw new Error('Join the room first');
    if (!trimmedName) throw new Error('Room name is required');

    await runMutation({
      action: 'room.renameRoom',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_rename_room', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _name: trimmedName,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const addTicket = useCallback(async (title: string) => {
    const trimmedTitle = title.trim();
    if (!identity) throw new Error('Join the room first');
    if (!trimmedTitle) throw new Error('Ticket title is required');

    await runMutation({
      action: 'tickets.add',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_add_ticket', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _title: trimmedTitle,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const importTickets = useCallback(async (titles: string[]) => {
    if (!identity) throw new Error('Join the room first');

    const normalizedTitles = titles
      .map((title) => title.trim())
      .filter((title) => title.length > 0);

    if (normalizedTitles.length === 0) {
      throw new Error('At least one ticket title is required.');
    }

    await runMutation({
      action: 'tickets.import',
      fn: async () => {
        for (const title of normalizedTitles) {
          await supabaseRequest(() =>
            supabase.rpc('estimator_add_ticket', {
              _room_token: roomToken,
              _member_id: identity.memberId,
              _member_secret: identity.memberSecret,
              _title: title,
            }),
          );
        }
      },
    });
  }, [identity, roomToken, runMutation]);

  const updateTicketTitle = useCallback(async (ticketId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!identity) throw new Error('Join the room first');
    if (!trimmedTitle) throw new Error('Ticket title is required');

    await runMutation({
      action: 'tickets.rename',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_update_ticket_title', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _ticket_id: ticketId,
            _title: trimmedTitle,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const removeTicket = useCallback(async (ticketId: string) => {
    if (!identity) throw new Error('Join the room first');

    await runMutation({
      action: 'tickets.remove',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_remove_ticket', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _ticket_id: ticketId,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const resetTickets = useCallback(async () => {
    if (!identity) throw new Error('Join the room first');

    const tickets = [...(snapshotQuery.data?.tickets ?? [])].sort((left, right) => right.sortOrder - left.sortOrder);
    if (tickets.length === 0) {
      return;
    }

    await runMutation({
      action: 'tickets.resetAll',
      fn: async () => {
        for (const ticket of tickets) {
          await supabaseRequest(() =>
            supabase.rpc('estimator_remove_ticket', {
              _room_token: roomToken,
              _member_id: identity.memberId,
              _member_secret: identity.memberSecret,
              _ticket_id: ticket.id,
            }),
          );
        }
      },
    });
  }, [identity, roomToken, runMutation, snapshotQuery.data?.tickets]);

  const setOfficialSize = useCallback(async (ticketId: string, voteValue: EstimatorVoteValue) => {
    if (!identity) throw new Error('Join the room first');

    await runMutation({
      action: 'tickets.setOfficialSize',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_set_ticket_official_size', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _ticket_id: ticketId,
            _vote_value: voteValue,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const clearOfficialSize = useCallback(async (ticketId: string) => {
    if (!identity) throw new Error('Join the room first');

    await runMutation({
      action: 'tickets.clearOfficialSize',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_clear_ticket_official_size', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _ticket_id: ticketId,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const moveTicket = useCallback(async (ticketId: string, targetIndex: number) => {
    if (!identity) throw new Error('Join the room first');

    const queryKey = getRoomSnapshotQueryKey(roomToken, identity.memberId);
    const previousSnapshot = queryClient.getQueryData<EstimatorRoomSnapshot>(queryKey);
    if (!previousSnapshot) throw new Error('Room snapshot is unavailable');

    const sourceIndex = previousSnapshot.tickets.findIndex((ticket) => ticket.id === ticketId);
    if (sourceIndex < 0) throw new Error('Ticket not found');

    const boundedTargetIndex = Math.max(0, Math.min(previousSnapshot.tickets.length - 1, targetIndex));
    if (boundedTargetIndex === sourceIndex) return;

    queryClient.setQueryData<EstimatorRoomSnapshot>(
      queryKey,
      reorderSnapshotTickets(previousSnapshot, ticketId, boundedTargetIndex),
    );

    try {
      await runMutation({
        action: 'tickets.move',
        fn: async () => {
          await supabaseRequest(() =>
            supabase.rpc('estimator_reorder_ticket', {
              _room_token: roomToken,
              _member_id: identity.memberId,
              _member_secret: identity.memberSecret,
              _ticket_id: ticketId,
              _target_sort_order: boundedTargetIndex,
            }),
          );
        },
      });
    } catch (error) {
      queryClient.setQueryData(queryKey, previousSnapshot);
      throw error;
    }
  }, [identity, queryClient, roomToken, runMutation]);

  const setCurrentTicket = useCallback(async (ticketId: string) => {
    if (!identity) throw new Error('Join the room first');

    await runMutation({
      action: 'tickets.setCurrent',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_set_current_ticket', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _ticket_id: ticketId,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const setVotingMode = useCallback(async (votingMode: EstimatorVotingMode) => {
    if (!identity) throw new Error('Join the room first');

    await runMutation({
      action: 'room.setVotingMode',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_set_room_voting_mode', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _voting_mode: votingMode,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const castVote = useCallback(async (ticketId: string, voteValue: EstimatorVoteValue) => {
    if (!identity) throw new Error('Join the room first');

    await runMutation({
      action: 'tickets.castVote',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_cast_vote', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _ticket_id: ticketId,
            _vote_value: voteValue,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const revealVotes = useCallback(async (ticketId: string) => {
    if (!identity) throw new Error('Join the room first');

    await runMutation({
      action: 'tickets.revealVotes',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_reveal_ticket_votes', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _ticket_id: ticketId,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const reopenVoting = useCallback(async (ticketId: string) => {
    if (!identity) throw new Error('Join the room first');

    await runMutation({
      action: 'tickets.reopenVoting',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_reopen_ticket_voting', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _ticket_id: ticketId,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const resetVoting = useCallback(async (ticketId: string) => {
    if (!identity) throw new Error('Join the room first');

    await runMutation({
      action: 'tickets.resetVoting',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_reset_ticket_voting', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _ticket_id: ticketId,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const kickMember = useCallback(async (targetMemberId: string) => {
    if (!identity) throw new Error('Join the room first');

    await runMutation({
      action: 'room.kickMember',
      fn: async () => {
        await supabaseRequest(() =>
          supabase.rpc('estimator_kick_room_member', {
            _room_token: roomToken,
            _member_id: identity.memberId,
            _member_secret: identity.memberSecret,
            _target_member_id: targetMemberId,
          }),
        );
      },
    });
  }, [identity, roomToken, runMutation]);

  const errorMessage = useMemo(() => {
    if (!snapshotQuery.error) return null;
    return toUserFacingErrorMessage(snapshotQuery.error);
  }, [snapshotQuery.error]);

  return {
    roomToken,
    identity,
    snapshot: snapshotQuery.data ?? null,
    initializingIdentity,
    joinPending,
    pendingAction,
    gateMessage,
    errorMessage,
    loadingSnapshot: snapshotQuery.isLoading,
    joinRoom,
    renameRoom,
    renameSelf,
    addTicket,
    importTickets,
    updateTicketTitle,
    removeTicket,
    resetTickets,
    moveTicket,
    setCurrentTicket,
    setVotingMode,
    castVote,
    setOfficialSize,
    clearOfficialSize,
    revealVotes,
    reopenVoting,
    resetVoting,
    kickMember,
  };
}
