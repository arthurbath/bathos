import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface HouseholdSetupProps {
  onComplete: (displayName: string) => Promise<void>;
}

export function HouseholdSetup({ onComplete }: HouseholdSetupProps) {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setLoading(true);
    await onComplete(displayName.trim());
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Create Household</CardTitle>
          <CardDescription className="text-base">
            Enter your name to create a new household. You can invite your partner later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-medium text-foreground">
                Your display name
              </label>
              <Input
                id="displayName"
                placeholder='e.g. "Alice"'
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={!displayName.trim() || loading}>
              {loading ? 'Creating…' : 'Create household'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
