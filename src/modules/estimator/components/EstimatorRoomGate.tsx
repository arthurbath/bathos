import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { EstimatorPublicHeader } from '@/modules/estimator/components/EstimatorPublicHeader';

interface EstimatorRoomGateProps {
  joinPending: boolean;
  message?: string | null;
  onJoinRoom: (nickname: string) => Promise<void>;
}

export function EstimatorRoomGate({ joinPending, message, onJoinRoom }: EstimatorRoomGateProps) {
  const [nickname, setNickname] = useState('');
  const description = message ?? 'Enter a nickname to join this estimation room.';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      toast({ title: 'Nickname Required', variant: 'destructive' });
      return;
    }

    try {
      await onJoinRoom(trimmedNickname);
    } catch {
      // Error toast is handled by the caller.
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <EstimatorPublicHeader title="Ticket Estimator" backHref="/estimator" />
      <main className="mx-auto flex min-h-[calc(100vh-3.75rem)] max-w-md items-center px-4 py-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Join Room</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="estimator-room-nickname">Nickname</Label>
                <Input
                  id="estimator-room-nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Enter a nickname"
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full" disabled={joinPending}>
                {joinPending ? 'Joining Room' : 'Join Room'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
