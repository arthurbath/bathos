import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { getModuleUrl } from '@/platform/hooks/useHostModule';
import { ArrowRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthPage from './AuthPage';

const MODULES = [
  {
    id: 'budget',
    name: 'Budget',
    description: 'Track shared expenses and split costs fairly.',
  },
];

export default function LauncherPage() {
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();

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
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">BathOS</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate('/account')} title="Account">
            <User className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="grid gap-4">
          {MODULES.map(mod => {
            const url = getModuleUrl(mod.id);
            const isExternal = url.startsWith('http');

            return (
              <Card key={mod.id} className="cursor-pointer hover:shadow-sm transition-shadow">
                {isExternal ? (
                  <a href={url} className="block">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{mod.name}</CardTitle>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{mod.description}</p>
                    </CardContent>
                  </a>
                ) : (
                  <div onClick={() => navigate(`${url}/summary`)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{mod.name}</CardTitle>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{mod.description}</p>
                    </CardContent>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
