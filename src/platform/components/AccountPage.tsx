import { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Pencil } from 'lucide-react';
import { isWeakOrLeakedPasswordError, WEAK_PASSWORD_MESSAGE } from '@/lib/authErrors';
import { isPasswordValid } from '@/lib/passwordValidation';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { useLocation } from 'react-router-dom';

interface AccountPageLocationState {
  fromPath?: string;
}

function resolveBackHref(state: AccountPageLocationState | null): string {
  if (!state?.fromPath || !state.fromPath.startsWith('/')) return '/';
  if (state.fromPath === '/account' || state.fromPath.startsWith('/account?') || state.fromPath.startsWith('/account#')) {
    return '/';
  }
  return state.fromPath;
}

export default function AccountPage() {
  const { user, isSigningOut, signOut, displayName: authDisplayName, setDisplayName: setAuthDisplayName } = useAuthContext();
  const { isAdmin } = useIsAdmin(user?.id);
  const { toast } = useToast();
  const location = useLocation();

  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const displayNameInputRef = useRef<HTMLInputElement>(null);
  const displayNameCancelButtonRef = useRef<HTMLButtonElement>(null);
  const displayNameSaveButtonRef = useRef<HTMLButtonElement>(null);

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
  }, [user]);

  useEffect(() => {
    setDisplayName(authDisplayName);
  }, [authDisplayName]);

  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return;
    const nextDisplayName = displayName.trim();
    setSavingName(true);
    const { error } = await supabase
      .from('bathos_profiles')
      .update({ display_name: nextDisplayName })
      .eq('id', user.id);
    if (error) {
      toast({ title: 'Failed to update name', description: error.message, variant: 'destructive' });
    } else {
      setAuthDisplayName(nextDisplayName);
      setDisplayName(nextDisplayName);
      toast({ title: 'Display name updated' });
      setEditingName(false);
    }
    setSavingName(false);
  };

  const handleDisplayNameEditorTab = (event: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => {
    if (event.key !== 'Tab') return;

    const focusableElements = [
      displayNameInputRef.current,
      displayNameCancelButtonRef.current,
      displayNameSaveButtonRef.current,
    ].filter((element): element is HTMLInputElement | HTMLButtonElement => !!element && !element.disabled);

    if (focusableElements.length === 0) return;

    const currentIndex = focusableElements.indexOf(event.currentTarget);
    if (currentIndex === -1) return;

    event.preventDefault();
    const direction = event.shiftKey ? -1 : 1;
    const nextIndex = (currentIndex + direction + focusableElements.length) % focusableElements.length;
    focusableElements[nextIndex].focus();
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

  if (isSigningOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) return null;
  const backHref = resolveBackHref(location.state as AccountPageLocationState | null);

  return (
    <div className="min-h-screen bg-background">
      <ToplineHeader
        title="BathOS"
        userId={user.id}
        displayName={authDisplayName}
        onSignOut={signOut}
        backHref={backHref}
        maxWidthClassName="max-w-lg"
      />

      <main className="mx-auto max-w-lg px-4 py-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Account</CardTitle>
            {isAdmin && (
              <Badge className="bg-admin text-admin-foreground">Admin</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <section className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Display Name</p>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    ref={displayNameInputRef}
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    onKeyDown={handleDisplayNameEditorTab}
                    autoFocus
                    className="min-w-0 flex-1"
                  />
                  <div className="flex shrink-0 gap-2">
                    <Button
                      ref={displayNameCancelButtonRef}
                      variant="outline"
                      onClick={() => setEditingName(false)}
                      onKeyDown={handleDisplayNameEditorTab}
                    >
                      Cancel
                    </Button>
                    <Button
                      ref={displayNameSaveButtonRef}
                      onClick={handleSaveName}
                      onKeyDown={handleDisplayNameEditorTab}
                      disabled={savingName || !displayName.trim()}
                    >
                      {savingName ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-sm leading-none">
                  <span>{displayName}</span>
                  <Pencil
                    className="h-3.5 w-3.5 cursor-pointer text-muted-foreground hover:text-foreground"
                    role="button"
                    tabIndex={0}
                    aria-label="Edit display name"
                    onClick={() => setEditingName(true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setEditingName(true);
                      }
                    }}
                  />
                </div>
              )}
            </section>

            <section className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <span className="text-sm">{userEmail}</span>
            </section>

            <section className="space-y-2 border-t pt-4">
              <Button variant="outline" className="w-full" onClick={signOut} disabled={isSigningOut}>
                Sign Out
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowChangePassword(true)}>
                Change Password
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowChangeEmail(true)}>
                Change Email
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline-destructive" className="w-full">
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Account</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. All your data will be permanently removed. Type your email address to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogBody>
                    <Input
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      placeholder={userEmail}
                    />
                  </AlertDialogBody>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText.toLowerCase() !== userEmail.toLowerCase() || isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Account'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          </CardContent>
        </Card>
      </main>

      {/* Change Email Dialog */}
      <Dialog open={showChangeEmail} onOpenChange={setShowChangeEmail}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Email</DialogTitle>
            <DialogDescription>
              Enter your current password and new email. Confirmation links will be sent to both addresses.
            </DialogDescription>
          </DialogHeader>
          <form id="change-email-form" onSubmit={handleChangeEmail}>
            <DialogBody className="space-y-4 pb-6">
              <div>
                <label className="mb-1 block text-sm font-medium">Current Email</label>
                <Input value={userEmail} disabled className="bg-muted" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Current Password</label>
                <Input type="password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">New Email</label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} autoComplete="email" autoFocus />
              </div>
            </DialogBody>
            <DialogFooter className="mb-0 pt-6">
              <Button type="button" variant="outline" onClick={() => setShowChangeEmail(false)}>Cancel</Button>
              <Button type="submit" disabled={emailSubmitting || !newEmail || !emailPassword}>
                {emailSubmitting ? 'Sending...' : 'Send Confirmation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter a new password for your account.</DialogDescription>
          </DialogHeader>
          <form id="change-password-form" onSubmit={handleChangePassword}>
            <DialogBody className="space-y-4 pb-6">
              <div>
                <label className="text-sm font-medium mb-1 block">New Password</label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" autoFocus />
                <PasswordRequirements password={newPassword} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Confirm Password</label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" />
              </div>
            </DialogBody>
            <DialogFooter className="mb-0 pt-6">
              <Button type="button" variant="outline" onClick={() => setShowChangePassword(false)}>Cancel</Button>
              <Button type="submit" disabled={passwordSubmitting || !isPasswordValid(newPassword) || !confirmPassword}>
                {passwordSubmitting ? 'Updating...' : 'Update Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
