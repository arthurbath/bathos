import { useEffect } from 'react';
import { Dumbbell, ListOrdered } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import { CARD_PAGE_BOTTOM_PADDING_CLASS, FULL_VIEW_PAGE_BOTTOM_PADDING_CLASS } from '@/lib/pageLayout';
import { ExerciseDefinitionsView } from '@/modules/exercise/components/ExerciseDefinitionsView';
import { ExerciseRoutinesView } from '@/modules/exercise/components/ExerciseRoutinesView';
import { useExerciseDefinitions } from '@/modules/exercise/hooks/useExerciseDefinitions';
import { useExerciseRoutines } from '@/modules/exercise/hooks/useExerciseRoutines';
import { MobileBottomNav } from '@/platform/components/MobileBottomNav';
import { ToplineHeader } from '@/platform/components/ToplineHeader';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';

interface ExerciseShellProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
}

export function ExerciseShell({ userId, displayName, onSignOut }: ExerciseShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = useModuleBasePath();
  const {
    definitions,
    loading: definitionsLoading,
    addDefinition,
    updateDefinition,
    removeDefinition,
  } = useExerciseDefinitions(userId);
  const {
    routines,
    loading: routinesLoading,
    addRoutine,
    updateRoutine,
    removeRoutine,
  } = useExerciseRoutines(userId);

  const navItems = [
    { path: '/routines', label: 'Routines', icon: ListOrdered },
    { path: '/exercises', label: 'Exercises', icon: Dumbbell },
  ] as const;

  useEffect(() => {
    if (location.pathname === '/exercise' || location.pathname === '/exercise/') {
      navigate(`${basePath}/routines`, { replace: true });
    }
  }, [basePath, location.pathname, navigate]);

  if (definitionsLoading || routinesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  const isRoutinesRoute = location.pathname.endsWith('/routines');
  const isExercisesRoute = location.pathname.endsWith('/exercises');
  const isFullViewGridRoute = isExercisesRoute;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ToplineHeader
        title="Exercise"
        moduleId="exercise"
        userId={userId}
        displayName={displayName}
        onSignOut={onSignOut}
        showAppSwitcher
      />

      <div className="mx-auto hidden w-full max-w-5xl px-4 pt-6 md:block">
        <nav className="grid w-full grid-cols-2 gap-0.5 rounded-lg border border-[hsl(var(--grid-sticky-line))] bg-[hsl(var(--switch-off))] p-1 text-muted-foreground">
          {navItems.map(({ path, label, icon: Icon }) => {
            const fullPath = `${basePath}${path}`;
            const active = location.pathname === fullPath || location.pathname === path;
            return (
              <a
                key={path}
                href={fullPath}
                onClick={(event) => handleClientSideLinkNavigation(event, navigate, fullPath)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-background text-foreground' : 'text-foreground hover:bg-background/50'}`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      {isFullViewGridRoute ? (
        <main className={`flex w-full flex-1 min-h-0 flex-col pt-0 md:pt-6 ${FULL_VIEW_PAGE_BOTTOM_PADDING_CLASS}`}>
          <div className="flex-1 min-h-0">
            <ExerciseDefinitionsView
              userId={userId}
              definitions={definitions}
              onAddDefinition={addDefinition}
              onUpdateDefinition={updateDefinition}
              onRemoveDefinition={removeDefinition}
              fullView
            />
          </div>
        </main>
      ) : (
        <main className={`mx-auto max-w-5xl space-y-4 px-4 pt-4 md:pt-6 ${CARD_PAGE_BOTTOM_PADDING_CLASS}`}>
          {isRoutinesRoute ? (
            <ExerciseRoutinesView
              definitions={definitions}
              routines={routines}
              onAddDefinition={addDefinition}
              onUpdateDefinition={updateDefinition}
              onRemoveDefinition={removeDefinition}
              onAddRoutine={addRoutine}
              onUpdateRoutine={updateRoutine}
              onRemoveRoutine={removeRoutine}
            />
          ) : null}
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
