import { Shirt } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FULL_VIEW_PAGE_BOTTOM_PADDING_CLASS, getFullViewPageTopPaddingClass } from '@/lib/pageLayout';
import { WardrobeItemsGrid } from '@/modules/wardrobe/components/WardrobeItemsGrid';
import { useWardrobeItems } from '@/modules/wardrobe/hooks/useWardrobeItems';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';

interface WardrobeShellProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
}

export function WardrobeShell({ userId, displayName, onSignOut }: WardrobeShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = useModuleBasePath();
  const {
    items,
    loading,
    addItem,
    updateItem,
    removeItem,
  } = useWardrobeItems(userId);
  const navItems = [
    { path: '/items', label: 'Items', icon: Shirt },
  ] as const;
  const hasDesktopNavigation = navItems.length > 1;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="relative isolate flex h-dvh flex-col overflow-y-hidden overflow-x-visible bg-background">
      <ToplineHeader
        title="Wardrobe"
        moduleId="wardrobe"
        userId={userId}
        displayName={displayName}
        onSignOut={onSignOut}
        showAppSwitcher
      />

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

      <MobileBottomNav
        items={navItems}
        isActive={(path) => location.pathname === `${basePath}${path}` || location.pathname === path}
        onNavigate={(path) => navigate(`${basePath}${path}`)}
        hrefForPath={(path) => `${basePath}${path}`}
      />
    </div>
  );
}
