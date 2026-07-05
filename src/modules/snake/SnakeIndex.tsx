import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/platform/components/AuthPage';
import { SnakeHouseholdSetup } from '@/modules/snake/components/SnakeHouseholdSetup';
import { SnakeShell } from '@/modules/snake/components/SnakeShell';
import { useSnakeHouseholdData } from '@/modules/snake/hooks/useSnakeHouseholdData';

export default function SnakeIndex() {
  const { user, loading: authLoading, isSigningOut, signOut, displayName } = useAuth();
  const {
    household,
    loading: householdLoading,
    createHousehold,
    joinHousehold,
    householdMembers,
    householdMembersLoading,
    householdMembersError,
    pendingHouseholdMemberId,
    rotatingHouseholdInviteCode,
    leavingHousehold,
    deletingHousehold,
    rotateHouseholdInviteCode,
    removeHouseholdMember,
    leaveHousehold,
    deleteHousehold,
  } = useSnakeHouseholdData(user, !!user);

  if (authLoading || householdLoading || isSigningOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  if (!household) {
    return (
      <SnakeHouseholdSetup
        userId={user.id}
        displayName={displayName}
        onSignOut={signOut}
        onCreate={createHousehold}
        onJoin={joinHousehold}
      />
    );
  }

  return (
    <SnakeShell
      household={household}
      userId={user.id}
      userEmail={user.email ?? ''}
      displayName={displayName}
      onSignOut={signOut}
      householdMembers={householdMembers}
      householdMembersLoading={householdMembersLoading}
      householdMembersError={householdMembersError}
      pendingHouseholdMemberId={pendingHouseholdMemberId}
      rotatingHouseholdInviteCode={rotatingHouseholdInviteCode}
      leavingHousehold={leavingHousehold}
      deletingHousehold={deletingHousehold}
      onRotateHouseholdInviteCode={rotateHouseholdInviteCode}
      onRemoveHouseholdMember={removeHouseholdMember}
      onLeaveHousehold={leaveHousehold}
      onDeleteHousehold={deleteHousehold}
    />
  );
}
