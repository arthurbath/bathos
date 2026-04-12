import type { Json } from '@/integrations/supabase/types';
import { toUserFacingErrorMessage } from '@/lib/networkErrors';
import type {
  EstimatorActiveMember,
  EstimatorCreateRoomResult,
  EstimatorCurrentTicket,
  EstimatorHistoricalVoter,
  EstimatorRoomSnapshot,
  EstimatorSessionInfo,
  EstimatorTicketSummary,
  EstimatorVoteValue,
  EstimatorVotingMode,
} from '@/modules/estimator/types/estimator';

function expectRecord(value: Json, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} has an unexpected shape.`);
  }
  return value as Record<string, unknown>;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} is missing.`);
  }
  return value;
}

function expectNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} is missing.`);
  }
  return value;
}

function expectNumber(value: unknown, label: string): number {
  if (typeof value !== 'number') {
    throw new Error(`${label} is missing.`);
  }
  return value;
}

function expectVoteValue(value: unknown): EstimatorVoteValue | null {
  return typeof value === 'string' ? (value as EstimatorVoteValue) : null;
}

function expectVotingMode(value: unknown, label: string): EstimatorVotingMode {
  if (value !== 'ballpark' && value !== 'fibonacci') {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function expectArray(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is missing.`);
  }

  return value.map((entry, index) => expectRecord(entry as Json, `${label}[${index}]`));
}

function parseTicketSummary(value: Record<string, unknown>): EstimatorTicketSummary {
  return {
    id: expectString(value.id, 'Ticket id'),
    title: expectString(value.title, 'Ticket title'),
    sortOrder: expectNumber(value.sortOrder, 'Ticket sort order'),
    isCurrent: expectBoolean(value.isCurrent, 'Ticket current flag'),
    revealedAt: expectNullableString(value.revealedAt),
    isRevealed: expectBoolean(value.isRevealed, 'Ticket revealed flag'),
    hasVotes: expectBoolean(value.hasVotes, 'Ticket vote flag'),
    voteCount: expectNumber(value.voteCount, 'Ticket vote count'),
    officialSizeValue: expectVoteValue(value.officialSizeValue),
  };
}

function parseCurrentTicket(value: unknown): EstimatorCurrentTicket | null {
  if (value === null) return null;
  const record = expectRecord(value as Json, 'Current ticket');

  return {
    id: expectString(record.id, 'Current ticket id'),
    title: expectString(record.title, 'Current ticket title'),
    sortOrder: expectNumber(record.sortOrder, 'Current ticket sort order'),
    revealedAt: expectNullableString(record.revealedAt),
    isRevealed: expectBoolean(record.isRevealed, 'Current ticket revealed flag'),
    voteCount: expectNumber(record.voteCount, 'Current ticket vote count'),
    votedCount: expectNumber(record.votedCount, 'Current ticket voted count'),
    currentMemberVoteValue: expectVoteValue(record.currentMemberVoteValue),
    officialSizeValue: expectVoteValue(record.officialSizeValue),
  };
}

function parseActiveMember(value: Record<string, unknown>): EstimatorActiveMember {
  return {
    memberId: expectString(value.memberId, 'Member id'),
    nickname: expectString(value.nickname, 'Member nickname'),
    isSelf: expectBoolean(value.isSelf, 'Member self flag'),
    isPresent: expectBoolean(value.isPresent, 'Member presence'),
    lastSeenAt: expectString(value.lastSeenAt, 'Member last seen'),
    hasVoted: expectBoolean(value.hasVoted, 'Member vote flag'),
    voteValue: expectVoteValue(value.voteValue),
    votedAt: expectNullableString(value.votedAt),
  };
}

function parseHistoricalVoter(value: Record<string, unknown>): EstimatorHistoricalVoter {
  const voteValue = expectVoteValue(value.voteValue);
  if (!voteValue) {
    throw new Error('Historical vote is missing its value.');
  }

  return {
    memberId: expectString(value.memberId, 'Historical member id'),
    nickname: expectString(value.nickname, 'Historical nickname'),
    voteValue,
    votedAt: expectNullableString(value.votedAt),
  };
}

export function parseEstimatorCreateRoomResult(payload: Json): EstimatorCreateRoomResult {
  const record = expectRecord(payload, 'Create room response');
  return {
    roomToken: expectString(record.roomToken, 'Room token'),
    joinCode: expectString(record.joinCode, 'Join code'),
    name: expectNullableString(record.name),
    votingMode: expectVotingMode(record.votingMode, 'Voting mode'),
  };
}

export function parseEstimatorSessionInfo(payload: Json): EstimatorSessionInfo {
  const record = expectRecord(payload, 'Room session response');
  const room = expectRecord(record.room as Json, 'Room session room');
  const member = expectRecord(record.member as Json, 'Room session member');

  return {
    room: {
      name: expectNullableString(room.name),
      roomToken: expectString(room.roomToken, 'Room token'),
      joinCode: expectString(room.joinCode, 'Join code'),
      votingMode: expectVotingMode(room.votingMode, 'Voting mode'),
    },
    member: {
      memberId: expectString(member.memberId, 'Member id'),
      nickname: expectString(member.nickname, 'Member nickname'),
      ...(typeof member.memberSecret === 'string' ? { memberSecret: member.memberSecret } : {}),
    },
  };
}

export function parseEstimatorRoomSnapshot(payload: Json): EstimatorRoomSnapshot {
  const record = expectRecord(payload, 'Room snapshot');
  const room = expectRecord(record.room as Json, 'Room snapshot room');

  return {
    room: {
      name: expectNullableString(room.name),
      roomToken: expectString(room.roomToken, 'Room token'),
      joinCode: expectString(room.joinCode, 'Join code'),
      votingMode: expectVotingMode(room.votingMode, 'Voting mode'),
      currentTicketId: expectNullableString(room.currentTicketId),
      currentMemberId: expectString(room.currentMemberId, 'Current member id'),
      currentMemberNickname: expectString(room.currentMemberNickname, 'Current member nickname'),
    },
    tickets: expectArray(record.tickets, 'Tickets').map(parseTicketSummary),
    currentTicket: parseCurrentTicket(record.currentTicket),
    activeMembers: expectArray(record.activeMembers, 'Active members').map(parseActiveMember),
    historicalVoters: expectArray(record.historicalVoters, 'Historical voters').map(parseHistoricalVoter),
  };
}

export function isEstimatorAccessDeniedError(error: unknown): boolean {
  const message = toUserFacingErrorMessage(error).toLowerCase();
  return message.includes('room access denied') || message.includes('nickname is required');
}

export function isEstimatorMissingRoomError(error: unknown): boolean {
  const message = toUserFacingErrorMessage(error).toLowerCase();
  return message.includes('room not found') || message.includes('invalid join code');
}
