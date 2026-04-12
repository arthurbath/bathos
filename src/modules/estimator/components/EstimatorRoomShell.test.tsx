import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EstimatorRoomShell } from '@/modules/estimator/components/EstimatorRoomShell';
import type { EstimatorRoomSnapshot } from '@/modules/estimator/types/estimator';

const mockUseAuth = vi.fn();

vi.mock('@/platform/components/FeedbackDialog', () => ({
  FeedbackDialog: () => <div data-testid="feedback-dialog" />,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

const baseSnapshot: EstimatorRoomSnapshot = {
  room: {
    name: 'Sprint Planning',
    roomToken: '123456789012345678',
    joinCode: 'ABC123',
    votingMode: 'fibonacci',
    currentTicketId: 'ticket-1',
    currentMemberId: 'member-1',
    currentMemberNickname: 'Art',
  },
  tickets: [
    {
      id: 'ticket-1',
      title: 'Build login form',
      sortOrder: 0,
      isCurrent: true,
      revealedAt: null,
      isRevealed: false,
      hasVotes: true,
      voteCount: 1,
      officialSizeValue: null,
    },
    {
      id: 'ticket-2',
      title: 'Ship release notes',
      sortOrder: 1,
      isCurrent: false,
      revealedAt: '2026-04-12T12:00:00.000Z',
      isRevealed: true,
      hasVotes: true,
      voteCount: 2,
      officialSizeValue: null,
    },
  ],
  currentTicket: {
    id: 'ticket-1',
    title: 'Build login form',
    sortOrder: 0,
    revealedAt: null,
    isRevealed: false,
    voteCount: 1,
    votedCount: 1,
    currentMemberVoteValue: '5',
    officialSizeValue: null,
  },
  activeMembers: [
    {
      memberId: 'member-1',
      nickname: 'Art',
      isSelf: true,
      isPresent: true,
      lastSeenAt: '2026-04-12T12:00:00.000Z',
      hasVoted: true,
      voteValue: null,
      votedAt: '2026-04-12T12:00:00.000Z',
    },
    {
      memberId: 'member-2',
      nickname: 'Taylor',
      isSelf: false,
      isPresent: false,
      lastSeenAt: '2026-04-12T11:59:00.000Z',
      hasVoted: false,
      voteValue: null,
      votedAt: null,
    },
  ],
  historicalVoters: [],
};

function renderComponent(snapshot: EstimatorRoomSnapshot, overrides?: Partial<React.ComponentProps<typeof EstimatorRoomShell>>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const props: React.ComponentProps<typeof EstimatorRoomShell> = {
    pendingAction: null,
    snapshot,
    onRenameRoom: async () => {},
    onRenameSelf: async () => {},
    onAddTicket: async () => {},
    onImportTickets: async () => {},
    onUpdateTicketTitle: async () => {},
    onRemoveTicket: async () => {},
    onResetTickets: async () => {},
    onMoveTicket: async () => {},
    onSetCurrentTicket: async () => {},
    onSetVotingMode: async () => {},
    onCastVote: async () => {},
    onSetOfficialSize: async () => {},
    onClearOfficialSize: async () => {},
    onRevealVotes: async () => {},
    onReopenVoting: async () => {},
    onResetVoting: async () => {},
    onKickMember: async () => {},
    ...overrides,
  };

  act(() => {
    root.render(
      <TooltipProvider>
        <MemoryRouter initialEntries={['/estimator/rooms/123456789012345678']}>
          <EstimatorRoomShell {...props} />
        </MemoryRouter>
      </TooltipProvider>,
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

async function openMenu(trigger: Element | null) {
  await act(async () => {
    trigger?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    trigger?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    trigger?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    await Promise.resolve();
  });
}

function createDataTransfer() {
  const values = new Map<string, string>();

  return {
    dropEffect: 'move',
    effectAllowed: 'move',
    getData: (type: string) => values.get(type) ?? '',
    setData: (type: string, value: string) => {
      values.set(type, value);
    },
  };
}

describe('EstimatorRoomShell', () => {
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

  it('renders concealed voting status before reveal', () => {
    const { container, root } = renderComponent(baseSnapshot);
    try {
      expect(container.textContent).toContain('1 of 2 members voted');
      expect(container.textContent).toContain('Voted');
      expect(container.textContent).toContain('Waiting');
      expect(container.textContent).not.toContain('Vote Spread');
      expect(container.querySelector('[title="Back"]')).toBeNull();
      expect(container.textContent).not.toContain('Current vote 5');
      expect(container.textContent).not.toContain('Hidden');
      expect(container.querySelector('button[aria-label="Actions for Build login form"]')).toBeTruthy();
      expect(container.querySelector('button[aria-label="Rename ticket"]')).toBeNull();
      expect(container.querySelector('button[aria-label="Delete ticket"]')).toBeNull();

      const selectedVoteButton = container.querySelector('button[aria-label="Vote 5"]');
      expect(selectedVoteButton?.getAttribute('data-state')).toBe('on');
      expect(selectedVoteButton?.className).toContain('data-[state=on]:!bg-primary');
      expect(selectedVoteButton?.className).toContain('data-[state=on]:!text-primary-foreground');
      expect(selectedVoteButton?.className).toContain('px-2');

      const cardTitles = Array.from(container.querySelectorAll('h3')).map((element) => element.textContent);
      expect(cardTitles.slice(0, 3)).toEqual(['Build login form', 'Tickets', 'Members']);
      expect(container.textContent).not.toContain('Share');
    } finally {
      cleanup(root, container);
    }
  });

  it('uses a single empty-state call to action when there are no tickets yet', async () => {
    const emptySnapshot: EstimatorRoomSnapshot = {
      ...baseSnapshot,
      tickets: [],
      currentTicket: null,
      room: {
        ...baseSnapshot.room,
        currentTicketId: null,
      },
      activeMembers: [
        {
          ...baseSnapshot.activeMembers[0],
          hasVoted: false,
          votedAt: null,
        },
        {
          ...baseSnapshot.activeMembers[1],
          hasVoted: false,
          votedAt: null,
        },
      ],
    };

    const { container, root } = renderComponent(emptySnapshot);
    try {
      expect(container.textContent).toContain('Add Tickets to Start Voting');
      expect(container.textContent).not.toContain('No tickets yet.');
      expect(container.textContent).not.toContain('No Current Ticket');
      expect(container.textContent).not.toContain('Select or add a ticket to start estimating.');

      const ctaButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Add Tickets to Start Voting');
      const ticketInput = container.querySelector('input[placeholder="Add a ticket"]') as HTMLInputElement | null;

      expect(ctaButton).toBeTruthy();
      expect(ticketInput).toBeTruthy();

      await act(async () => {
        ctaButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      expect(document.activeElement).toBe(ticketInput);
    } finally {
      cleanup(root, container);
    }
  });

  it('renders revealed votes and historical voters after reveal', () => {
    const revealedSnapshot: EstimatorRoomSnapshot = {
      ...baseSnapshot,
      currentTicket: {
        ...baseSnapshot.currentTicket!,
        revealedAt: '2026-04-12T12:02:00.000Z',
        isRevealed: true,
        voteCount: 3,
        votedCount: 2,
        officialSizeValue: null,
      },
      activeMembers: [
        {
          ...baseSnapshot.activeMembers[0],
          voteValue: '5',
        },
        {
          ...baseSnapshot.activeMembers[1],
          hasVoted: true,
          voteValue: '8',
          votedAt: '2026-04-12T12:01:00.000Z',
        },
      ],
      historicalVoters: [
        {
          memberId: 'member-3',
          nickname: 'Jordan',
          voteValue: '3',
          votedAt: '2026-04-12T12:00:30.000Z',
        },
      ],
    };

    const { container, root } = renderComponent(revealedSnapshot);
    try {
      const revealedTicketRow = container.querySelector('[data-ticket-id="ticket-2"]');
      expect(container.textContent).toContain('Reopen Voting');
      expect(container.textContent).toContain('Reset Voting');
      expect(container.textContent).not.toContain('Reveal Votes');
      expect(container.textContent).toContain('2 of 2 members voted');
      expect(container.textContent).toContain('Vote Spread');
      expect(container.textContent?.indexOf('Vote Spread')).toBeLessThan(container.textContent?.indexOf('Your Vote') ?? -1);
      expect(container.textContent).toContain('5 × 1');
      expect(container.textContent).toContain('8 × 1');
      expect(container.textContent).toContain('3 × 1');
      expect(container.textContent?.indexOf('3 × 1')).toBeLessThan(container.textContent?.indexOf('5 × 1') ?? -1);
      expect(container.textContent?.indexOf('5 × 1')).toBeLessThan(container.textContent?.indexOf('8 × 1') ?? -1);
      expect(container.textContent).toContain('Vote: 5');
      expect(container.textContent).toContain('Vote: 8');
      expect(container.textContent).toContain('Past Voters');
      expect(container.textContent).toContain('Jordan');
      expect(revealedTicketRow?.textContent).toContain('2 Votes');
      expect(revealedTicketRow?.querySelector('[data-ticket-vote-count-badge="ticket-2"]')?.className).toContain('text-warning');
      expect(revealedTicketRow?.querySelector('[data-ticket-vote-count-badge="ticket-2"]')?.textContent).toContain('2 Votes');
      expect(revealedTicketRow?.querySelector('[data-ticket-official-size-badge="ticket-2"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('allows selecting an official size from the revealed vote spread and shows it in the ticket stack', async () => {
    const onSetOfficialSize = vi.fn().mockResolvedValue(undefined);
    const onClearOfficialSize = vi.fn().mockResolvedValue(undefined);
    const officialSnapshot: EstimatorRoomSnapshot = {
      ...baseSnapshot,
      tickets: [
        {
          ...baseSnapshot.tickets[0],
          revealedAt: '2026-04-12T12:02:00.000Z',
          isRevealed: true,
          voteCount: 2,
          officialSizeValue: '8',
        },
        baseSnapshot.tickets[1],
      ],
      currentTicket: {
        ...baseSnapshot.currentTicket!,
        revealedAt: '2026-04-12T12:02:00.000Z',
        isRevealed: true,
        voteCount: 2,
        votedCount: 2,
        officialSizeValue: '8',
      },
      activeMembers: [
        {
          ...baseSnapshot.activeMembers[0],
          voteValue: '5',
        },
        {
          ...baseSnapshot.activeMembers[1],
          hasVoted: true,
          voteValue: '8',
          votedAt: '2026-04-12T12:01:00.000Z',
        },
      ],
    };

    const { container, root } = renderComponent(officialSnapshot, { onSetOfficialSize, onClearOfficialSize });
    try {
      const currentTicketRow = container.querySelector('[data-ticket-id="ticket-1"]');
      expect(currentTicketRow?.textContent).toContain('8');
      expect(currentTicketRow?.querySelector('[data-ticket-vote-count-badge="ticket-1"]')?.className).not.toContain('text-success');
      expect(currentTicketRow?.querySelector('[data-ticket-vote-count-badge="ticket-1"]')?.className).not.toContain('text-warning');
      expect(currentTicketRow?.querySelector('[data-ticket-official-size-badge="ticket-1"]')?.className).toContain('text-success');
      expect(currentTicketRow?.querySelector('[data-ticket-official-size-badge="ticket-1"] svg')).toBeTruthy();

      const voteBadgeTextIndex = currentTicketRow?.textContent?.indexOf('2 Votes') ?? -1;
      const officialSizeTextIndex = currentTicketRow?.textContent?.indexOf('8') ?? -1;
      expect(voteBadgeTextIndex).toBeGreaterThan(-1);
      expect(officialSizeTextIndex).toBeLessThan(voteBadgeTextIndex);

      const officialSizeButton = Array.from(container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === 'Set official size 5');
      expect(officialSizeButton).toBeTruthy();

      await act(async () => {
        officialSizeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      expect(onSetOfficialSize).toHaveBeenCalledWith('ticket-1', '5');

      const clearOfficialSizeButton = Array.from(container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === 'Clear official size');
      expect(clearOfficialSizeButton).toBeTruthy();

      await act(async () => {
        clearOfficialSizeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      expect(onClearOfficialSize).toHaveBeenCalledWith('ticket-1');
    } finally {
      cleanup(root, container);
    }
  });

  it('wires drag reorder and current-ticket controls', async () => {
    const onMoveTicket = vi.fn().mockResolvedValue(undefined);
    const onSetCurrentTicket = vi.fn().mockResolvedValue(undefined);

    const { container, root } = renderComponent(baseSnapshot, { onMoveTicket, onSetCurrentTicket });
    try {
      const sourceRow = container.querySelector('[data-ticket-id="ticket-2"]') as HTMLDivElement | null;
      const targetWrapper = container.querySelector('[data-ticket-wrapper-id="ticket-1"]') as HTMLDivElement | null;

      expect(sourceRow).toBeTruthy();
      expect(targetWrapper).toBeTruthy();

      Object.defineProperty(targetWrapper, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          top: 0,
          left: 0,
          right: 200,
          bottom: 40,
          width: 200,
          height: 40,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });

      await act(async () => {
        const dataTransfer = createDataTransfer();
        sourceRow!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
        Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
        sourceRow!.dispatchEvent(dragStartEvent);

        const dragOverEvent = new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 5 });
        Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
        targetWrapper!.dispatchEvent(dragOverEvent);

        const dropEvent = new MouseEvent('drop', { bubbles: true, cancelable: true, clientY: 5 });
        Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
        targetWrapper!.dispatchEvent(dropEvent);
      });

      expect(onSetCurrentTicket).toHaveBeenCalledWith('ticket-2');
      expect(onMoveTicket).toHaveBeenCalledWith('ticket-2', 0);
    } finally {
      cleanup(root, container);
    }
  });

  it('allows dropping into the gap between tickets', async () => {
    const onMoveTicket = vi.fn().mockResolvedValue(undefined);

    const { container, root } = renderComponent(baseSnapshot, { onMoveTicket });
    try {
      const sourceRow = container.querySelector('[data-ticket-id="ticket-1"]') as HTMLDivElement | null;
      const targetWrapper = container.querySelector('[data-ticket-wrapper-id="ticket-2"]') as HTMLDivElement | null;

      expect(sourceRow).toBeTruthy();
      expect(targetWrapper).toBeTruthy();

      Object.defineProperty(targetWrapper, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          top: 40,
          left: 0,
          right: 200,
          bottom: 88,
          width: 200,
          height: 48,
          x: 0,
          y: 40,
          toJSON: () => ({}),
        }),
      });

      await act(async () => {
        const dataTransfer = createDataTransfer();

        const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true });
        Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
        sourceRow!.dispatchEvent(dragStartEvent);

        const dragOverEvent = new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 84 });
        Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
        targetWrapper!.dispatchEvent(dragOverEvent);

        const dropEvent = new MouseEvent('drop', { bubbles: true, cancelable: true, clientY: 84 });
        Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
        targetWrapper!.dispatchEvent(dropEvent);
      });

      expect(onMoveTicket).toHaveBeenCalledWith('ticket-1', 1);
    } finally {
      cleanup(root, container);
    }
  });

  it('uses ticket action menus for edit and delete actions without changing the current ticket', async () => {
    const onSetCurrentTicket = vi.fn().mockResolvedValue(undefined);
    const { container, root } = renderComponent(baseSnapshot, { onSetCurrentTicket });
    try {
      const ticketActionsButton = container.querySelector('button[aria-label="Actions for Ship release notes"]');
      expect(ticketActionsButton).toBeTruthy();

      await openMenu(ticketActionsButton);

      await waitForCondition(() => {
        const menu = document.body.querySelector('[role="menu"]');
        expect(menu?.textContent).toContain('Rename Ticket');
        expect(menu?.textContent).toContain('Delete Ticket');
      });

      expect(onSetCurrentTicket).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('imports tickets from a CSV file in source order', async () => {
    const onImportTickets = vi.fn().mockResolvedValue(undefined);
    const { container, root } = renderComponent(baseSnapshot, { onImportTickets });

    try {
      const importButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Import');
      expect(importButton).toBeTruthy();

      await act(async () => {
        importButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('Import Tickets');
      });

      expect(document.body.textContent).toContain('Choose File');

      const fileInput = document.body.querySelector('#estimator-ticket-import-file') as HTMLInputElement | null;
      const columnInput = document.body.querySelector('#estimator-ticket-import-column') as HTMLInputElement | null;

      expect(fileInput).toBeTruthy();
      expect(columnInput).toBeTruthy();

      const file = new File(['ignored'], 'tickets.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'text', {
        configurable: true,
        value: vi.fn().mockResolvedValue([
          'Summary,Owner',
          'Build login form,Art',
          ',Taylor',
          'Ship release notes,Jordan',
        ].join('\n')),
      });

      Object.defineProperty(fileInput!, 'files', {
        configurable: true,
        value: [file],
      });

      await act(async () => {
        fileInput?.dispatchEvent(new Event('change', { bubbles: true }));
      });

      expect(document.body.textContent).toContain('tickets.csv');

      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      expect(descriptor?.set).toBeTruthy();

      await act(async () => {
        descriptor!.set!.call(columnInput, 'Summary');
        columnInput?.dispatchEvent(new Event('input', { bubbles: true }));
        columnInput?.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const submitButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Import Tickets');
      expect(submitButton).toBeTruthy();

      await act(async () => {
        submitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      await waitForCondition(() => {
        expect(onImportTickets).toHaveBeenCalledWith(['Build login form', 'Ship release notes']);
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('wires reopen and reset voting controls after reveal', async () => {
    const onReopenVoting = vi.fn().mockResolvedValue(undefined);
    const onResetVoting = vi.fn().mockResolvedValue(undefined);
    const revealedSnapshot: EstimatorRoomSnapshot = {
      ...baseSnapshot,
      currentTicket: {
        ...baseSnapshot.currentTicket!,
        revealedAt: '2026-04-12T12:02:00.000Z',
        isRevealed: true,
        voteCount: 2,
        votedCount: 1,
        officialSizeValue: null,
      },
      activeMembers: [
        {
          ...baseSnapshot.activeMembers[0],
          voteValue: '5',
        },
        {
          ...baseSnapshot.activeMembers[1],
          voteValue: '8',
          hasVoted: true,
          votedAt: '2026-04-12T12:01:00.000Z',
        },
      ],
    };

    const { container, root } = renderComponent(revealedSnapshot, { onReopenVoting, onResetVoting });
    try {
      const reopenButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Reopen Voting');
      const resetButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Reset Voting');

      expect(reopenButton).toBeTruthy();
      expect(resetButton).toBeTruthy();
      expect(resetButton?.className).toContain('border-destructive');
      expect(resetButton?.className).toContain('text-destructive');

      await act(async () => {
        reopenButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      expect(onReopenVoting).toHaveBeenCalledWith('ticket-1');

      await act(async () => {
        resetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('This will clear every vote for the current ticket and reopen voting.');
      });

      const confirmResetButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Reset Voting' && button !== resetButton);
      expect(confirmResetButton).toBeTruthy();

      await act(async () => {
        confirmResetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      expect(onResetVoting).toHaveBeenCalledWith('ticket-1');
    } finally {
      cleanup(root, container);
    }
  });

  it('opens a manage room popover from the title area and offers room management actions', async () => {
    const onRenameRoom = vi.fn().mockResolvedValue(undefined);
    const onSetVotingMode = vi.fn().mockResolvedValue(undefined);
    const onResetTickets = vi.fn().mockResolvedValue(undefined);
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    const { container, root } = renderComponent(baseSnapshot, { onRenameRoom, onSetVotingMode, onResetTickets });
    try {
      const inviteButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Invite');
      expect(inviteButton).toBeTruthy();
      expect(inviteButton?.className).toContain('border-success');
      expect(inviteButton?.className).toContain('text-success');

      await act(async () => {
        inviteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      expect(writeTextMock).toHaveBeenCalledWith(`${window.location.origin}/estimator/rooms/123456789012345678`);

      const manageRoomButton = container.querySelector('button[aria-label="Manage Room"]');
      expect(manageRoomButton).toBeTruthy();
      const membersHeader = Array.from(container.querySelectorAll('h3')).find((heading) => heading.textContent === 'Members');
      expect(membersHeader?.parentElement?.textContent).toContain('Invite');

      await act(async () => {
        manageRoomButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('T-shirt Sizing');
      });
      expect(document.body.textContent).not.toContain('Room Link');
      expect(document.body.textContent).toContain('Reset Tickets');

      const createNewRoomLink = Array.from(document.body.querySelectorAll('a')).find((link) => link.textContent === 'Create New Room');
      expect(createNewRoomLink?.getAttribute('href')).toBe('/estimator');
      expect(createNewRoomLink?.getAttribute('target')).toBe('_blank');

      const resetTicketsButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Reset Tickets');
      expect(resetTicketsButton).toBeTruthy();
      expect(resetTicketsButton?.className).toContain('border-destructive');
      expect(resetTicketsButton?.className).toContain('text-destructive');

      await act(async () => {
        resetTicketsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('This will delete every ticket in the room and clear the votes attached to those tickets.');
      });

      const confirmResetTicketsButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Reset Tickets' && button !== resetTicketsButton);
      expect(confirmResetTicketsButton).toBeTruthy();

      await act(async () => {
        confirmResetTicketsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      expect(onResetTickets).toHaveBeenCalledTimes(1);

      await act(async () => {
        manageRoomButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      const roomNameInput = document.body.querySelector('#estimator-room-name-manage') as HTMLInputElement | null;
      expect(roomNameInput).toBeTruthy();

      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      expect(descriptor?.set).toBeTruthy();

      await act(async () => {
        descriptor!.set!.call(roomNameInput, 'Refined Sprint Planning');
        roomNameInput?.dispatchEvent(new Event('input', { bubbles: true }));
        roomNameInput?.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const saveButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Save');
      expect(saveButton).toBeTruthy();

      await act(async () => {
        saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      expect(onRenameRoom).toHaveBeenCalledWith('Refined Sprint Planning');

      const tShirtToggle = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'T-shirt Sizing');
      expect(tShirtToggle).toBeTruthy();

      await act(async () => {
        tShirtToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      expect(onSetVotingMode).toHaveBeenCalledWith('ballpark');
    } finally {
      cleanup(root, container);
    }
  });

  it('uses member action menus for nickname updates and kicking', async () => {
    const onKickMember = vi.fn().mockResolvedValue(undefined);

    const { container, root } = renderComponent(baseSnapshot, { onKickMember });
    try {
      const selfActionsButton = container.querySelector('button[aria-label="Actions for Art"]');
      const otherActionsButton = container.querySelector('button[aria-label="Actions for Taylor"]');

      expect(selfActionsButton).toBeTruthy();
      expect(otherActionsButton).toBeTruthy();

      await openMenu(selfActionsButton);

      await waitForCondition(() => {
        const menu = document.body.querySelector('[role="menu"]');
        expect(menu?.textContent).toContain('Update Nickname');
        expect(menu?.textContent).not.toContain('Kick Member');
      });

      const renameItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent?.includes('Update Nickname'));
      expect(renameItem).toBeTruthy();

      await act(async () => {
        renameItem?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('Rename Member');
      });

      const cancelButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Cancel');
      await act(async () => {
        cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      await openMenu(otherActionsButton);

      await waitForCondition(() => {
        const menu = document.body.querySelector('[role="menu"]');
        expect(menu?.textContent).toContain('Kick Member');
        expect(menu?.textContent).not.toContain('Update Nickname');
      });

      const kickItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent?.includes('Kick Member'));
      expect(kickItem).toBeTruthy();

      await act(async () => {
        kickItem?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });

      expect(onKickMember).toHaveBeenCalledWith('member-2');
    } finally {
      cleanup(root, container);
    }
  });

  it('always renders the current user first in the members list', () => {
    const reorderedSnapshot: EstimatorRoomSnapshot = {
      ...baseSnapshot,
      activeMembers: [
        baseSnapshot.activeMembers[1],
        baseSnapshot.activeMembers[0],
      ],
    };

    const { container, root } = renderComponent(reorderedSnapshot);
    try {
      const memberCards = Array.from(container.querySelectorAll('div.rounded-md.border.border-\\[hsl\\(var\\(--grid-sticky-line\\)\\)\\].px-3.py-2'));
      const memberCardTexts = memberCards
        .map((card) => card.textContent ?? '')
        .filter((text) => text.includes('Waiting') || text.includes('Voted') || text.includes('No Vote'));

      expect(memberCardTexts[0]).toContain('Art');
      expect(memberCardTexts[0]).toContain('You');
    } finally {
      cleanup(root, container);
    }
  });
});
