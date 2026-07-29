import { Settings, Shirt } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  CARD_PAGE_BOTTOM_PADDING_CLASS,
  FULL_VIEW_PAGE_BOTTOM_PADDING_CLASS,
  getFullViewPageTopPaddingClass,
} from '@/lib/pageLayout';
import { WardrobeItemsGrid } from '@/modules/wardrobe/components/WardrobeItemsGrid';
import { useWardrobeItems } from '@/modules/wardrobe/hooks/useWardrobeItems';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';
import { useInstalledAppMode } from '@/platform/installedApp';
import { InstalledAppAccountCard } from '@/platform/components/InstalledAppAccountCard';
import { handleClientSideLinkNavigation } from '@/lib/navigation';

interface WardrobeShellProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
}

export function WardrobeShell({ userId, displayName, onSignOut }: WardrobeShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = useModuleBasePath();
  const installed = useInstalledAppMode();
  const {
    items,
    loading,
    addItem,
    updateItem,
    removeItem,
  } = useWardrobeItems(userId);
  const isConfigRoute = location.pathname.endsWith('/config');
  const navItems = [
    { path: '/items', label: 'Items', icon: Shirt },
    ...(installed ? [{ path: '/config', label: 'Config', icon: Settings }] : []),
  ];
  const hasDesktopNavigation = navItems.length > 1;

  if (isConfigRoute && !installed) {
    return <Navigate to={`${basePath}/items`} replace />;
  }

  if (loading && !isConfigRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={`relative isolate bg-background ${isConfigRoute ? 'min-h-screen' : 'flex h-dvh flex-col overflow-y-hidden overflow-x-visible'}`}>
      <ToplineHeader
        title="Wardrobe"
        moduleId="wardrobe"
        userId={userId}
        displayName={displayName}
        onSignOut={onSignOut}
        showAppSwitcher
      />

      {hasDesktopNavigation ? (
        <div className="mx-auto hidden w-full max-w-5xl px-4 pt-6 md:block">
          <nav className="hidden w-full grid-cols-2 gap-0.5 rounded-lg border border-[hsl(var(--grid-sticky-line))] bg-[hsl(var(--switch-off))] p-1 text-muted-foreground md:grid">
            {navItems.map(({ path, label, icon: Icon }) => {
              const href = `${basePath}${path}`;
              const active = location.pathname === href;
              return (
                <a
                  key={path}
                  href={href}
                  onClick={(event) => handleClientSideLinkNavigation(event, navigate, href)}
                  className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-background text-foreground' : 'text-foreground hover:bg-background/50'}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </a>
              );
            })}
          </nav>
        </div>
      ) : null}

      {isConfigRoute ? (
        <main className={`mx-auto w-full max-w-5xl px-4 pt-4 md:pt-6 ${CARD_PAGE_BOTTOM_PADDING_CLASS}`}>
          <InstalledAppAccountCard
            userId={userId}
            displayName={displayName}
            onSignOut={onSignOut}
          />
        </main>
      ) : (
        <main className={`flex w-full flex-1 min-h-0 flex-col ${getFullViewPageTopPaddingClass(hasDesktopNavigation)} ${FULL_VIEW_PAGE_BOTTOM_PADDING_CLASS}`}>
          <div className="flex-1 min-h-0">
            <WardrobeItemsGrid
              userId={userId}
              items={items}
              loading={loading}
              fullView
              fullViewTopBorder={hasDesktopNavigation}
              onAddItem={addItem}
              onUpdateItem={updateItem}
              onDeleteItem={removeItem}
            />
          </div>
        </main>
      )}

      <MobileBottomNav
        items={navItems}
        isActive={(path) => location.pathname === `${basePath}${path}` || location.pathname === path}
        onNavigate={(path) => navigate(`${basePath}${path}`)}
        hrefForPath={(path) => `${basePath}${path}`}
      />
    </div>
  );
}
