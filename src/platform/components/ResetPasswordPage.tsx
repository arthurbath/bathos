import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isWeakOrLeakedPasswordError, WEAK_PASSWORD_MESSAGE } from '@/lib/authErrors';
import { isPasswordValid } from '@/lib/passwordValidation';
import { PasswordRequirements } from '@/components/PasswordRequirements';

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasValidToken, setHasValidToken] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') && hash.includes('access_token')) {
      setHasValidToken(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (!isPasswordValid(newPassword)) {
      toast({ title: 'Password does not meet requirements', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({
        title: 'Failed to reset password',
        description: isWeakOrLeakedPasswordError(error) ? WEAK_PASSWORD_MESSAGE : error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Password updated' });
      setTimeout(() => { window.location.href = '/'; }, 1500);
    }
    setSubmitting(false);
  };

  if (!hasValidToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Invalid reset link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">This password reset link is invalid or has expired.</p>
            <Button className="w-full" onClick={() => window.location.href = '/'}>Back to sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Set new password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">New password</label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" autoFocus />
              <PasswordRequirements password={newPassword} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Confirm password</label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting || !isPasswordValid(newPassword) || !confirmPassword}>
              {submitting ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
