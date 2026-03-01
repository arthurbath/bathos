import { HouseholdSetup } from '@/components/HouseholdSetup';
import { AppShell } from '@/components/AppShell';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { useHouseholdData } from '@/hooks/useHouseholdData';
import { useProfileDisplayName } from '@/platform/hooks/useProfileDisplayName';
import AuthPage from '@/platform/components/AuthPage';

const Index = () => {
  const { user, loading: authLoading, isSigningOut, signOut } = useAuth();
  const {
    household,
    loading: hhLoading,
    createHousehold,
    joinHousehold,
    updatePartnerSettings,
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
  } = useHouseholdData(user);
  const setupDisplayName = useProfileDisplayName(user?.id, user?.email ?? undefined);

  if (authLoading || hhLoading || isSigningOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <>
      {!household ? (
        <HouseholdSetup
          userId={user.id}
          displayName={setupDisplayName}
          onSignOut={signOut}
          onComplete={createHousehold}
          onJoin={joinHousehold}
        />
      ) : (
        <AppShell
          household={household}
          userId={user.id}
          userEmail={user.email ?? ''}
          onSignOut={signOut}
          onUpdatePartnerSettings={updatePartnerSettings}
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
      )}
    </>
  );
};

export default Index;
