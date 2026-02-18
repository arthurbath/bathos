import { LogOut, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FeedbackDialog } from '@/platform/components/FeedbackDialog';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import { buildRelayUrl } from '@/lib/tokenRelay';

interface ToplineHeaderProps {
  title: string;
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
  showAppSwitcher?: boolean;
}

export function ToplineHeader({ title, userId, displayName, onSignOut, showAppSwitcher = false }: ToplineHeaderProps) {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin(userId);
  const handleAppSwitcher = async () => {
    const hostname = window.location.hostname;
    if (hostname.endsWith('.bath.garden') && hostname !== 'bath.garden' && hostname !== 'www.bath.garden') {
      const relayUrl = await buildRelayUrl('https://bath.garden/');
      window.location.href = relayUrl;
      return;
    }
    navigate('/');
  };

  return (
    <header className="border-b bg-card px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2">
          {showAppSwitcher && (
            <Button variant="ghost" size="icon" onClick={handleAppSwitcher} title="All apps">
              <span className="grid h-4 w-4 grid-cols-3 gap-[2px]" aria-hidden="true">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <span key={idx} className="block rounded-[1px] bg-current" />
                ))}
              </span>
            </Button>
          )}
          <h1 className="text-lg font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} title="Administration">
              <Shield className="h-4 w-4" />
            </Button>
          )}
          <FeedbackDialog userId={userId} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <User className="h-4 w-4" />
                <span className="text-sm">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => navigate('/account')}>
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { void onSignOut(); }}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
