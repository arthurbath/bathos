import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import { getUserDisplayName } from '@/platform/lib/getUserDisplayName';
import AuthPage from '@/platform/components/AuthPage';
import { GarageShell } from '@/modules/garage/components/GarageShell';

export default function GarageIndex() {
  const { user, loading: authLoading, isSigningOut, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  const displayName = getUserDisplayName(user);

  if (authLoading || roleLoading || isSigningOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) return <AuthPage />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <GarageShell userId={user.id} displayName={displayName} onSignOut={signOut} />;
}
