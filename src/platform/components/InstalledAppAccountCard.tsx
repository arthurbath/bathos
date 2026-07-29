import { LogOut, Megaphone, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeedbackDialog } from '@/platform/components/FeedbackDialog';
import { useInstalledAppMode } from '@/platform/installedApp';
import { shouldHandleWithBrowser } from '@/lib/navigation';

interface InstalledAppAccountCardProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
}

export function InstalledAppAccountCard({
  userId,
  displayName,
  onSignOut,
}: InstalledAppAccountCardProps) {
  const installed = useInstalledAppMode();
  const location = useLocation();
  const navigate = useNavigate();

  if (!installed) return null;

  return (
    <Card data-installed-account-card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Signed In As</p>
            <p className="truncate text-sm text-foreground">{displayName}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button asChild type="button" variant="outline">
            <a
              href="/account"
              onClick={(event) => {
                if (shouldHandleWithBrowser(event)) return;
                event.preventDefault();
                const fromPath = `${location.pathname}${location.search}${location.hash}`;
                navigate('/account', { state: { fromPath } });
              }}
            >
              <User className="mr-2 h-4 w-4" aria-hidden="true" />
              Account
            </a>
          </Button>
          <FeedbackDialog
            userId={userId}
            trigger={(
              <Button type="button" variant="outline">
                <Megaphone className="mr-2 h-4 w-4" aria-hidden="true" />
                Feedback
              </Button>
            )}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void onSignOut();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Sign Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
