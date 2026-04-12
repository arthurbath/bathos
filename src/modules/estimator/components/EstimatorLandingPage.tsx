import { startTransition, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { supabaseRequest } from '@/lib/supabaseRequest';
import { withMutationTiming } from '@/lib/mutationTiming';
import { EstimatorPublicHeader } from '@/modules/estimator/components/EstimatorPublicHeader';
import { parseEstimatorCreateRoomResult, parseEstimatorSessionInfo } from '@/modules/estimator/lib/parsers';
import { writeEstimatorStoredIdentity } from '@/modules/estimator/lib/storage';
import type { EstimatorVotingMode } from '@/modules/estimator/types/estimator';

export function EstimatorLandingPage() {
  const navigate = useNavigate();
  const { user, displayName } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [createMode, setCreateMode] = useState<EstimatorVotingMode>('fibonacci');
  const [nickname, setNickname] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const trimmedRoomName = roomName.trim();
  const trimmedNickname = nickname.trim();

  useEffect(() => {
    const normalizedDisplayName = displayName.trim();
    if (!user || !normalizedDisplayName) {
      return;
    }

    setNickname((current) => (current.trim() ? current : normalizedDisplayName));
  }, [displayName, user]);

  const handleCreateRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmedRoomName) {
      toast({ title: 'Room Name Required', variant: 'destructive' });
      return;
    }
    if (!trimmedNickname) {
      toast({ title: 'Nickname Required', variant: 'destructive' });
      return;
    }

    setCreatingRoom(true);

    try {
      const roomPayload = await withMutationTiming({ module: 'estimator', action: 'room.create' }, async () =>
        await supabaseRequest(() =>
          supabase.rpc('estimator_create_room', {
            _name: trimmedRoomName,
            _voting_mode: createMode,
          }),
        ),
      );

      const room = parseEstimatorCreateRoomResult(roomPayload);
      const sessionPayload = await withMutationTiming({ module: 'estimator', action: 'room.join' }, async () =>
        await supabaseRequest(() =>
          supabase.rpc('estimator_join_or_resume_room', {
            _room_token: room.roomToken,
            _nickname: trimmedNickname,
            _member_id: null,
            _member_secret: null,
          }),
        ),
      );
      const session = parseEstimatorSessionInfo(sessionPayload);
      if (!session.member.memberSecret) {
        throw new Error('Room session is missing its member secret.');
      }

      writeEstimatorStoredIdentity(room.roomToken, {
        memberId: session.member.memberId,
        memberSecret: session.member.memberSecret,
        nickname: session.member.nickname,
      });

      startTransition(() => {
        navigate(`/estimator/rooms/${room.roomToken}`);
      });
    } catch (error) {
      toast({ title: 'Failed to create room', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setCreatingRoom(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <EstimatorPublicHeader title="Ticket Estimator" showLauncherButton={Boolean(user)} />
      <main className="mx-auto flex min-h-[calc(100vh-3.75rem)] max-w-5xl items-center px-4 py-6">
        <div className="mx-auto w-full max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle>Create Room</CardTitle>
              <CardDescription>Start a new estimation session.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateRoom}>
                <div className="space-y-2">
                  <Label htmlFor="estimator-room-name">Room Name</Label>
                  <Input
                    id="estimator-room-name"
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sizing Mode</Label>
                  <ToggleGroup
                    type="single"
                    value={createMode}
                    onValueChange={(value) => {
                      if (value === 'ballpark' || value === 'fibonacci') {
                        setCreateMode(value);
                      }
                    }}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="fibonacci" size="sm" aria-label="Fibonacci sizing">
                      Fibonacci
                    </ToggleGroupItem>
                    <ToggleGroupItem value="ballpark" size="sm" aria-label="T-shirt sizing">
                      T-shirt Sizing
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimator-room-nickname">Your Nickname</Label>
                  <Input
                    id="estimator-room-nickname"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    required
                  />
                </div>

                <Button type="submit" variant="success" className="w-full" disabled={creatingRoom || !trimmedRoomName || !trimmedNickname}>
                  {creatingRoom ? 'Creating Room' : 'Create Room'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
