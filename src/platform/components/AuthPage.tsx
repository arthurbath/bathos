import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { TermsDocument } from '@/platform/components/TermsDocument';
import { isWeakOrLeakedPasswordError, WEAK_PASSWORD_MESSAGE } from '@/lib/authErrors';
import { isPasswordValid } from '@/lib/passwordValidation';
import { PasswordRequirements } from '@/components/PasswordRequirements';

export default function AuthPage() {
  const { signIn, signUp } = useAuthContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [latestTermsVersion, setLatestTermsVersion] = useState('1.0.0');

  useEffect(() => {
    supabase
      .from('bathos_terms_versions')
      .select('version')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setLatestTermsVersion(data[0].version);
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast({ title: 'Please agree to the Terms of Service and Privacy Policy', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName, latestTermsVersion);
    if (error) {
      toast({
        title: 'Sign up failed',
        description: isWeakOrLeakedPasswordError(error) ? WEAK_PASSWORD_MESSAGE : error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Check your email', description: 'We sent you a confirmation link.' });
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">BathOS</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Log in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-2">
                <Input placeholder="Email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                <Input placeholder="Password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                <Button type="submit" className="w-full" disabled={loading}>Log in</Button>
              </form>
              <div className="mt-3 text-center">
                <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground underline">
                  Forgot password
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 pt-2">
                <Input placeholder="Display name" value={signupName} onChange={e => setSignupName(e.target.value)} required />
                <Input placeholder="Email" type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required />
                <Input placeholder="Password" type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required minLength={8} />
                <PasswordRequirements password={signupPassword} />
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  />
                  <div className="text-sm leading-relaxed">
                    <Label htmlFor="terms" className="cursor-pointer">
                      I agree to the{' '}
                    </Label>
                    <button
                      type="button"
                      className="underline hover:text-primary transition-colors"
                      onClick={() => setShowTermsModal(true)}
                    >
                      Terms of Service and Privacy Policy
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading || !termsAccepted || !isPasswordValid(signupPassword)}>Sign up</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Terms of Service and Privacy Policy</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 md:px-8 md:py-6">
            <TermsDocument className="text-sm md:text-[15px]" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
