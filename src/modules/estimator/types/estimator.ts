import type { Database } from '@/integrations/supabase/types';

export type EstimatorVotingMode = Database['public']['Enums']['estimator_voting_mode'];

export type EstimatorVoteValue =
  | 'XXS'
  | 'XS'
  | 'S'
  | 'M'
  | 'L'
  | 'XL'
  | 'XXL+'
  | '1'
  | '2'
  | '3'
  | '5'
  | '8'
  | '13'
  | '21+';

export interface EstimatorStoredIdentity {
  memberId: string;
  memberSecret: string;
  nickname: string;
}

export interface EstimatorCreateRoomResult {
  roomToken: string;
  joinCode: string;
  name: string | null;
  votingMode: EstimatorVotingMode;
}

export interface EstimatorSessionInfo {
  room: {
    name: string | null;
    roomToken: string;
    joinCode: string;
    votingMode: EstimatorVotingMode;
  };
  member: {
    memberId: string;
    nickname: string;
    memberSecret?: string;
  };
}

export interface EstimatorTicketSummary {
  id: string;
  title: string;
  sortOrder: number;
  isCurrent: boolean;
  revealedAt: string | null;
  isRevealed: boolean;
  hasVotes: boolean;
  voteCount: number;
  officialSizeValue: EstimatorVoteValue | null;
}

export interface EstimatorCurrentTicket {
  id: string;
  title: string;
  sortOrder: number;
  revealedAt: string | null;
  isRevealed: boolean;
  voteCount: number;
  votedCount: number;
  currentMemberVoteValue: EstimatorVoteValue | null;
  officialSizeValue: EstimatorVoteValue | null;
}

export interface EstimatorActiveMember {
  memberId: string;
  nickname: string;
  isSelf: boolean;
  isPresent: boolean;
  lastSeenAt: string;
  hasVoted: boolean;
  voteValue: EstimatorVoteValue | null;
  votedAt: string | null;
}

export interface EstimatorHistoricalVoter {
  memberId: string;
  nickname: string;
  voteValue: EstimatorVoteValue;
  votedAt: string | null;
}

export interface EstimatorRoomSnapshot {
  room: {
    name: string | null;
    roomToken: string;
    joinCode: string;
    votingMode: EstimatorVotingMode;
    currentTicketId: string | null;
    currentMemberId: string;
    currentMemberNickname: string;
  };
  tickets: EstimatorTicketSummary[];
  currentTicket: EstimatorCurrentTicket | null;
  activeMembers: EstimatorActiveMember[];
  historicalVoters: EstimatorHistoricalVoter[];
}
