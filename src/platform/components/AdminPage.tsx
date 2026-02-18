import { useAuthContext } from '@/platform/contexts/AuthContext';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import * as Sentry from '@sentry/react';
import { toast } from '@/hooks/use-toast';
import NotFound from '@/pages/NotFound';

export default function AdminPage() {
  const { user, loading } = useAuthContext();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  const navigate = useNavigate();

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user || !isAdmin) return <NotFound />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Administration</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>UI Testing</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => toast({ title: 'Info', description: 'This is a generic info toast.' })}
            >
              Test Info Toast
            </Button>
            <Button
              variant="destructive"
              onClick={() => toast({ title: 'Error', description: 'This is a danger toast.', variant: 'destructive' })}
            >
              Test Danger Toast
            </Button>
            <Button
              variant="outline"
              onClick={() => { throw new Error('Sentry test error from admin panel'); }}
            >
              Test Sentry Error
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
