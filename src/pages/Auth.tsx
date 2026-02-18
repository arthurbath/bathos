import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Scissors } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

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
      toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Check your email', description: 'We sent you a confirmation link.' });
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Scissors className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Split</CardTitle>
          <CardDescription>Fair expense splitting for couples</CardDescription>
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
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 pt-2">
                <Input placeholder="Display name" value={signupName} onChange={e => setSignupName(e.target.value)} required />
                <Input placeholder="Email" type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required />
                <Input placeholder="Password (min 6 chars)" type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required minLength={6} />
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="terms-auth"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  />
                  <Label htmlFor="terms-auth" className="text-sm leading-relaxed cursor-pointer">
                    I agree to the{' '}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-primary transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      Terms of Service and Privacy Policy
                    </a>
                  </Label>
                </div>
                <Button type="submit" className="w-full" disabled={loading || !termsAccepted}>Sign up</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
