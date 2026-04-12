import { ArrowLeft, Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { HeaderUserControls } from '@/platform/components/HeaderUserControls';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
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
  actionsAccessory?: ReactNode;
}

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

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
  actionsAccessory,
}: ToplineHeaderProps) {
  const navigate = useNavigate();
  const moduleConfig = moduleId ? getModuleById(moduleId) : undefined;
  const ModuleIcon = moduleConfig?.icon;
  const standaloneNavigator = window.navigator as StandaloneNavigator;
  const isIosStandalone =
    (
      standaloneNavigator.standalone === true ||
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
            <span className="select-none">{title}</span>
          </h1>
          {titleAccessory ? <div className="ml-px flex min-w-0 shrink items-center">{titleAccessory}</div> : null}
        </div>
        <HeaderUserControls
          userId={userId}
          displayName={displayName}
          onSignOut={onSignOut}
          leadingAccessory={actionsAccessory}
        />
      </div>
    </header>
  );
}
