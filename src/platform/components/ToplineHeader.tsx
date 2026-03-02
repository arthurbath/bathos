import { ArrowLeft, LogOut, Megaphone, Menu, Shield, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FeedbackDialog } from '@/platform/components/FeedbackDialog';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';
import { useIsMobile } from '@/hooks/use-mobile';
import { handleClientSideLinkNavigation, shouldHandleWithBrowser } from '@/lib/navigation';
import type { PlatformModuleId } from '@/platform/modules';
import { getModuleById } from '@/platform/modules';

interface ToplineHeaderProps {
  title: string;
  moduleId?: PlatformModuleId;
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
  showAppSwitcher?: boolean;
  backHref?: string;
  maxWidthClassName?: string;
  titleAccessory?: ReactNode;
}

export function ToplineHeader({
  title,
  moduleId,
  userId,
  displayName,
  onSignOut,
  showAppSwitcher = false,
  backHref,
  maxWidthClassName = 'max-w-5xl',
  titleAccessory,
}: ToplineHeaderProps) {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin(userId);
  const isMobile = useIsMobile();
  const moduleConfig = moduleId ? getModuleById(moduleId) : undefined;
  const ModuleIcon = moduleConfig?.icon;
  const isIosStandalone =
    (
      (window.navigator as any).standalone === true ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
    ) &&
    (
      /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
    );

  return (
    <header
      className={`sticky top-0 z-[45] isolate border-b border-[hsl(var(--grid-sticky-line))] bg-card ${isIosStandalone ? 'pt-[env(safe-area-inset-top)]' : ''}`}
    >
      <div className={`mx-auto flex ${maxWidthClassName} items-center justify-between gap-2 px-4 py-3`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {backHref ? (
            <Button asChild variant="clear" size="sm" className="h-9 w-9 p-0" title="Back">
              <a href={backHref} onClick={(event) => handleClientSideLinkNavigation(event, navigate, backHref)}>
                <ArrowLeft className="h-4 w-4" />
              </a>
            </Button>
          ) : showAppSwitcher && (
            <Button asChild variant="clear" size="sm" className="h-9 w-9 p-0" title="All apps">
              <a href="/" onClick={(event) => handleClientSideLinkNavigation(event, navigate, '/')}>
                <Menu className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          )}
          <h1 className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-lg font-bold tracking-tight text-foreground">
            {ModuleIcon ? <ModuleIcon className="h-5 w-5" aria-hidden="true" /> : null}
            <span>{title}</span>
          </h1>
          {titleAccessory ? <div className="ml-px flex min-w-0 shrink items-center">{titleAccessory}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 pl-px">
          {isAdmin && !isMobile && (
            <Button asChild variant="clear" size="sm" className="h-9 w-9 p-0" title="Administration">
              <a href="/admin" onClick={(event) => handleClientSideLinkNavigation(event, navigate, '/admin')}>
                <Shield className="h-4 w-4" />
              </a>
            </Button>
          )}
          {!isMobile && <FeedbackDialog userId={userId} />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="clear" size="sm" className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:gap-1.5">
                <User className="h-4 w-4" />
                <span className="hidden text-sm sm:inline">{displayName}</span>
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
      </div>
    </header>
  );
}
