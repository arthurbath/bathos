import { useState } from 'react';
import { Household } from '@/types/fairshare';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface HouseholdSetupProps {
  onComplete: (household: Household) => void;
}

export function HouseholdSetup({ onComplete }: HouseholdSetupProps) {
  const [partnerX, setPartnerX] = useState('');
  const [partnerY, setPartnerY] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerX.trim() || !partnerY.trim()) return;

    const household: Household = {
      id: crypto.randomUUID(),
      partnerX: partnerX.trim(),
      partnerY: partnerY.trim(),
      createdAt: new Date().toISOString(),
    };
    onComplete(household);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">FairShare</CardTitle>
          <CardDescription className="text-base">
            Set up your household to start splitting expenses fairly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="partnerX" className="text-sm font-medium text-foreground">
                Partner 1 name
              </label>
              <Input
                id="partnerX"
                placeholder='e.g. "Alice"'
                value={partnerX}
                onChange={(e) => setPartnerX(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="partnerY" className="text-sm font-medium text-foreground">
                Partner 2 name
              </label>
              <Input
                id="partnerY"
                placeholder='e.g. "Bob"'
                value={partnerY}
                onChange={(e) => setPartnerY(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!partnerX.trim() || !partnerY.trim()}
            >
              Get started
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
