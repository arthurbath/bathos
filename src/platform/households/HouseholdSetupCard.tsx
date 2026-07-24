import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import type { PlatformModuleId } from '@/platform/modules';

interface HouseholdSetupCardProps {
  moduleTitle: string;
  moduleId?: PlatformModuleId;
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
  onCreate: () => Promise<void>;
  onJoin: (inviteCode: string) => Promise<void>;
  setupTitle: string;
  setupDescription: string;
  createButtonLabel: string;
  joinButtonLabel: string;
  joinInputLabel?: string;
  joinInputPlaceholder?: string;
  createErrorTitle: string;
  joinErrorTitle: string;
  icon?: LucideIcon;
  showAppSwitcher?: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function HouseholdSetupCard({
  moduleTitle,
  moduleId,
  userId,
  displayName,
  onSignOut,
  onCreate,
  onJoin,
  setupTitle,
  setupDescription,
  createButtonLabel,
  joinButtonLabel,
  joinInputLabel = 'Invite Code',
  joinInputPlaceholder = 'Enter invite code',
  createErrorTitle,
  joinErrorTitle,
  icon: Icon = Users,
  showAppSwitcher = false,
}: HouseholdSetupCardProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await onCreate();
    } catch (error: unknown) {
      toast({
        title: createErrorTitle,
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
      await onJoin(inviteCode.trim());
    } catch (error: unknown) {
      toast({
        title: joinErrorTitle,
        description: getErrorMessage(error, 'Invite code is invalid or unavailable.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ToplineHeader
        title={moduleTitle}
        moduleId={moduleId}
        userId={userId}
        displayName={displayName}
        onSignOut={onSignOut}
        showAppSwitcher={showAppSwitcher}
      />
      <main className="flex min-h-[calc(100dvh-57px)] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>{setupTitle}</CardTitle>
            <CardDescription className="text-base">{setupDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="create">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">Create New</TabsTrigger>
                <TabsTrigger value="join">Join Existing</TabsTrigger>
              </TabsList>

              <TabsContent value="create">
                <form data-bathos-return-submits="true" onSubmit={handleCreate} className="space-y-4 pt-2">
                  <Button type="submit" className="w-full gap-1.5" disabled={loading}>
                    <Users className="h-4 w-4" />
                    {loading ? 'Creating...' : createButtonLabel}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join">
                <form data-bathos-return-submits="true" onSubmit={handleJoin} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label htmlFor="householdInviteCode" className="text-sm font-medium text-foreground">
                      {joinInputLabel}
                    </label>
                    <Input
                      id="householdInviteCode"
                      placeholder={joinInputPlaceholder}
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value)}
                      className="font-mono tracking-widest"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full gap-1.5" disabled={loading || !inviteCode.trim()}>
                    <UserPlus className="h-4 w-4" />
                    {loading ? 'Joining...' : joinButtonLabel}
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
