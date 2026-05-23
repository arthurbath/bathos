import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/platform/components/AuthPage';
import { CorpusShell } from '@/modules/corpus/components/CorpusShell';

export default function CorpusIndex() {
  const { user, loading: authLoading, isSigningOut, signOut, displayName } = useAuth();

  if (authLoading || isSigningOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return <CorpusShell userId={user.id} displayName={displayName} onSignOut={signOut} />;
}
