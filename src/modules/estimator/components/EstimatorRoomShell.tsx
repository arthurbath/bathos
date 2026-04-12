import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Hourglass, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ESTIMATOR_SHARED_VOTE_MASKS, getEstimatorVoteOptions } from '@/modules/estimator/lib/constants';
import { extractEstimatorTicketTitlesFromCsv } from '@/modules/estimator/lib/csv';
import type {
  EstimatorRoomSnapshot,
  EstimatorRoomMember,
  EstimatorTicketSummary,
  EstimatorVoteValue,
  EstimatorVotingMode,
} from '@/modules/estimator/types/estimator';
import { EstimatorPublicHeader } from '@/modules/estimator/components/EstimatorPublicHeader';

interface EstimatorRoomShellProps {
  pendingAction: string | null;
  snapshot: EstimatorRoomSnapshot;
  onRenameRoom: (name: string) => Promise<void>;
  onRenameSelf: (nickname: string) => Promise<void>;
  onAddTicket: (title: string) => Promise<void>;
  onImportTickets: (titles: string[]) => Promise<void>;
  onUpdateTicketTitle: (ticketId: string, title: string) => Promise<void>;
  onRemoveTicket: (ticketId: string) => Promise<void>;
  onResetTickets: () => Promise<void>;
  onMoveTicket: (ticketId: string, targetIndex: number) => Promise<void>;
  onSetCurrentTicket: (ticketId: string) => Promise<void>;
  onSetVotingMode: (votingMode: EstimatorVotingMode) => Promise<void>;
  onCastVote: (ticketId: string, voteValue: EstimatorVoteValue) => Promise<void>;
  onSetOfficialSize: (ticketId: string, voteValue: EstimatorVoteValue) => Promise<void>;
  onClearOfficialSize: (ticketId: string) => Promise<void>;
  onRevealVotes: (ticketId: string) => Promise<void>;
  onReopenVoting: (ticketId: string) => Promise<void>;
  onResetVoting: (ticketId: string) => Promise<void>;
  onKickMember: (memberId: string) => Promise<void>;
}

type TicketDropPosition = 'before' | 'after';

function renderMemberStatus(snapshot: EstimatorRoomSnapshot, memberId: string): string {
  if (!snapshot.currentTicket) return '';

  const member = snapshot.activeMembers.find((entry) => entry.memberId === memberId);
  if (!member) return 'No Longer In Room';

  if (snapshot.currentTicket.isRevealed) {
    return member.voteValue ? `Vote: ${member.voteValue}` : 'No Vote';
  }

  return member.hasVoted ? 'Voted' : 'Waiting';
}

