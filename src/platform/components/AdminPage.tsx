import { useEffect, useState } from 'react';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AlertDialog, AlertDialogAction, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Shield } from 'lucide-react';
import * as Sentry from '@sentry/react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRequest } from '@/lib/supabaseRequest';
import {
  getDefaultGridWidthsOnlyColumnErrorMessage,
  isMissingDefaultGridWidthsOnlyColumnError,
  readCachedDefaultGridColumnWidthsOnly,
  writeCachedDefaultGridColumnWidthsOnly,
} from '@/lib/gridColumnWidthPreferences';
import NotFound from '@/pages/NotFound';

export default function AdminPage() {
  const { user, loading } = useAuthContext();
  const { isAdmin, loading: roleLoading, resolved: roleResolved } = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const hasSentryDsn = Boolean(import.meta.env.VITE_SENTRY_DSN);
  const [targetEmail, setTargetEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailPendingDelete, setEmailPendingDelete] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [defaultGridWidthsOnly, setDefaultGridWidthsOnly] = useState(
    () => readCachedDefaultGridColumnWidthsOnly(user?.id),
  );
  const [gridWidthSettingLoading, setGridWidthSettingLoading] = useState(false);
  const [gridWidthSettingSaving, setGridWidthSettingSaving] = useState(false);

  useEffect(() => {
    const nextCachedValue = readCachedDefaultGridColumnWidthsOnly(user?.id);
    setDefaultGridWidthsOnly(nextCachedValue);

    if (!user?.id || !isAdmin) {
      setGridWidthSettingLoading(false);
      return;
    }

    let cancelled = false;
    setGridWidthSettingLoading(true);

    void (async () => {
      try {
        const data = await supabaseRequest(async () =>
          await supabase
            .from('bathos_user_settings')
            .select('use_default_grid_column_widths')
            .eq('user_id', user.id)
            .maybeSingle(),
        );
        if (cancelled) return;

        const enabled = data?.use_default_grid_column_widths === true;
        setDefaultGridWidthsOnly(enabled);
        writeCachedDefaultGridColumnWidthsOnly(user.id, enabled);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load default grid width setting:', error);
        if (isMissingDefaultGridWidthsOnlyColumnError(error)) {
          toast({
            title: 'Grid Width Review unavailable',
            description: getDefaultGridWidthsOnlyColumnErrorMessage(),
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setGridWidthSettingLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, user?.id]);

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
    } catch (e: unknown) {
      toast({ title: 'Deletion failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleDefaultGridWidthsOnlyChange = async (checked: boolean) => {
    if (!user?.id) return;

    setDefaultGridWidthsOnly(checked);
    writeCachedDefaultGridColumnWidthsOnly(user.id, checked);
    setGridWidthSettingSaving(true);

    try {
      await supabaseRequest(async () =>
        await supabase
          .from('bathos_user_settings')
          .upsert(
            [{
              user_id: user.id,
              use_default_grid_column_widths: checked,
            }],
            { onConflict: 'user_id' },
          ),
      );
    } catch (error) {
      console.error('Failed to save default grid width setting:', error);
      setDefaultGridWidthsOnly(!checked);
      writeCachedDefaultGridColumnWidthsOnly(user.id, !checked);
      const description = isMissingDefaultGridWidthsOnlyColumnError(error)
        ? getDefaultGridWidthsOnlyColumnErrorMessage()
        : error instanceof Error
          ? error.message
          : 'Unknown error';
      toast({
        title: 'Failed to save setting',
        description,
        variant: 'destructive',
      });
    } finally {
      setGridWidthSettingSaving(false);
    }
  };

  if (loading || (!!user && (!roleResolved || roleLoading))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user || !isAdmin) return <NotFound />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <Button variant="clear" size="sm" className="h-9 w-9 p-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="inline-flex items-center gap-1.5 text-lg font-bold tracking-tight text-foreground">
            <Shield className="h-4 w-4" aria-hidden="true" />
            <span>Administration</span>
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Grid Width Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="default-grid-widths-only">Show default data grid column widths only</Label>
                <p className="text-xs text-muted-foreground">
                  Disables grid column resizing for your current admin account and ignores saved width preferences.
                </p>
              </div>
              <Switch
                id="default-grid-widths-only"
                checked={defaultGridWidthsOnly}
                onCheckedChange={handleDefaultGridWidthsOnlyChange}
                disabled={gridWidthSettingLoading || gridWidthSettingSaving}
              />
            </div>
          </CardContent>
        </Card>

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
              <Button
                variant="destructive"
                onClick={openDeleteDialog}
                className="shrink-0"
                disabled={!targetEmail.trim()}
              >
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
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
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
            </div>

            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Button Variants</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="default">Normal Filled</Button>
                <Button variant="success">Success Filled</Button>
                <Button variant="destructive">Danger Filled</Button>
                <Button variant="warning">Warning Filled</Button>
                <Button variant="info">Info Filled</Button>
                <Button variant="admin">Admin Filled</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline">Normal Outline</Button>
                <Button variant="outline-success">Success Outline</Button>
                <Button variant="outline-destructive">Danger Outline</Button>
                <Button variant="outline-warning">Warning Outline</Button>
                <Button variant="outline-info">Info Outline</Button>
                <Button variant="outline-admin">Admin Outline</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="default" disabled>Normal Filled Disabled</Button>
                <Button variant="success" disabled>Success Filled Disabled</Button>
                <Button variant="destructive" disabled>Danger Filled Disabled</Button>
                <Button variant="warning" disabled>Warning Filled Disabled</Button>
                <Button variant="info" disabled>Info Filled Disabled</Button>
                <Button variant="admin" disabled>Admin Filled Disabled</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled>Normal Outline Disabled</Button>
                <Button variant="outline-success" disabled>Success Outline Disabled</Button>
                <Button variant="outline-destructive" disabled>Danger Outline Disabled</Button>
                <Button variant="outline-warning" disabled>Warning Outline Disabled</Button>
                <Button variant="outline-info" disabled>Info Outline Disabled</Button>
                <Button variant="outline-admin" disabled>Admin Outline Disabled</Button>
              </div>
            </div>
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
            <AlertDialogDescription>
              This action cannot be undone. Type <span className="font-medium">{emailPendingDelete}</span> to confirm deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={emailPendingDelete ?? ''}
              autoComplete="off"
              className="border-destructive/30 focus:border-destructive"
            />
          </AlertDialogBody>
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
