import { useEffect, useMemo, useState } from 'react';
import { Settings, Scale } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import { CARD_PAGE_BOTTOM_PADDING_CLASS, FULL_VIEW_PAGE_BOTTOM_PADDING_CLASS } from '@/lib/pageLayout';
import type { HouseholdMember } from '@/platform/households';
import type { SnakeHouseholdData } from '@/modules/snake/types/snake';
import { useSnakeData, useSnakeWeightRecords } from '@/modules/snake/hooks/useSnakeData';
import { SnakeConfigView } from '@/modules/snake/components/SnakeConfigView';
import { SnakeWeightRecordsGrid } from '@/modules/snake/components/SnakeWeightRecordsGrid';

interface SnakeShellProps {
  household: SnakeHouseholdData;
  userId: string;
  userEmail: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
  householdMembers: HouseholdMember[];
  householdMembersLoading: boolean;
  householdMembersError: string | null;
  pendingHouseholdMemberId: string | null;
  rotatingHouseholdInviteCode: boolean;
  leavingHousehold: boolean;
  deletingHousehold: boolean;
  onRotateHouseholdInviteCode: () => Promise<void>;
  onRemoveHouseholdMember: (memberUserId: string) => Promise<void>;
  onLeaveHousehold: () => Promise<void>;
  onDeleteHousehold: () => Promise<void>;
}

const SELECTED_SNAKE_KEY = 'snake_selected_snake_id';

