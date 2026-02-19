import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ToplineHeader } from '@/platform/components/ToplineHeader';

interface HouseholdSetupProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
  onComplete: () => Promise<void>;
  onJoin: (inviteCode: string) => Promise<void>;
}

export function HouseholdSetup({ userId, displayName, onSignOut, onComplete, onJoin }: HouseholdSetupProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onComplete();
    } catch (err: any) {
      toast({
        title: 'Failed to create household',
        description: err?.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      await onJoin(inviteCode.trim());
    } catch (err: any) {
      toast({
        title: 'Failed to join household',
        description: err?.message || 'Invalid invite code or household is full.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ToplineHeader title="Budget" userId={userId} displayName={displayName} onSignOut={onSignOut} />
      <main className="flex min-h-[calc(100dvh-57px)] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Get Started</CardTitle>
            <CardDescription className="text-base">
              Create a new household or join an existing one with an invite code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="create">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">Create New</TabsTrigger>
                <TabsTrigger value="join">Join Existing</TabsTrigger>
              </TabsList>

              <TabsContent value="create">
                <form onSubmit={handleCreate} className="space-y-4 pt-2">
                  <Button type="submit" className="w-full gap-1.5" disabled={loading}>
                    <Users className="h-4 w-4" />
                    {loading ? 'Creating…' : 'Create household'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join">
                <form onSubmit={handleJoin} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label htmlFor="inviteCode" className="text-sm font-medium text-foreground">
                      Invite code
                    </label>
                    <Input
                      id="inviteCode"
                      placeholder="Enter invite code from your partner"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="font-mono tracking-widest"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full gap-1.5" disabled={!inviteCode.trim() || loading}>
                    <UserPlus className="h-4 w-4" />
                    {loading ? 'Joining…' : 'Join household'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
