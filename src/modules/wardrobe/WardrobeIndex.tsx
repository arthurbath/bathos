import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/platform/components/AuthPage';
import { WardrobeShell } from '@/modules/wardrobe/components/WardrobeShell';

export default function WardrobeIndex() {
  const { user, loading: authLoading, isSigningOut, signOut, displayName } = useAuth();

  if (authLoading || isSigningOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return <WardrobeShell userId={user.id} displayName={displayName} onSignOut={signOut} />;
}
