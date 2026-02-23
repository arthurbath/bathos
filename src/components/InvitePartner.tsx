import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface InvitePartnerProps {
  householdId: string;
  inviteCode: string | null;
}

export function InvitePartner({ householdId, inviteCode }: InvitePartnerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast({ title: 'Invite code copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Invite Your Partner</CardTitle>
        </div>
        <CardDescription>
          Share this code with your partner. They can enter it after signing up to join your household.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            readOnly
            value={inviteCode ?? 'Generating...'}
            className="font-mono text-lg tracking-widest text-center"
          />
          <Button variant="outline" size="icon" onClick={handleCopy} disabled={!inviteCode}>
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface JoinHouseholdProps {
  onJoin: (code: string) => Promise<void>;
}

export function JoinHouseholdSetup({ onJoin }: JoinHouseholdProps) {
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');

  const handleJoin = async () => {
    if (!code.trim() || !displayName.trim()) return;
    setLoading(true);
    try {
      await onJoin(code.trim());
    } catch (e: any) {
      toast({ title: 'Failed to join', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  return null; // This is handled in HouseholdSetup now
}
