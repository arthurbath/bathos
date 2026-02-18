import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { getModuleUrl } from '@/platform/hooks/useHostModule';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import AuthPage from './AuthPage';

const MODULES = [
  {
    id: 'budget',
    name: 'Budget',
    description: 'Track shared expenses and split costs fairly.',
  },
];

export default function LauncherPage() {
  const { user, loading, signOut } = useAuthContext();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('Profile');

  useEffect(() => {
    if (!user) {
      setDisplayName('Profile');
      return;
    }

    let mounted = true;
    supabase
      .from('bathos_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!mounted) return;
        setDisplayName(data?.display_name?.trim() || user.email || 'Profile');
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <div className="min-h-screen bg-background">
      <ToplineHeader title="BathOS" userId={user.id} displayName={displayName} onSignOut={signOut} />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="grid gap-4">
          {MODULES.map(mod => (
            <Card
              key={mod.id}
              className="cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => navigate(`${getModuleUrl(mod.id)}/summary`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{mod.name}</CardTitle>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{mod.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
