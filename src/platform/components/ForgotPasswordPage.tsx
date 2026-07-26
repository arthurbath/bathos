import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { checkAuthRateLimit, formatRetryAfter } from '@/lib/authRateLimit';
import GatewayPageLayout from '@/platform/components/GatewayPageLayout';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuthContext();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    const rl = await checkAuthRateLimit('forgot_password');
    if (rl.rateLimited) {
      toast({ title: 'Too Many Attempts', description: `Please wait ${formatRetryAfter(rl.retryAfterSeconds)} before trying again.`, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { error } = await resetPassword(email.trim().toLowerCase());
    if (error) {
      toast({ title: 'Failed to Send Reset Email', description: error.message, variant: 'destructive' });
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <GatewayPageLayout contentClassName="max-w-md">
        <Card className="w-full text-center">
          <CardHeader>
            <CardTitle>Check Your Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong>{email}</strong>, we sent password reset instructions.
            </p>
            <Button variant="outline" className="w-full" onClick={() => window.location.href = '/signin'}>
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </GatewayPageLayout>
    );
  }

  return (
    <GatewayPageLayout contentClassName="max-w-md">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle>Forgot Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form data-bathos-return-submits="true" onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Enter Your Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <a href="/signin" className="text-sm text-muted-foreground hover:text-foreground underline">
              Back to Sign In
            </a>
          </div>
        </CardContent>
      </Card>
    </GatewayPageLayout>
  );
}
