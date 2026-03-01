import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { getAvailableModules } from '@/platform/modules';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import { Badge } from '@/components/ui/badge';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import { useProfileDisplayName } from '@/platform/hooks/useProfileDisplayName';
import AuthPage from './AuthPage';

export default function LauncherPage() {
  const { user, loading, isSigningOut, signOut } = useAuthContext();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const modules = getAvailableModules({ isAdmin });
  const displayName = useProfileDisplayName(user?.id, user?.email ?? undefined);

  useEffect(() => {
    // If there's only one module, skip the launcher and go straight to it
    if (!loading && !roleLoading && user && modules.length === 1) {
      navigate(modules[0].launchPath, { replace: true });
    }
  }, [loading, roleLoading, user, modules, navigate]);

  if (loading || isSigningOut || (!!user && roleLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  // If multiple modules exist in the future, show the launcher grid
  if (modules.length > 1) {
    return (
      <div className="min-h-screen bg-background">
        <ToplineHeader title="BathOS" userId={user.id} displayName={displayName} onSignOut={signOut} maxWidthClassName="max-w-2xl" />

        <main className="mx-auto max-w-2xl px-4 py-8">
          <div className="grid gap-4">
            {modules.map(mod => (
              <Card
                key={mod.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
              >
                <a
                  href={mod.launchPath}
                  className="block"
                  onClick={(event) => handleClientSideLinkNavigation(event, navigate, mod.launchPath)}
                >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle>{mod.name}</CardTitle>
                      {mod.adminOnly && <Badge className="bg-admin text-admin-foreground">Admin</Badge>}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{mod.description}</p>
                </CardContent>
                </a>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Single module — redirect is handled by the effect above; show loading in the meantime
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoadingSpinner />
    </div>
  );
}