function buildVoteSpread(snapshot: EstimatorRoomSnapshot): Array<{ value: string; count: number; voterNames: string[] }> {
  if (!snapshot.currentTicket?.isRevealed) return [];

  const voteGroups = new Map<string, string[]>();
  const rankOrder = new Map<string, number>();
  const masks = snapshot.room.votingMode === 'ballpark'
    ? ESTIMATOR_SHARED_VOTE_MASKS.map(({ ballpark }) => ballpark)
    : ESTIMATOR_SHARED_VOTE_MASKS.map(({ fibonacci }) => fibonacci);

  masks.forEach((value, index) => {
    rankOrder.set(value, index);
  });

  for (const member of snapshot.activeMembers) {
    if (!member.voteValue) continue;
    voteGroups.set(member.voteValue, [...(voteGroups.get(member.voteValue) ?? []), member.nickname]);
  }

  for (const voter of snapshot.historicalVoters) {
    voteGroups.set(voter.voteValue, [...(voteGroups.get(voter.voteValue) ?? []), voter.nickname]);
  }

  return Array.from(voteGroups.entries())
    .map(([value, voterNames]) => ({
      value,
      count: voterNames.length,
      voterNames: [...voterNames].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' })),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return (rankOrder.get(left.value) ?? Number.MAX_SAFE_INTEGER) - (rankOrder.get(right.value) ?? Number.MAX_SAFE_INTEGER);
    });
}

function TicketRowActions({
  disabled,
  onEdit,
  onRemove,
  ticketTitle,
}: {
  disabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
  ticketTitle: string;
}) {
  return (
    <div
      className="flex items-center gap-1"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onDragStart={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={disabled}
            aria-label={`Actions for ${ticketTitle}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename Ticket
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Ticket
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function MemberActionsMenu({
  disabled,
  member,
  onRenameSelf,
  onKickMember,
}: {
  disabled: boolean;
  member: EstimatorRoomMember;
  onRenameSelf: () => void;
  onKickMember: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          aria-label={`Actions for ${member.nickname}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        {member.isSelf ? (
          <DropdownMenuItem onClick={onRenameSelf}>
            <Pencil className="mr-2 h-4 w-4" />
            Update Nickname
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onKickMember} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Kick Member
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EstimatorRoomShell({
  pendingAction,
  snapshot,
  onRenameRoom,
  onRenameSelf,
  onAddTicket,
  onImportTickets,
  onUpdateTicketTitle,
  onRemoveTicket,
  onResetTickets,
  onMoveTicket,
  onSetCurrentTicket,
  onSetVotingMode,
  onCastVote,
  onSetOfficialSize,
  onClearOfficialSize,
  onRevealVotes,
  onReopenVoting,
  onResetVoting,
  onKickMember,
}: EstimatorRoomShellProps) {
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [renameSelfOpen, setRenameSelfOpen] = useState(false);
  const [renameSelfValue, setRenameSelfValue] = useState(snapshot.room.currentMemberNickname);
  const [editingTicket, setEditingTicket] = useState<EstimatorTicketSummary | null>(null);
  const [editingTicketValue, setEditingTicketValue] = useState('');
  const ticketInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [manageRoomOpen, setManageRoomOpen] = useState(false);
  const [manageRoomName, setManageRoomName] = useState(snapshot.room.name ?? '');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmResetTicketsOpen, setConfirmResetTicketsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importColumnName, setImportColumnName] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ ticketId: string; position: TicketDropPosition } | null>(null);
  const [suppressedTicketClickId, setSuppressedTicketClickId] = useState<string | null>(null);
  const shareUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/estimator/rooms/${snapshot.room.roomToken}`;
  const voteOptions = getEstimatorVoteOptions(snapshot.room.votingMode);
  const voteSpread = useMemo(() => buildVoteSpread(snapshot), [snapshot]);
  const displayActiveMembers = useMemo(() => {
    return snapshot.activeMembers
      .map((member, index) => ({ member, index }))
      .sort((left, right) => {
        if (left.member.isSelf !== right.member.isSelf) {
          return left.member.isSelf ? -1 : 1;
        }
        return left.index - right.index;
      })
      .map(({ member }) => member);
  }, [snapshot.activeMembers]);
  const currentTicket = snapshot.currentTicket;
  const roomTitle = snapshot.room.name?.trim() || 'Ticket Estimator';
  const normalizedRoomName = snapshot.room.name ?? '';

  useEffect(() => {
    setManageRoomName(snapshot.room.name ?? '');
  }, [snapshot.room.name]);

  const handleAddTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = newTicketTitle.trim();
    if (!trimmedTitle) {
      toast({ title: 'Ticket Title Required', variant: 'destructive' });
      return;
    }

    try {
      await onAddTicket(trimmedTitle);
      setNewTicketTitle('');
    } catch {
      // Error toast is handled by the caller.
    }
  };

  const resetImportState = () => {
    setImportColumnName('');
    setImportFile(null);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) {
      setImportFile(null);
      return;
    }

    const normalizedFileName = selectedFile.name.toLowerCase();
    const isCsvFile =
      normalizedFileName.endsWith('.csv') ||
      selectedFile.type === 'text/csv' ||
      selectedFile.type === 'application/vnd.ms-excel';

    if (!isCsvFile) {
      toast({ title: 'CSV File Required', description: 'Please choose a CSV file to import tickets.', variant: 'destructive' });
      event.target.value = '';
      setImportFile(null);
      return;
    }

    setImportFile(selectedFile);
  };

  const handleImportTickets = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!importFile) {
      toast({ title: 'CSV File Required', variant: 'destructive' });
      return;
    }

    const trimmedColumnName = importColumnName.trim();
    if (!trimmedColumnName) {
      toast({ title: 'Column Name Required', variant: 'destructive' });
      return;
    }

    try {
      const csvText = await importFile.text();
      const importedTitles = extractEstimatorTicketTitlesFromCsv(csvText, trimmedColumnName);
      await onImportTickets(importedTitles);
      toast({
        title: 'Tickets Imported',
        description: `Imported ${importedTitles.length} ticket${importedTitles.length === 1 ? '' : 's'}.`,
      });
      setImportOpen(false);
      resetImportState();
    } catch (error) {
      toast({
        title: 'Failed to Import Tickets',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleRenameSelf = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedNickname = renameSelfValue.trim();
    if (!trimmedNickname) {
      toast({ title: 'Nickname Required', variant: 'destructive' });
      return;
    }

    try {
      await onRenameSelf(trimmedNickname);
      setRenameSelfOpen(false);
    } catch {
      // Error toast is handled by the caller.
    }
  };

  const handleRenameTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTicket) return;
    const trimmedTitle = editingTicketValue.trim();
    if (!trimmedTitle) {
      toast({ title: 'Ticket Title Required', variant: 'destructive' });
      return;
    }

    try {
      await onUpdateTicketTitle(editingTicket.id, trimmedTitle);
      setEditingTicket(null);
      setEditingTicketValue('');
    } catch {
      // Error toast is handled by the caller.
    }
  };

  const handleInvite = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Room Link Copied',
        description: 'The room link has been copied to your clipboard. Send it to anyone you want to invite to the room.',
      });
    } catch {
      toast({ title: 'Failed to Copy Link', variant: 'destructive' });
    }
  };

  const handleRenameRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedRoomName = manageRoomName.trim();
    if (!trimmedRoomName) {
      toast({ title: 'Room Name Required', variant: 'destructive' });
      return;
    }

    try {
      await onRenameRoom(trimmedRoomName);
    } catch {
      // Error toast is handled by the caller.
    }
  };

  const getDropPosition = (event: React.DragEvent<HTMLElement>): TicketDropPosition => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
  };

  const handleTicketDrop = async (ticketId: string, targetTicketId: string, position: TicketDropPosition) => {
    const sourceIndex = snapshot.tickets.findIndex((ticket) => ticket.id === ticketId);
    const targetIndex = snapshot.tickets.findIndex((ticket) => ticket.id === targetTicketId);

    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return;
    }

    const desiredIndex = sourceIndex < targetIndex
      ? position === 'before' ? targetIndex - 1 : targetIndex
      : position === 'before' ? targetIndex : targetIndex + 1;

    const boundedIndex = Math.max(0, Math.min(snapshot.tickets.length - 1, desiredIndex));
    if (boundedIndex === sourceIndex) {
      return;
    }

    await onMoveTicket(ticketId, boundedIndex);
  };

  const handleTicketClick = (ticket: EstimatorTicketSummary) => {
    if (pendingAction !== null || ticket.isCurrent || suppressedTicketClickId === ticket.id) {
      return;
    }

    void onSetCurrentTicket(ticket.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <EstimatorPublicHeader
        title={roomTitle}
        titleAccessory={(
          <Popover open={manageRoomOpen} onOpenChange={setManageRoomOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="clear" size="sm" className="h-9 w-9 p-0" aria-label="Manage Room" title="Manage Room">
                <Pencil className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4" onOpenAutoFocus={(event) => event.preventDefault()}>
              <form className="space-y-2" onSubmit={handleRenameRoom}>
                <Label htmlFor="estimator-room-name-manage">Room Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="estimator-room-name-manage"
                    value={manageRoomName}
                    onChange={(event) => setManageRoomName(event.target.value)}
                    required
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={pendingAction !== null || !manageRoomName.trim() || manageRoomName.trim() === normalizedRoomName.trim()}
                  >
                    Save
                  </Button>
                </div>
              </form>

              <div className="space-y-2">
                <Label>Sizing Mode</Label>
                <ToggleGroup
                  type="single"
                  value={snapshot.room.votingMode}
                  onValueChange={(value) => {
                    if (value === 'ballpark' || value === 'fibonacci') {
                      void onSetVotingMode(value);
                    }
                  }}
                  className="justify-start"
                >
                  <ToggleGroupItem value="fibonacci" size="sm" disabled={pendingAction !== null}>
                    Fibonacci
                  </ToggleGroupItem>
                  <ToggleGroupItem value="ballpark" size="sm" disabled={pendingAction !== null}>
                    T-shirt Sizing
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="space-y-2 border-t border-[hsl(var(--grid-sticky-line))] pt-4">
                <Button
                  type="button"
                  variant="outline-danger"
                  className="w-full"
                  disabled={pendingAction !== null || snapshot.tickets.length === 0}
                  onClick={() => {
                    setManageRoomOpen(false);
                    setConfirmResetTicketsOpen(true);
                  }}
                >
                  Reset Tickets
                </Button>
                <Button asChild type="button" variant="outline" className="w-full">
                  <a href="/estimator" target="_blank" rel="noreferrer">
                    Create New Room
                  </a>
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      />

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4 md:py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card className="lg:col-start-2 lg:row-start-1">
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>{currentTicket ? currentTicket.title : 'Current Ticket'}</CardTitle>
                {currentTicket ? (
                  <CardDescription>
                    {`${currentTicket.votedCount} of ${snapshot.activeMembers.length} members voted`}
                  </CardDescription>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentTicket ? (
                <>
                  {currentTicket.isRevealed && voteSpread.length > 0 ? (
                    <div className="space-y-2">
                      <Label>Vote Spread</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        {voteSpread.map((entry) => (
                          <Tooltip key={entry.value}>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant={entry.value === currentTicket.officialSizeValue ? 'outline-success' : 'outline'}
                                size="sm"
                                className="h-8 rounded-full px-3 text-xs"
                                aria-label={`Set official size ${entry.value}`}
                                disabled={pendingAction !== null}
                                onClick={() => {
                                  if (entry.value === currentTicket.officialSizeValue) return;
                                  void onSetOfficialSize(currentTicket.id, entry.value as EstimatorVoteValue);
                                }}
                              >
                                {entry.value === currentTicket.officialSizeValue ? <Check className="h-3 w-3 text-success" /> : null}
                                {entry.value} × {entry.count}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">{entry.voterNames.join(', ')}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {currentTicket.officialSizeValue ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-foreground enabled:hover:bg-muted enabled:hover:text-foreground"
                            aria-label="Clear official size"
                            disabled={pendingAction !== null}
                            onClick={() => {
                              void onClearOfficialSize(currentTicket.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Your Vote</Label>
                    <ToggleGroup
                      type="single"
                      value={currentTicket.currentMemberVoteValue ?? ''}
                      onValueChange={(value) => {
                        if (!value || currentTicket.isRevealed) return;
                        void onCastVote(currentTicket.id, value as EstimatorVoteValue);
                      }}
                      className="flex flex-wrap justify-start"
                    >
                      {voteOptions.map((option) => (
                        <ToggleGroupItem
                          key={option}
                          value={option}
                          size="sm"
                          disabled={pendingAction !== null || currentTicket.isRevealed}
                          aria-label={`Vote ${option}`}
                          className="px-2 data-[state=on]:!border-primary data-[state=on]:!bg-primary data-[state=on]:font-semibold data-[state=on]:!text-primary-foreground data-[state=on]:hover:!bg-primary"
                        >
                          {option}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Actions</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {currentTicket.isRevealed ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              void onReopenVoting(currentTicket.id);
                            }}
                            disabled={pendingAction !== null}
                          >
                            Reopen Voting
                          </Button>
                          <Button
                            type="button"
                            variant="outline-danger"
                            onClick={() => {
                              setConfirmResetOpen(true);
                            }}
                            disabled={pendingAction !== null}
                          >
                            Reset Voting
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => {
                            void onRevealVotes(currentTicket.id);
                          }}
                          disabled={pendingAction !== null || currentTicket.votedCount === 0}
                        >
                          Reveal Votes
                        </Button>
                      )}
                      {!currentTicket.isRevealed && !currentTicket.currentMemberVoteValue ? (
                        <span className="text-sm text-muted-foreground">No votes yet</span>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <Button
                  type="button"
                  variant="success"
                  className="w-full"
                  onClick={() => {
                    ticketInputRef.current?.focus();
                  }}
                >
                  Add Tickets to Start Voting
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-start-1 lg:row-start-1">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Tickets</CardTitle>
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setImportOpen(true)} disabled={pendingAction !== null}>
                  Import
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="flex gap-2" onSubmit={handleAddTicket}>
                <Input
                  ref={ticketInputRef}
                  value={newTicketTitle}
                  onChange={(event) => setNewTicketTitle(event.target.value)}
                  placeholder="Add a ticket"
                />
                <Button type="submit" variant="outline-success" disabled={pendingAction !== null}>
                  Add
                </Button>
              </form>

              <div>
                {snapshot.tickets.length === 0 ? null : (
                  snapshot.tickets.map((ticket) => {
                    const isDragging = draggingTicketId === ticket.id;
                    const isDropBefore = dropTarget?.ticketId === ticket.id && dropTarget.position === 'before';
                    const isDropAfter = dropTarget?.ticketId === ticket.id && dropTarget.position === 'after';

                    return (
                      <div
                        key={ticket.id}
                        data-ticket-wrapper-id={ticket.id}
                        className="pb-2 last:pb-0"
                        onDragOver={(event) => {
                          if (!draggingTicketId || draggingTicketId === ticket.id || pendingAction !== null) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                          setDropTarget({
                            ticketId: ticket.id,
                            position: getDropPosition(event),
                          });
                        }}
                        onDragLeave={(event) => {
                          const relatedTarget = event.relatedTarget;
                          if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
                            return;
                          }
                          if (dropTarget?.ticketId === ticket.id) {
                            setDropTarget(null);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const droppedTicketId = event.dataTransfer.getData('text/plain') || draggingTicketId;
                          const position = getDropPosition(event);
                          setDropTarget(null);
                          setDraggingTicketId(null);
                          if (!droppedTicketId || droppedTicketId === ticket.id) return;
                          void handleTicketDrop(droppedTicketId, ticket.id, position);
                        }}
                      >
                        <div
                          data-ticket-id={ticket.id}
                          className={cn(
                            'rounded-md border px-3 py-3 transition-colors select-none',
                            ticket.isCurrent ? 'border-info bg-info/5 ring-1 ring-info/40' : 'border-[hsl(var(--grid-sticky-line))]',
                            pendingAction !== null
                              ? 'cursor-not-allowed opacity-70'
                              : ticket.isCurrent
                                ? 'cursor-grab active:cursor-grabbing'
                                : 'cursor-pointer hover:bg-muted/60',
                            isDragging ? 'opacity-60' : null,
                            isDropBefore ? 'border-t-2 border-t-primary' : null,
                            isDropAfter ? 'border-b-2 border-b-primary' : null,
                          )}
                          draggable={pendingAction === null}
                          onClick={() => {
                            handleTicketClick(ticket);
                          }}
                          onDragStart={(event) => {
                            if (pendingAction !== null) return;
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', ticket.id);
                            setDraggingTicketId(ticket.id);
                            setDropTarget(null);
                            setSuppressedTicketClickId(ticket.id);
                          }}
                          onDragEnd={() => {
                            setDraggingTicketId(null);
                            setDropTarget(null);
                            window.setTimeout(() => {
                              setSuppressedTicketClickId((current) => (current === ticket.id ? null : current));
                            }, 0);
                          }}
                        >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-foreground break-words">{ticket.title}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                {ticket.officialSizeValue ? (
                                  <span
                                    data-ticket-official-size-badge={ticket.id}
                                    className="inline-flex items-center gap-1 rounded-full border border-success bg-background px-2 py-0.5 text-[11px] font-medium text-success"
                                  >
                                    <Check className="h-3 w-3" />
                                    {ticket.officialSizeValue}
                                  </span>
                                ) : null}
                                {ticket.isRevealed && !ticket.officialSizeValue ? (
                                  <span
                                    data-ticket-vote-count-badge={ticket.id}
                                    className="inline-flex items-center gap-1 rounded-full border border-warning bg-background px-2 py-0.5 text-[11px] font-medium text-warning"
                                  >
                                    <Hourglass className="h-3 w-3" />
                                    {ticket.voteCount} Vote{ticket.voteCount === 1 ? '' : 's'}
                                  </span>
                                ) : ticket.hasVotes ? (
                                  <span data-ticket-vote-count-badge={ticket.id} className="rounded-full border border-[hsl(var(--grid-sticky-line))] px-2 py-0.5 text-[11px] text-muted-foreground">
                                    {ticket.voteCount} Vote{ticket.voteCount === 1 ? '' : 's'}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <TicketRowActions
                            disabled={pendingAction !== null}
                            onEdit={() => {
                              setEditingTicket(ticket);
                              setEditingTicketValue(ticket.title);
                            }}
                            onRemove={() => {
                              void onRemoveTicket(ticket.id);
                            }}
                            ticketTitle={ticket.title}
                          />
                        </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-start-3 lg:row-start-1">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Members</CardTitle>
                <Button type="button" variant="outline-success" size="sm" className="h-9" onClick={() => void handleInvite()}>
                  Invite
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {displayActiveMembers.map((member) => {
                  const memberStatus = renderMemberStatus(snapshot, member.memberId);

                  return (
                    <div key={member.memberId} className="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--grid-sticky-line))] px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${member.isPresent ? 'bg-success' : 'bg-muted-foreground/35'}`} aria-hidden="true" />
                          <p className="truncate text-sm font-medium text-foreground">{member.nickname}</p>
                          {member.isSelf ? (
                            <span className="rounded-full border border-[hsl(var(--grid-sticky-line))] px-2 py-0.5 text-[11px] text-muted-foreground">
                              You
                            </span>
                          ) : null}
                        </div>
                        {memberStatus ? <p className="text-xs text-muted-foreground">{memberStatus}</p> : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <MemberActionsMenu
                          disabled={pendingAction !== null}
                          member={member}
                          onRenameSelf={() => {
                            setRenameSelfValue(snapshot.room.currentMemberNickname);
                            setRenameSelfOpen(true);
                          }}
                          onKickMember={() => {
                            void onKickMember(member.memberId);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {snapshot.historicalVoters.length > 0 ? (
                <div className="space-y-2 border-t border-[hsl(var(--grid-sticky-line))] pt-3">
                  <Label>Past Voters</Label>
                  <div className="space-y-2">
                    {snapshot.historicalVoters.map((voter) => (
                      <div key={`${voter.memberId}-${voter.voteValue}`} className="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--grid-sticky-line))] px-3 py-2">
                        <p className="truncate text-sm text-foreground">{voter.nickname}</p>
                        <span className="rounded-full border border-[hsl(var(--grid-sticky-line))] px-2 py-0.5 text-[11px] text-foreground">
                          {voter.voteValue}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

        </div>
      </main>

      <Dialog open={renameSelfOpen} onOpenChange={setRenameSelfOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Rename Member</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleRenameSelf}>
            <div className="space-y-2">
              <Label htmlFor="estimator-rename-self">Nickname</Label>
              <Input
                id="estimator-rename-self"
                value={renameSelfValue}
                onChange={(event) => setRenameSelfValue(event.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameSelfOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pendingAction !== null}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reset Voting</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will clear every vote for the current ticket and reopen voting.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmResetOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={pendingAction !== null || !currentTicket}
                onClick={() => {
                  if (!currentTicket) return;
                  void onResetVoting(currentTicket.id);
                  setConfirmResetOpen(false);
                }}
              >
                Reset Voting
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmResetTicketsOpen} onOpenChange={setConfirmResetTicketsOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Reset Tickets</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will delete every ticket in the room and clear the votes attached to those tickets.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmResetTicketsOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={pendingAction !== null || snapshot.tickets.length === 0}
                onClick={() => {
                  void onResetTickets();
                  setConfirmResetTicketsOpen(false);
                }}
              >
                Reset Tickets
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            resetImportState();
          }
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Import Tickets</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleImportTickets}>
            <div className="space-y-2">
              <Label htmlFor="estimator-ticket-import-file">CSV File</Label>
              <Input
                ref={importFileInputRef}
                id="estimator-ticket-import-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportFileChange}
                className="sr-only"
                tabIndex={-1}
              />
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => importFileInputRef.current?.click()}
                  disabled={pendingAction !== null}
                >
                  Choose File
                </Button>
                {importFile ? (
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {importFile.name}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimator-ticket-import-column">Ticket Name Column</Label>
              <Input
                id="estimator-ticket-import-column"
                value={importColumnName}
                onChange={(event) => setImportColumnName(event.target.value)}
                placeholder="Name"
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pendingAction !== null}>
                Import Tickets
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editingTicket !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingTicket(null);
          setEditingTicketValue('');
        }
      }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Rename Ticket</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleRenameTicket}>
            <div className="space-y-2">
              <Label htmlFor="estimator-edit-ticket-title">Ticket Title</Label>
              <Input
                id="estimator-edit-ticket-title"
                value={editingTicketValue}
                onChange={(event) => setEditingTicketValue(event.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingTicket(null);
                  setEditingTicketValue('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pendingAction !== null}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