export function SnakeShell({
  household,
  userId,
  userEmail,
  displayName,
  onSignOut,
  householdMembers,
  householdMembersLoading,
  householdMembersError,
  pendingHouseholdMemberId,
  rotatingHouseholdInviteCode,
  leavingHousehold,
  deletingHousehold,
  onRotateHouseholdInviteCode,
  onRemoveHouseholdMember,
  onLeaveHousehold,
  onDeleteHousehold,
}: SnakeShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = useModuleBasePath();
  const [selectedSnakeId, setSelectedSnakeId] = useState<string | null>(null);

  const navItems = [
    { path: '/weights', label: 'Weights', icon: Scale },
    { path: '/config', label: 'Config', icon: Settings },
  ] as const;

  const {
    snakes,
    activeSnake,
    expectationRanges,
    loading: snakeDataLoading,
    addSnake,
    updateSnake,
    removeSnake,
  } = useSnakeData(household.householdId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = window.localStorage.getItem(`${SELECTED_SNAKE_KEY}:${household.householdId}`);
    if (cached) setSelectedSnakeId(cached);
  }, [household.householdId]);

  useEffect(() => {
    if (snakes.length === 0) {
      setSelectedSnakeId(null);
      return;
    }

    const selectedExists = selectedSnakeId && snakes.some((snake) => snake.id === selectedSnakeId);
    if (selectedExists) return;

    const fallback = activeSnake?.id ?? snakes[0].id;
    setSelectedSnakeId(fallback);
  }, [activeSnake?.id, selectedSnakeId, snakes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `${SELECTED_SNAKE_KEY}:${household.householdId}`;
    if (selectedSnakeId) {
      window.localStorage.setItem(key, selectedSnakeId);
    } else {
      window.localStorage.removeItem(key);
    }
  }, [household.householdId, selectedSnakeId]);

  const selectedSnake = useMemo(
    () => snakes.find((snake) => snake.id === selectedSnakeId) ?? null,
    [selectedSnakeId, snakes],
  );

  const {
    records,
    loading: recordsLoading,
    addWeightRecord,
    updateWeightRecord,
    removeWeightRecord,
  } = useSnakeWeightRecords(household.householdId, selectedSnake?.id);

  const isWeightsRoute = location.pathname.endsWith('/weights') || location.pathname === `${basePath}` || location.pathname === `${basePath}/`;
  const isConfigRoute = location.pathname.endsWith('/config');
  const isFullViewGridRoute = isWeightsRoute;

  useEffect(() => {
    if (location.pathname === '/snake' || location.pathname === '/snake/') {
      navigate(`${basePath}/weights`, { replace: true });
    }
  }, [basePath, location.pathname, navigate]);

  useEffect(() => {
    if (snakeDataLoading) return;
    if (snakes.length !== 0) return;
    if (isConfigRoute) return;
    navigate(`${basePath}/config`, { replace: true });
  }, [basePath, isConfigRoute, navigate, snakeDataLoading, snakes.length]);

  const handleSetActiveSnake = async (snakeId: string) => {
    setSelectedSnakeId(snakeId);

    try {
      const updates = snakes.map((snake) =>
        updateSnake(snake.id, { is_active: snake.id === snakeId }),
      );
      await Promise.all(updates);
    } catch (error) {
      toast({
        title: 'Failed to update active snake',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (snakeDataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={`relative isolate bg-background ${isFullViewGridRoute ? 'h-dvh overflow-y-hidden overflow-x-visible flex flex-col' : 'min-h-screen'}`}>
      <ToplineHeader
        title="Snake"
        moduleId="snake"
        userId={userId}
        displayName={displayName}
        onSignOut={onSignOut}
        showAppSwitcher
        titleAccessory={
          snakes.length > 0 ? (
            <div className="min-w-0 w-full max-w-[200px] flex-1">
              <Select
                value={selectedSnake?.id ?? ''}
                onValueChange={(value) => {
                  void handleSetActiveSnake(value);
                }}
              >
                <SelectTrigger aria-label="Active snake" className="h-8 w-full min-w-[100px]">
                  <SelectValue placeholder="Select snake" />
                </SelectTrigger>
                <SelectContent>
                  {snakes
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((snake) => (
                      <SelectItem key={snake.id} value={snake.id}>{snake.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : null
        }
      />

      <div className="mx-auto hidden w-full max-w-5xl px-4 pt-6 md:block">
        <nav className="hidden w-full grid-cols-2 gap-0.5 rounded-lg border border-[hsl(var(--grid-sticky-line))] bg-[hsl(var(--switch-off))] p-1 text-muted-foreground md:grid">
          {navItems.map(({ path, label, icon: Icon }) => {
            const fullPath = `${basePath}${path}`;
            const active = location.pathname === fullPath || location.pathname === path;
            return (
              <a
                key={path}
                href={fullPath}
                onClick={(event) => handleClientSideLinkNavigation(event, navigate, fullPath)}
                className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-background text-foreground' : 'text-foreground hover:bg-background/50'}`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      <main className={isFullViewGridRoute ? `flex w-full flex-1 min-h-0 flex-col gap-4 pt-0 md:pt-6 ${FULL_VIEW_PAGE_BOTTOM_PADDING_CLASS}` : `mx-auto max-w-5xl space-y-4 px-4 pt-4 md:pt-6 ${CARD_PAGE_BOTTOM_PADDING_CLASS}`}>
        {!selectedSnake && !isConfigRoute ? (
          <div className={isFullViewGridRoute ? 'mx-auto w-full max-w-5xl px-4' : ''}>
            <Card>
              <CardContent className="space-y-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">Create a snake in Config before tracking weight records.</p>
                <Button asChild type="button">
                  <a
                    href={`${basePath}/config`}
                    onClick={(event) => handleClientSideLinkNavigation(event, navigate, `${basePath}/config`)}
                  >
                    Go to Config
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {isWeightsRoute && selectedSnake && (
              <div className="flex-1 min-h-0">
                <SnakeWeightRecordsGrid
                  userId={userId}
                  snake={selectedSnake}
                  records={records}
                  expectationRanges={expectationRanges}
                  loading={recordsLoading}
                  fullView
                  onAddWeightRecord={addWeightRecord}
                  onUpdateWeightRecord={updateWeightRecord}
                  onDeleteWeightRecord={removeWeightRecord}
                />
              </div>
            )}
            {isConfigRoute && (
              <SnakeConfigView
                userId={userId}
                snakes={snakes}
                household={household}
                userEmail={userEmail}
                householdMembers={householdMembers}
                householdMembersLoading={householdMembersLoading}
                householdMembersError={householdMembersError}
                pendingHouseholdMemberId={pendingHouseholdMemberId}
                rotatingHouseholdInviteCode={rotatingHouseholdInviteCode}
                leavingHousehold={leavingHousehold}
                deletingHousehold={deletingHousehold}
                autoOpenAddSnake={snakes.length === 0}
                onAddSnake={addSnake}
                onUpdateSnake={updateSnake}
                onRemoveSnake={removeSnake}
                onRotateHouseholdInviteCode={onRotateHouseholdInviteCode}
                onRemoveHouseholdMember={onRemoveHouseholdMember}
                onLeaveHousehold={onLeaveHousehold}
                onDeleteHousehold={onDeleteHousehold}
              />
            )}
          </>
        )}
      </main>

      <MobileBottomNav
        items={navItems}
        isActive={(path) => location.pathname.endsWith(path)}
        hrefForPath={(path) => `${basePath}${path}`}
        onNavigate={(path) => navigate(`${basePath}${path}`)}
      />
    </div>
  );
}
