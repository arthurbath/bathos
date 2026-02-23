import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { Boxes, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface DrawersHouseholdSetupProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
  onCreate: () => Promise<void>;
  onJoin: (inviteCode: string) => Promise<void>;
}

export function DrawersHouseholdSetup({
  userId,
  displayName,
  onSignOut,
  onCreate,
  onJoin,
}: DrawersHouseholdSetupProps) {
  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await onCreate();
    } catch (error: unknown) {
      toast({
        title: 'Failed to create drawer household',
        description: getErrorMessage(error, 'Something went wrong. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteCode.trim()) return;

    setLoading(true);
    try {
      await onJoin(inviteCode);
    } catch (error: unknown) {
      toast({
        title: 'Failed to join drawer household',
        description: getErrorMessage(error, 'Invite code is invalid or unavailable.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ToplineHeader title="Drawer Planner" userId={userId} displayName={displayName} onSignOut={onSignOut} showAppSwitcher />
      <main className="flex min-h-[calc(100dvh-57px)] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Boxes className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Drawer Planner Setup</CardTitle>
            <CardDescription className="text-base">
              Create a new drawer household or join one using an invite code.
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
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Drawer Household'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join">
                <form onSubmit={handleJoin} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label htmlFor="drawersInviteCode" className="text-sm font-medium text-foreground">
                      Invite Code
                    </label>
                    <Input
                      id="drawersInviteCode"
                      placeholder="Enter invite code"
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value)}
                      className="font-mono tracking-widest"
                      autoFocus
                    />
                  </div>

                  <Button type="submit" className="w-full gap-1.5" disabled={loading || !inviteCode.trim()}>
                    <UserPlus className="h-4 w-4" />
                    {loading ? 'Joining...' : 'Join Household'}
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
