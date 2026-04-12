import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import GatewayPageLayout from '@/platform/components/GatewayPageLayout';
import { EstimatorRoomGate } from '@/modules/estimator/components/EstimatorRoomGate';
import { EstimatorRoomShell } from '@/modules/estimator/components/EstimatorRoomShell';
import { useEstimatorRoom } from '@/modules/estimator/hooks/useEstimatorRoom';

export default function EstimatorRoomPage() {
  const { roomToken } = useParams<{ roomToken: string }>();
  const resolvedRoomToken = roomToken ?? '';
  const room = useEstimatorRoom(resolvedRoomToken);

  if (!roomToken) {
    return (
      <GatewayPageLayout contentClassName="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Room Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">This room link is incomplete.</p>
          </CardContent>
        </Card>
      </GatewayPageLayout>
    );
  }

  if (room.initializingIdentity) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!room.identity) {
    return (
      <EstimatorRoomGate
        joinPending={room.joinPending}
        message={room.gateMessage}
        onJoinRoom={room.joinRoom}
      />
    );
  }

  if (room.loadingSnapshot && !room.snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!room.snapshot) {
    return (
      <GatewayPageLayout contentClassName="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Unable to Load Room</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{room.errorMessage ?? 'The room could not be loaded right now.'}</p>
          </CardContent>
        </Card>
      </GatewayPageLayout>
    );
  }

  return (
    <EstimatorRoomShell
      pendingAction={room.pendingAction}
      snapshot={room.snapshot}
      onRenameRoom={room.renameRoom}
      onRenameSelf={room.renameSelf}
      onAddTicket={room.addTicket}
      onImportTickets={room.importTickets}
      onUpdateTicketTitle={room.updateTicketTitle}
      onRemoveTicket={room.removeTicket}
      onResetTickets={room.resetTickets}
      onMoveTicket={room.moveTicket}
      onSetCurrentTicket={room.setCurrentTicket}
      onSetVotingMode={room.setVotingMode}
      onCastVote={room.castVote}
      onSetOfficialSize={room.setOfficialSize}
      onClearOfficialSize={room.clearOfficialSize}
      onRevealVotes={room.revealVotes}
      onReopenVoting={room.reopenVoting}
      onResetVoting={room.resetVoting}
      onKickMember={room.kickMember}
    />
  );
}
