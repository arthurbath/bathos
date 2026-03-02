import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/platform/components/AuthPage';
import { DrawersHouseholdSetup } from '@/modules/drawers/components/DrawersHouseholdSetup';
import { DrawersPlanner } from '@/modules/drawers/components/DrawersPlanner';
import { useDrawersHouseholdData } from '@/modules/drawers/hooks/useDrawersHouseholdData';

export default function DrawersIndex() {
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
  } = useDrawersHouseholdData(user, !!user);

  if (authLoading || householdLoading || isSigningOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!household) {
    return (
      <DrawersHouseholdSetup
        userId={user.id}
        displayName={displayName}
        onSignOut={signOut}
        onCreate={createHousehold}
        onJoin={joinHousehold}
      />
    );
  }

  return (
      <DrawersPlanner
        household={household}
        userId={user.id}
        displayName={displayName}
        userEmail={user.email ?? ''}
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
