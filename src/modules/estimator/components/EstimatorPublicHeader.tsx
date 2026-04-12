import { ArrowLeft, Calculator, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import { FeedbackDialog } from '@/platform/components/FeedbackDialog';
import { HeaderUserControls } from '@/platform/components/HeaderUserControls';

interface EstimatorPublicHeaderProps {
  title: string;
  backHref?: string;
  titleAccessory?: React.ReactNode;
  actionsAccessory?: React.ReactNode;
  showLauncherButton?: boolean;
}

export function EstimatorPublicHeader({
  title,
  backHref,
  titleAccessory,
  actionsAccessory,
  showLauncherButton = false,
}: EstimatorPublicHeaderProps) {
  const navigate = useNavigate();
  const { user, displayName, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--grid-sticky-line))] bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {backHref ? (
            <Button asChild type="button" variant="outline" size="sm" className="h-9 w-9 p-0">
              <a
                href={backHref}
                aria-label="Back"
                title="Back"
                onClick={(event) => handleClientSideLinkNavigation(event, navigate, backHref)}
              >
                <ArrowLeft className="h-4 w-4" />
              </a>
            </Button>
          ) : showLauncherButton ? (
            <Button asChild type="button" variant="clear" size="sm" className="h-9 w-9 p-0" title="All apps">
              <a
                href="/"
                aria-label="All apps"
                onClick={(event) => handleClientSideLinkNavigation(event, navigate, '/')}
              >
                <Menu className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          <h1 className="inline-flex min-w-0 items-center gap-2 text-lg font-bold tracking-tight text-foreground">
            <Calculator className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="truncate">{title}</span>
          </h1>
          {titleAccessory ? <div className="ml-px flex min-w-0 shrink items-center">{titleAccessory}</div> : null}
        </div>
        {user ? (
          <HeaderUserControls
            userId={user.id}
            displayName={displayName}
            onSignOut={signOut}
            leadingAccessory={actionsAccessory}
          />
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <FeedbackDialog />
            {actionsAccessory ? <div className="shrink-0">{actionsAccessory}</div> : null}
          </div>
        )}
      </div>
    </header>
  );
}
