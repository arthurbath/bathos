import { useState, useEffect } from 'react';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isWeakOrLeakedPasswordError, WEAK_PASSWORD_MESSAGE } from '@/lib/authErrors';
import { isPasswordValid } from '@/lib/passwordValidation';
import { PasswordRequirements } from '@/components/PasswordRequirements';

export default function AccountPage() {
  const { user, signOut } = useAuthContext();
  const { isAdmin } = useIsAdmin(user?.id);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const [userEmail, setUserEmail] = useState('');
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Change email form
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // Change password form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Delete account
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUserEmail(user.email ?? '');

    supabase
      .from('bathos_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setDisplayName(data.display_name);
      });
  }, [user]);

  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return;
    setSavingName(true);
    const { error } = await supabase
      .from('bathos_profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id);
    if (error) {
      toast({ title: 'Failed to update name', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Display name updated' });
      setEditingName(false);
    }
    setSavingName(false);
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailSubmitting || !newEmail || !emailPassword) return;
    setEmailSubmitting(true);

    // Verify password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: emailPassword,
    });
    if (signInErr) {
      toast({ title: 'Incorrect password', variant: 'destructive' });
      setEmailSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ email: newEmail.toLowerCase().trim() });
    if (error) {
      toast({ title: 'Failed to change email', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Confirmation emails sent', description: 'Check both your current and new email addresses.' });
      setShowChangeEmail(false);
      setNewEmail('');
      setEmailPassword('');
    }
    setEmailSubmitting(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordSubmitting || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (!isPasswordValid(newPassword)) {
      toast({ title: 'Password does not meet requirements', variant: 'destructive' });
      return;
    }
    setPasswordSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({
        title: 'Failed to change password',
        description: isWeakOrLeakedPasswordError(error) ? WEAK_PASSWORD_MESSAGE : error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Password updated' });
      setShowChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
    }
    setPasswordSubmitting(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== userEmail.toLowerCase()) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-account');
      if (error) throw new Error(error.message || 'Failed to delete account');
      if (!data?.success) throw new Error(data?.error || 'Account deletion failed');
      await signOut();
      window.location.href = '/';
    } catch (error) {
      toast({
        title: 'Deletion failed',
        description: error instanceof Error ? error.message : 'There was an error deleting your account.',
        variant: 'destructive',
      });
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight">Account</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
        {/* Admin badge */}
        {isAdmin && (
          <Badge className="bg-admin text-admin-foreground">Admin</Badge>
        )}

        {/* Display name */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Display name</CardTitle>
          </CardHeader>
          <CardContent>
            {editingName ? (
              <div className="flex gap-2">
                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} autoFocus />
                <Button onClick={handleSaveName} disabled={savingName || !displayName.trim()} size="sm">
                  {savingName ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingName(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span>{displayName}</span>
                <Button variant="ghost" size="sm" onClick={() => setEditingName(true)}>Edit</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Email</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm">{userEmail}</span>
              <Button variant="ghost" size="sm" onClick={() => setShowChangeEmail(true)}>Change</Button>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <Button variant="outline" className="w-full" onClick={() => setShowChangePassword(true)}>
            Change password
          </Button>
          <Button variant="outline" className="w-full" onClick={signOut}>
            Sign out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full text-destructive hover:text-destructive" size="sm">
                Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All your data will be permanently removed. Type your email address to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={userEmail}
                className="mt-2"
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText.toLowerCase() !== userEmail.toLowerCase() || isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? 'Deleting...' : 'Delete account'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>

      {/* Change Email Dialog */}
      <Dialog open={showChangeEmail} onOpenChange={setShowChangeEmail}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change email</DialogTitle>
            <DialogDescription>
              Enter your current password and new email. Confirmation links will be sent to both addresses.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangeEmail} className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Current email</label>
              <Input value={userEmail} disabled className="bg-muted" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Current password</label>
              <Input type="password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">New email</label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} autoComplete="email" autoFocus />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowChangeEmail(false)}>Cancel</Button>
              <Button type="submit" disabled={emailSubmitting || !newEmail || !emailPassword} className="flex-1">
                {emailSubmitting ? 'Sending...' : 'Send confirmation'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Enter a new password for your account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">New password</label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" autoFocus />
              <PasswordRequirements password={newPassword} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Confirm password</label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowChangePassword(false)}>Cancel</Button>
              <Button type="submit" disabled={passwordSubmitting || !isPasswordValid(newPassword) || !confirmPassword} className="flex-1">
                {passwordSubmitting ? 'Updating...' : 'Update password'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
