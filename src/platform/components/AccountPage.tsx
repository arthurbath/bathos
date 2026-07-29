import { useState, useEffect } from 'react';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Pencil } from 'lucide-react';
import { isWeakOrLeakedPasswordError, WEAK_PASSWORD_MESSAGE } from '@/lib/authErrors';
import { isPasswordValid } from '@/lib/passwordValidation';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getInstalledModuleLaunchPath,
  getSignOutDestination,
  useInstalledAppMode,
} from '@/platform/installedApp';
import { handleClientSideLinkNavigation } from '@/lib/navigation';

interface AccountPageLocationState {
  fromPath?: string;
}

function resolveBackHref(
  state: AccountPageLocationState | null,
  fallbackHref: string,
): string {
  if (!state?.fromPath || !state.fromPath.startsWith('/')) return fallbackHref;
  if (state.fromPath === '/account' || state.fromPath.startsWith('/account?') || state.fromPath.startsWith('/account#')) {
    return fallbackHref;
  }
  return state.fromPath;
}

export default function AccountPage() {
  const {
    user, isSigningOut, signOut, displayName: authDisplayName, setDisplayName: setAuthDisplayName,
    passwordRecoveryDetected, clearPasswordRecovery,
  } = useAuthContext();
  const { isAdmin } = useIsAdmin(user?.id);
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const installed = useInstalledAppMode();

  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showChangeEmail, setShowChangeEmail] = useState(false);

  // Change email form
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // Change password (recovery-based flow)
  const [showChangePasswordConfirm, setShowChangePasswordConfirm] = useState(false);
  const [sendingPasswordLink, setSendingPasswordLink] = useState(false);

  // Forced change password modal (after recovery link click)
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
      toast({ title: 'Failed to Update Name', description: error.message, variant: 'destructive' });
    } else {
      setAuthDisplayName(nextDisplayName);
      setDisplayName(nextDisplayName);
      toast({ title: 'Display Name Updated' });
      setEditingName(false);
    }
    setSavingName(false);
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedNew = newEmail.toLowerCase().trim();
    if (emailSubmitting || !normalizedNew || !emailPassword) return;
    if (normalizedNew === userEmail.toLowerCase()) {
      toast({ title: 'New Email Must Be Different from Your Current Email', variant: 'destructive' });
      return;
    }
    setEmailSubmitting(true);
    setEmailSubmitting(true);

    // Verify password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: emailPassword,
    });
    if (signInErr) {
      toast({ title: 'Incorrect Password', variant: 'destructive' });
      setEmailSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ email: newEmail.toLowerCase().trim() });
    if (error) {
      toast({ title: 'Failed to Change Email', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Confirmation Emails Sent', description: 'Check both your current and new email addresses.' });
      setShowChangeEmail(false);
      setNewEmail('');
      setEmailPassword('');
    }
    setEmailSubmitting(false);
  };

  const handleRequestPasswordChange = async () => {
    if (sendingPasswordLink || !userEmail) return;
    setSendingPasswordLink(true);

    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/account`,
    });

    if (error) {
      toast({ title: 'Failed to Send Password Change Link', description: error.message, variant: 'destructive' });
      setSendingPasswordLink(false);
      return;
    }

    toast({ title: 'Password Change Link Sent', description: 'Check your email, then sign back in via the link.' });

    // Brief delay so user sees the toast before sign-out redirects
    setTimeout(() => {
      signOut();
    }, 1500);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordSubmitting || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords Do Not Match', variant: 'destructive' });
      return;
    }
    if (!isPasswordValid(newPassword)) {
      toast({ title: 'Password Does Not Meet Requirements', variant: 'destructive' });
      return;
    }
    setPasswordSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({
        title: 'Failed to Change Password',
        description: isWeakOrLeakedPasswordError(error) ? WEAK_PASSWORD_MESSAGE : error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Password Updated' });
      clearPasswordRecovery();
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
      window.location.href = getSignOutDestination();
    } catch (error) {
      toast({
        title: 'Deletion Failed',
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
  const backHref = resolveBackHref(
    location.state as AccountPageLocationState | null,
    installed ? getInstalledModuleLaunchPath() : '/',
  );

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
        {installed ? (
          <Button asChild variant="clear" size="sm" className="mb-3 -ml-2 gap-1.5">
            <a
              href={backHref}
              onClick={(event) => handleClientSideLinkNavigation(event, navigate, backHref)}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </a>
          </Button>
        ) : null}
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
                <div data-bathos-form-scope="true" className="flex items-center gap-2">
                  <Input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    autoFocus
                    className="min-w-0 flex-1"
                  />
                  <div className="flex shrink-0 gap-2">
                    <Button
                      data-bathos-form-cancel="true"
                      variant="outline"
                      onClick={() => setEditingName(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      data-bathos-form-submit="true"
                      onClick={handleSaveName}
                      disabled={savingName || !displayName.trim()}
                    >
                      {savingName ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-sm leading-none">
                  <span>{displayName}</span>
                  <button
                    type="button"
                    aria-label="Edit Display Name"
                    onClick={() => setEditingName(true)}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </section>

            <section className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <div className="flex items-center gap-1 text-sm leading-none">
                <span>{userEmail}</span>
                <button
                  type="button"
                  aria-label="Change Email"
                  onClick={() => setShowChangeEmail(true)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </section>

            <section className="space-y-2 border-t pt-4">
              <Button variant="outline" className="w-full" onClick={signOut} disabled={isSigningOut}>
                Sign Out
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowChangePasswordConfirm(true)}
              >
                Change Password
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
                  </AlertDialogHeader>
                  <AlertDialogBody className="space-y-4">
                    <AlertDialogDescription>
                      This action cannot be undone. All your data will be permanently removed. Type your email address to confirm.
                    </AlertDialogDescription>
                    <Input
                      value={deleteConfirmText}
                      onChange={e => setDeleteConfirmText(e.target.value)}
                      placeholder={userEmail}
                      inputMode="email"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
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

      {/* Change Password Confirmation Dialog */}
      <AlertDialog open={showChangePasswordConfirm} onOpenChange={setShowChangePasswordConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Password</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody>
            <AlertDialogDescription>
              A password change link will be sent to your email address. You will be signed out and must click the link to set a new password.
            </AlertDialogDescription>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingPasswordLink}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestPasswordChange}
              disabled={sendingPasswordLink}
            >
              {sendingPasswordLink ? 'Sending...' : 'Send Link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Email Dialog */}
      <Dialog open={showChangeEmail} onOpenChange={setShowChangeEmail}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Change Email</DialogTitle>
          </DialogHeader>
          <form id="change-email-form" className="contents" onSubmit={handleChangeEmail}>
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
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} autoComplete="new-email" autoFocus />
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

      {/* Forced Change Password Dialog (after recovery link) */}
      <Dialog open={passwordRecoveryDetected} onOpenChange={() => { /* non-dismissable */ }}>
        <DialogContent
          className="sm:max-w-md"
          hideClose
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <form id="change-password-form" className="contents" onSubmit={handleChangePassword} autoComplete="on">
            <DialogBody className="space-y-4 pb-6">
              {/* Hidden email field for password manager association */}
              <input
                type="email"
                autoComplete="username"
                value={userEmail}
                readOnly
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
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
              <Button type="submit" className="w-full" disabled={passwordSubmitting || !isPasswordValid(newPassword) || !confirmPassword}>
                {passwordSubmitting ? 'Updating...' : 'Update Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
