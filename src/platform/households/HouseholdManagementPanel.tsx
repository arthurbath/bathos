import { useMemo, useState } from 'react';
import { Check, CircleHelp, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { HouseholdMember } from '@/platform/households/types';

interface HouseholdManagementPanelProps {
  moduleName: string;
  inviteCode: string | null;
  userEmail: string | null;
  members: HouseholdMember[];
  membersLoading: boolean;
  membersError?: string | null;
  pendingMemberId: string | null;
  rotatingInviteCode: boolean;
  leavingHousehold: boolean;
  deletingHousehold: boolean;
  onRotateInviteCode: () => Promise<void>;
  onRemoveMember: (memberUserId: string) => Promise<void>;
  onLeaveHousehold: () => Promise<void>;
  onDeleteHousehold: () => Promise<void>;
}

function memberLabel(member: HouseholdMember): string {
  const displayName = member.displayName?.trim();
  if (displayName) return displayName;
  return member.email ?? 'Unknown user';
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === 'object') {
    const record = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const message = typeof record.message === 'string' ? record.message.trim() : '';
    const details = typeof record.details === 'string' ? record.details.trim() : '';
    const hint = typeof record.hint === 'string' ? record.hint.trim() : '';
    const code = typeof record.code === 'string' ? record.code.trim() : '';

    const segments = [
      message,
      details,
      hint ? `Hint: ${hint}` : '',
      code ? `Code: ${code}` : '',
    ].filter((segment) => segment.length > 0);

    if (segments.length > 0) return segments.join(' | ');
  }

  return fallback;
}

