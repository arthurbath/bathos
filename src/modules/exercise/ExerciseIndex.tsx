import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { ExerciseShell } from '@/modules/exercise/components/ExerciseShell';
import AuthPage from '@/platform/components/AuthPage';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import NotFound from '@/pages/NotFound';

export default function ExerciseIndex() {
  const { user, loading: authLoading, isSigningOut, signOut, displayName } = useAuth();
  const { isAdmin, loading: roleLoading, resolved: roleResolved } = useIsAdmin(user?.id);

  if (authLoading || isSigningOut || (!!user && (!roleResolved || roleLoading))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) return <AuthPage />;
  if (!isAdmin) return <NotFound />;

  return <ExerciseShell userId={user.id} displayName={displayName} onSignOut={signOut} />;
}
