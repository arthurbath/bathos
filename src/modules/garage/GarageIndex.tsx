import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/platform/components/AuthPage';
import { GarageShell } from '@/modules/garage/components/GarageShell';

export default function GarageIndex() {
  const { user, loading: authLoading, isSigningOut, signOut, displayName } = useAuth();

  if (authLoading || isSigningOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return <GarageShell userId={user.id} displayName={displayName} onSignOut={signOut} />;
}
