import { HouseholdSetup } from '@/components/HouseholdSetup';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useHouseholdData } from '@/hooks/useHouseholdData';
import AuthPage from '@/platform/components/AuthPage';

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { household, loading: hhLoading, createHousehold, joinHousehold, updatePartnerNames, updatePartnerColors, refetch } = useHouseholdData(user);

  if (authLoading || hhLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <>
      {!household ? (
        <HouseholdSetup onComplete={createHousehold} onJoin={joinHousehold} />
      ) : (
        <AppShell
          household={household}
          userId={user.id}
          onSignOut={signOut}
          onHouseholdRefetch={refetch}
          onUpdatePartnerNames={updatePartnerNames}
          onUpdatePartnerColors={updatePartnerColors}
        />
      )}
    </>
  );
};

export default Index;
