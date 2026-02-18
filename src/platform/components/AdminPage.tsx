import { useState } from 'react';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft } from 'lucide-react';
import * as Sentry from '@sentry/react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import NotFound from '@/pages/NotFound';

export default function AdminPage() {
  const { user, loading } = useAuthContext();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const hasSentryDsn = Boolean(import.meta.env.VITE_SENTRY_DSN);
  const [targetEmail, setTargetEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailPendingDelete, setEmailPendingDelete] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const handleSentryTest = async () => {
    if (!hasSentryDsn) {
      toast({
        title: 'Sentry DSN not configured',
        description: 'Set VITE_SENTRY_DSN to send test errors.',
        variant: 'destructive',
      });
      return;
    }

    if (!Sentry.getClient()) {
      toast({
        title: 'Sentry SDK not initialized',
        description: 'Restart the app after updating VITE_SENTRY_DSN.',
        variant: 'destructive',
      });
      return;
    }

    const eventId = Sentry.captureException(new Error('Sentry test error from admin panel'));
    const sent = await Sentry.flush(2000);
    toast({
      title: sent ? 'Sentry test sent' : 'Sentry send not confirmed',
      description: sent
        ? `Event ID: ${eventId}`
        : `Event ID: ${eventId}. Check network blocking (ad blocker/privacy mode) and retry.`,
      variant: sent ? 'default' : 'destructive',
    });
  };

  const openDeleteDialog = () => {
    const normalized = targetEmail.trim().toLowerCase();
    if (!normalized) {
      toast({ title: 'Email required', description: 'Enter a user email to delete.', variant: 'destructive' });
      return;
    }
    setConfirmEmail('');
    setEmailPendingDelete(normalized);
  };

  const handleDeleteUserByEmail = async () => {
    if (!emailPendingDelete) return;
    if (confirmEmail.trim().toLowerCase() !== emailPendingDelete) return;

    setIsDeletingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-users', {
        body: { email: emailPendingDelete },
      });
      if (error) throw new Error(error.message || 'Failed to delete user');
      if (!data?.success) throw new Error(data?.error || 'Deletion failed');

      const result = Array.isArray(data.results) ? data.results[0] : null;
      if (!result) throw new Error('No deletion result was returned');

      if (result.status === 'deleted') {
        toast({ title: 'User deleted', description: `${emailPendingDelete} and associated data were removed.` });
        if (targetEmail.trim().toLowerCase() === emailPendingDelete) {
          setTargetEmail('');
        }
        setEmailPendingDelete(null);
        setConfirmEmail('');
        return;
      }

      if (result.status === 'not_found') {
        toast({ title: 'User not found', description: emailPendingDelete, variant: 'destructive' });
      } else if (result.status === 'forbidden') {
        toast({ title: 'Action not allowed', description: result.detail || 'Cannot delete this user.', variant: 'destructive' });
      } else {
        toast({ title: 'Deletion failed', description: result.detail || 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Deletion failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsDeletingUser(false);
    }
  };

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
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="user@example.com"
                autoComplete="off"
              />
              <Button variant="destructive" onClick={openDeleteDialog} className="shrink-0">
                Delete User
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Deletes auth user, profile/settings/roles, and household data where they are the sole member.
            </p>
          </CardContent>
        </Card>

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
              variant="outline"
              onClick={() => toast({ title: 'Error', description: 'This is a danger toast.', variant: 'destructive' })}
            >
              Test Danger Toast
            </Button>
            <Button
              variant="outline"
              onClick={handleSentryTest}
            >
              Test Sentry Error
            </Button>
          </CardContent>
        </Card>
      </main>

      <AlertDialog
        open={!!emailPendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setEmailPendingDelete(null);
            setConfirmEmail('');
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete user account</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This action cannot be undone. Type <span className="font-medium">{emailPendingDelete}</span> to confirm deletion.
                </p>
                <Input
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={emailPendingDelete ?? ''}
                  autoComplete="off"
                  className="border-destructive/30 focus:border-destructive"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUserByEmail}
              disabled={isDeletingUser || confirmEmail.trim().toLowerCase() !== (emailPendingDelete ?? '')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingUser ? 'Deleting...' : 'Delete user'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
