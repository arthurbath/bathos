import { HouseholdSetup } from '@/components/HouseholdSetup';
import { AppShell } from '@/components/AppShell';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { useHouseholdData } from '@/hooks/useHouseholdData';
import AuthPage from '@/platform/components/AuthPage';

const Index = () => {
  const { user, loading: authLoading, isSigningOut, signOut } = useAuth();
  const { household, loading: hhLoading, createHousehold, joinHousehold, updatePartnerSettings, refetch } = useHouseholdData(user);
  const setupDisplayName = (user?.user_metadata?.display_name as string | undefined)?.trim() || user?.email || 'You';

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
          onSignOut={signOut}
          onHouseholdRefetch={refetch}
          onUpdatePartnerSettings={updatePartnerSettings}
        />
      )}
    </>
  );
};

export default Index;
