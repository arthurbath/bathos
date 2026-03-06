import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isWeakOrLeakedPasswordError, WEAK_PASSWORD_MESSAGE } from '@/lib/authErrors';
import { isPasswordValid } from '@/lib/passwordValidation';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { checkAuthRateLimit, formatRetryAfter } from '@/lib/authRateLimit';
import GatewayFooter from '@/platform/components/GatewayFooter';

export default function AuthPage() {
  const { signIn, signUp } = useAuthContext();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Derive active tab from route
  const activeTab = location.pathname === '/signup' ? 'signup' : 'login';

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
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

  const handleTabChange = (value: string) => {
    navigate(value === 'signup' ? '/signup' : '/signin', { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const rl = await checkAuthRateLimit('sign_in');
    if (rl.rateLimited) {
      toast({ title: 'Too many attempts', description: `Please wait ${formatRetryAfter(rl.retryAfterSeconds)} before trying again.`, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { error } = await signIn(loginEmail, loginPassword);
    if (error) toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' });
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast({ title: 'Please agree to the Terms of Service and Privacy Policy', variant: 'destructive' });
      return;
    }
    setLoading(true);

    const rl = await checkAuthRateLimit('sign_up');
    if (rl.rateLimited) {
      toast({ title: 'Too many attempts', description: `Please wait ${formatRetryAfter(rl.retryAfterSeconds)} before trying again.`, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { error } = await signUp(signupEmail, signupPassword, signupName, latestTermsVersion);
    if (error) {
      toast({
        title: 'Sign up failed',
        description: isWeakOrLeakedPasswordError(error) ? WEAK_PASSWORD_MESSAGE : error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Check your email', description: 'We sent you a confirmation link.' });
      supabase.functions.invoke('notify-new-signup', {
        body: { email: signupEmail, displayName: signupName },
      }).catch((err) => console.error('Signup notification error:', err));
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">BathOS</CardTitle>
            <CardDescription>A bunch of hyper-specific apps for Art and his friends</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-2">
                  <Input placeholder="Email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                  <Input placeholder="Password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                  <Button type="submit" className="w-full" disabled={loading}>Sign In</Button>
                </form>
                <div className="mt-3 text-center">
                  <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground underline">
                    Forgot Password
                  </Link>
                </div>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-2">
                  <Input placeholder="Display name" value={signupName} onChange={e => setSignupName(e.target.value)} required />
                  <Input placeholder="Email" type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required />
                  <Input placeholder="Password" type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required minLength={8} />
                  <PasswordRequirements password={signupPassword} />
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    />
                    <div className="text-sm leading-relaxed">
                      <Label htmlFor="terms" className="cursor-pointer">
                        I agree to the{' '}
                      </Label>
                      <Link to="/terms" className="underline hover:text-primary transition-colors">
                        Terms of Service and Privacy Policy
                      </Link>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !termsAccepted || !isPasswordValid(signupPassword)}>Sign Up</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <GatewayFooter />
    </div>
  );
}
