import { LogOut, Megaphone, Shield, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FeedbackDialog } from '@/platform/components/FeedbackDialog';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import { useIsMobile } from '@/hooks/use-mobile';
import { handleClientSideLinkNavigation, shouldHandleWithBrowser } from '@/lib/navigation';

interface HeaderUserControlsProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
  leadingAccessory?: ReactNode;
}

export function HeaderUserControls({
  userId,
  displayName,
  onSignOut,
  leadingAccessory,
}: HeaderUserControlsProps) {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin(userId);
  const isMobile = useIsMobile();

  return (
    <div className="flex shrink-0 items-center gap-1 pl-px">
      {isAdmin && !isMobile && (
        <Button asChild variant="clear" size="sm" className="h-9 w-9 p-0" title="Administration">
          <a href="/admin" onClick={(event) => handleClientSideLinkNavigation(event, navigate, '/admin')}>
            <Shield className="h-4 w-4" />
          </a>
        </Button>
      )}
      {!isMobile && <FeedbackDialog userId={userId} />}
      {leadingAccessory ? <div className="shrink-0">{leadingAccessory}</div> : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="clear" size="sm" className="h-9 w-auto px-3 gap-1.5">
            <User className="h-4 w-4" />
            <span className="max-w-[100px] truncate text-sm">{displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          {isAdmin && isMobile && (
            <DropdownMenuItem asChild>
              <a href="/admin" onClick={(event) => handleClientSideLinkNavigation(event, navigate, '/admin')}>
                <Shield className="h-4 w-4 mr-2" />
                Administration
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <a
              href="/account"
              onClick={(event) => {
                if (shouldHandleWithBrowser(event)) return;
                event.preventDefault();
                const fromPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                navigate('/account', { state: { fromPath } });
              }}
            >
              <User className="h-4 w-4 mr-2" />
              Account
            </a>
          </DropdownMenuItem>
          {isMobile && (
            <FeedbackDialog
              userId={userId}
              trigger={(
                <DropdownMenuItem>
                  <Megaphone className="h-4 w-4 mr-2" />
                  Feedback
                </DropdownMenuItem>
              )}
            />
          )}
          <DropdownMenuItem onClick={() => { void onSignOut(); }}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
