import { HouseholdSetup } from '@/components/HouseholdSetup';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useHouseholdData } from '@/hooks/useHouseholdData';
import { useTermsConfirmation } from '@/hooks/useTermsConfirmation';
import { TermsUpdateOverlay } from '@/platform/components/TermsUpdateOverlay';
import { useToast } from '@/hooks/use-toast';
import Auth from '@/pages/Auth';

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { household, loading: hhLoading, createHousehold, joinHousehold, updatePartnerNames, updatePartnerColors, refetch } = useHouseholdData(user);
  const { loading: termsLoading, needsConfirmation, latestVersion, pendingVersions, acceptTerms } = useTermsConfirmation();
  const { toast } = useToast();

  if (authLoading || hhLoading || (user && termsLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) return <Auth />;

  const handleTermsAgree = async () => {
    await acceptTerms();
    toast({ title: 'Terms accepted' });
  };

  return (
    <>
      {needsConfirmation && (
        <TermsUpdateOverlay
          latestVersion={latestVersion}
          pendingVersions={pendingVersions}
          onAgree={handleTermsAgree}
        />
      )}

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