export function HouseholdManagementPanel({
  moduleName,
  inviteCode,
  userEmail,
  members,
  membersLoading,
  membersError = null,
  pendingMemberId,
  rotatingInviteCode,
  leavingHousehold,
  deletingHousehold,
  onRotateInviteCode,
  onRemoveMember,
  onLeaveHousehold,
  onDeleteHousehold,
}: HouseholdManagementPanelProps) {
  const [copied, setCopied] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<HouseholdMember | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const selfMember = useMemo(() => members.find((member) => member.isSelf) ?? null, [members]);
  const orderedMembers = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
    return [...members].sort((left, right) => {
      if (left.isSelf && !right.isSelf) return -1;
      if (!left.isSelf && right.isSelf) return 1;

      const byLabel = collator.compare(memberLabel(left), memberLabel(right));
      if (byLabel !== 0) return byLabel;

      const byEmail = collator.compare(left.email ?? '', right.email ?? '');
      if (byEmail !== 0) return byEmail;

      return collator.compare(left.userId, right.userId);
    });
  }, [members]);
  const canLeaveHousehold = !!selfMember && members.length > 1;
  const deleteBlocked = !userEmail || deleteConfirmText.trim().toLowerCase() !== userEmail.toLowerCase();

  const handleCopyInviteCode = async () => {
    if (!inviteCode) return;

    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast({ title: 'Invite code copied' });
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleRotateInviteCode = async () => {
    try {
      await onRotateInviteCode();
      toast({ title: 'Invite code rotated' });
    } catch (error: unknown) {
      toast({
        title: 'Failed to rotate invite code',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!removeTarget) return;

    try {
      await onRemoveMember(removeTarget.userId);
      toast({ title: 'Member removed' });
      setRemoveTarget(null);
    } catch (error: unknown) {
      toast({
        title: 'Failed to remove member',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const handleLeaveHousehold = async () => {
    try {
      await onLeaveHousehold();
      setLeaveOpen(false);
    } catch (error: unknown) {
      toast({
        title: 'Failed to leave household',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteHousehold = async () => {
    if (deleteBlocked) return;

    try {
      await onDeleteHousehold();
      setDeleteOpen(false);
      setDeleteConfirmText('');
    } catch (error: unknown) {
      toast({
        title: 'Failed to delete household',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Household</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <span>People who currently have access to this {moduleName} household.</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 cursor-help items-center justify-center text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_*]:cursor-help"
                    aria-label="Households are module-specific"
                  >
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="[--tooltip-content-max-width:360px] text-xs">
                  Households are not shared across modules, so members can differ between modules.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {membersError && !membersLoading && (
            <p className="text-sm text-destructive">Failed to load members: {membersError}</p>
          )}
          {membersLoading ? (
            <p className="text-sm text-muted-foreground">Loading members...</p>
          ) : (
            <div className="space-y-3">
              {orderedMembers.map((member) => {
                const isBusy = pendingMemberId === member.userId;
                return (
                  <div key={member.userId} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {memberLabel(member)}
                        {member.isSelf ? ' (You)' : ''}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{member.email ?? 'No email'}</p>
                    </div>
                    {!member.isSelf && (
                      <Button
                        type="button"
                        variant="outline-warning"
                        size="sm"
                        disabled={isBusy || deletingHousehold || leavingHousehold || rotatingInviteCode}
                        onClick={() => setRemoveTarget(member)}
                      >
                        {isBusy ? 'Removing...' : 'Remove'}
                      </Button>
                    )}
                    {member.isSelf && canLeaveHousehold && (
                      <Button
                        type="button"
                        variant="outline-warning"
                        size="sm"
                        disabled={leavingHousehold || deletingHousehold || rotatingInviteCode}
                        onClick={() => setLeaveOpen(true)}
                      >
                        {leavingHousehold ? 'Leaving...' : 'Leave'}
                      </Button>
                    )}
                  </div>
                );
              })}
              {orderedMembers.length === 0 && (
                <p className="text-sm text-muted-foreground">No household members found.</p>
              )}
            </div>
          )}

          <div className="space-y-3 border-t pt-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Invite</h3>
              <p className="text-sm text-muted-foreground">
                Share this code with people you want to invite. They can enter it when they sign up for the {moduleName} module.
              </p>
            </div>
            <div className="space-y-2 sm:flex sm:items-stretch sm:gap-2 sm:space-y-0">
              <Input
                readOnly
                value={inviteCode ?? 'Generating...'}
                className="font-mono text-center text-lg tracking-widest"
              />
              <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full gap-1.5 sm:w-auto"
                  onClick={() => void handleCopyInviteCode()}
                  disabled={!inviteCode}
                >
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  Copy
                </Button>
                <Button
                  variant="outline-warning"
                  className="w-full gap-1.5 sm:w-auto"
                  onClick={() => void handleRotateInviteCode()}
                  disabled={!inviteCode || rotatingInviteCode || deletingHousehold || leavingHousehold}
                >
                  <RefreshCw className="h-4 w-4" />
                  {rotatingInviteCode ? 'Regenerating...' : 'Regenerate'}
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-3 border-t pt-4">
            <Button
              type="button"
              variant="outline-destructive"
              className="w-full justify-center gap-1.5"
              onClick={() => setDeleteOpen(true)}
              disabled={deletingHousehold || leavingHousehold}
            >
              <Trash2 className="h-4 w-4" />
              {deletingHousehold ? 'Deleting Household...' : 'Delete Household'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>
              Remove {removeTarget ? memberLabel(removeTarget) : 'this member'} from this household? This will rotate the invite code.
            </DialogDescription>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={pendingMemberId !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="warning"
              data-dialog-confirm="true"
              onClick={handleConfirmRemoveMember}
              disabled={pendingMemberId !== null}
            >
              {pendingMemberId !== null ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Household</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>
              Leave this household? You will lose access until re-invited.
            </DialogDescription>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLeaveOpen(false)}
              disabled={leavingHousehold}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="warning"
              data-dialog-confirm="true"
              onClick={handleLeaveHousehold}
              disabled={leavingHousehold}
            >
              {leavingHousehold ? 'Leaving...' : 'Leave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOpen(false);
            setDeleteConfirmText('');
            return;
          }
          setDeleteOpen(true);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Household</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody className="space-y-4">
            <AlertDialogDescription>
              This action cannot be undone. Type your email address to confirm household deletion.
            </AlertDialogDescription>
            <Input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder={userEmail ?? ''}
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="border-destructive/30 focus:border-destructive"
            />
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingHousehold}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteHousehold}
              disabled={deletingHousehold || deleteBlocked}
            >
              {deletingHousehold ? 'Deleting...' : 'Delete Household'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
