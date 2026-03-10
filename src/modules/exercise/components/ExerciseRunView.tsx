import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import { ExerciseDefinitionDialog } from '@/modules/exercise/components/ExerciseDefinitionDialog';
import {
  formatDurationMs,
  formatDurationSeconds,
  formatExerciseWeight,
  summarizeExerciseDefinition,
} from '@/modules/exercise/lib/exercise';
import { useCountdownTimer } from '@/modules/exercise/hooks/useCountdownTimer';
import { useExerciseAlert } from '@/modules/exercise/hooks/useExerciseAlert';
import { useScreenWakeLock } from '@/modules/exercise/hooks/useScreenWakeLock';
import type { ExerciseDefinition, ExerciseDefinitionInput, ExerciseRoutineWithItems } from '@/modules/exercise/types/exercise';

interface ActiveRun {
  routineId: string;
  index: number;
}

interface ExerciseRunViewProps {
  basePath: string;
  definitions: ExerciseDefinition[];
  routines: ExerciseRoutineWithItems[];
  onUpdateDefinition: (id: string, input: ExerciseDefinitionInput) => Promise<void>;
}

export function ExerciseRunView({
  basePath,
  definitions,
  routines,
  onUpdateDefinition,
}: ExerciseRunViewProps) {
  const navigate = useNavigate();
  const definitionsById = useMemo(
    () => new Map(definitions.map((definition) => [definition.id, definition])),
    [definitions],
  );
  const runnableRoutines = useMemo(
    () => routines.filter((routine) => routine.items.length > 0),
    [routines],
  );
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [editingDefinition, setEditingDefinition] = useState<ExerciseDefinition | null>(null);
  const [definitionDialogOpen, setDefinitionDialogOpen] = useState(false);
  const [savingDefinition, setSavingDefinition] = useState(false);
  const { playAlert, primeAlert } = useExerciseAlert();

  useScreenWakeLock(activeRun != null);

  useEffect(() => {
    if (!activeRun) return;
    const nextRoutine = runnableRoutines.find((routine) => routine.id === activeRun.routineId);
    if (!nextRoutine) {
      setActiveRun(null);
      return;
    }
    if (activeRun.index >= nextRoutine.items.length) {
      setActiveRun({ routineId: nextRoutine.id, index: Math.max(0, nextRoutine.items.length - 1) });
    }
  }, [activeRun, runnableRoutines]);

  const activeRoutine = activeRun
    ? runnableRoutines.find((routine) => routine.id === activeRun.routineId) ?? null
    : null;
  const currentItem = activeRoutine?.items[activeRun?.index ?? 0] ?? null;
  const currentDefinition = currentItem ? definitionsById.get(currentItem.exercise_definition_id) ?? null : null;

  const handleTimerComplete = useCallback(() => {
    void playAlert();
  }, [playAlert]);

  const {
    isRunning,
    remainingMs,
    pause,
    reset,
    start,
  } = useCountdownTimer(currentDefinition?.duration_seconds ?? null, handleTimerComplete);

  useEffect(() => {
    reset();
  }, [activeRun?.index, activeRun?.routineId, currentDefinition?.id, reset]);

  const handleStartRun = async (routine: ExerciseRoutineWithItems) => {
    setActiveRun({ routineId: routine.id, index: 0 });
    await primeAlert();
  };

  const handleTimerStart = async () => {
    await primeAlert();
    start();
  };

  const handleSaveDefinition = async (input: ExerciseDefinitionInput) => {
    if (!editingDefinition) return;
    setSavingDefinition(true);
    try {
      await onUpdateDefinition(editingDefinition.id, input);
      setDefinitionDialogOpen(false);
      setEditingDefinition(null);
    } finally {
      setSavingDefinition(false);
    }
  };

  const currentSummary = currentDefinition ? summarizeExerciseDefinition(currentDefinition) : [];
  const currentWeight = currentDefinition ? formatExerciseWeight(currentDefinition) : null;

  if (!activeRun) {
    if (runnableRoutines.length === 0) {
      return (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">No runnable routines yet.</p>
            <div className="flex flex-wrap justify-center gap-2">
                <Button asChild type="button">
                  <a
                    href={`${basePath}/routines`}
                    onClick={(event) => handleClientSideLinkNavigation(event, navigate, `${basePath}/routines`)}
                  >
                  Go to Routines
                </a>
              </Button>
              <Button asChild type="button" variant="outline">
                <a
                  href={`${basePath}/exercises`}
                  onClick={(event) => handleClientSideLinkNavigation(event, navigate, `${basePath}/exercises`)}
                >
                  Go to Exercises
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Run</CardTitle>
            <CardDescription>Choose a routine to start a live run. This does not save workout history in v1.</CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {runnableRoutines.map((routine) => (
            <Card key={routine.id}>
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg">{routine.name}</CardTitle>
                <CardDescription>{routine.items.length} exercise{routine.items.length === 1 ? '' : 's'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {routine.items.map((item, index) => {
                    const definition = definitionsById.get(item.exercise_definition_id);
                    if (!definition) return null;
                    return (
                      <Badge key={`${routine.id}-${item.id}`} variant="outline">
                        {index + 1}. {definition.name}
                      </Badge>
                    );
                  })}
                </div>
                <Button type="button" onClick={() => { void handleStartRun(routine); }}>
                  Start Run
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl">{activeRoutine?.name ?? 'Run'}</CardTitle>
          <CardDescription>
            Exercise {(activeRun.index + 1)} of {activeRoutine?.items.length ?? 0}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{currentDefinition?.name ?? 'Exercise Unavailable'}</CardTitle>
              <CardDescription>
                {currentSummary.length > 0 ? 'Current targets' : 'No reps, timer, or weight defaults set'}
              </CardDescription>
            </div>
            {currentDefinition ? (
              <Button
                type="button"
                variant="outline"
                aria-label={`Edit ${currentDefinition.name}`}
                onClick={() => {
                  setEditingDefinition(currentDefinition);
                  setDefinitionDialogOpen(true);
                }}
              >
                Edit Exercise
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentDefinition ? (
            <div className="flex flex-wrap gap-2">
              {currentDefinition.rep_count != null ? <Badge variant="outline">{currentDefinition.rep_count} reps</Badge> : null}
              {currentDefinition.duration_seconds != null ? (
                <Badge variant="outline">{formatDurationSeconds(currentDefinition.duration_seconds)}</Badge>
              ) : null}
              {currentWeight ? <Badge variant="outline">{currentWeight}</Badge> : null}
              {currentSummary.length === 0 ? <p className="text-sm text-muted-foreground">Name only</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">This exercise is no longer available. Exit the run or move to another step.</p>
          )}

          {currentDefinition?.duration_seconds != null ? (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Timer</h3>
                <p className="mt-1 text-5xl font-semibold tabular-nums">{formatDurationMs(remainingMs)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => { void handleTimerStart(); }} disabled={isRunning}>
                  Start Timer
                </Button>
                <Button type="button" variant="outline" onClick={pause} disabled={!isRunning}>
                  Pause
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  Reset
                </Button>
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveRun((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current)}
                disabled={activeRun.index === 0}
              >
                Previous
              </Button>
              <Button
                type="button"
                onClick={() => setActiveRun((current) => {
                  if (!current || !activeRoutine) return current;
                  return { ...current, index: Math.min(activeRoutine.items.length - 1, current.index + 1) };
                })}
                disabled={!activeRoutine || activeRun.index >= activeRoutine.items.length - 1}
              >
                Next
              </Button>
            </div>
            <Button type="button" variant="outline-destructive" onClick={() => setActiveRun(null)}>
              Finish Run
            </Button>
          </div>
        </CardContent>
      </Card>

      <ExerciseDefinitionDialog
        open={definitionDialogOpen}
        onOpenChange={(open) => {
          setDefinitionDialogOpen(open);
          if (!open) {
            setEditingDefinition(null);
          }
        }}
        onSubmit={handleSaveDefinition}
        pending={savingDefinition}
        definition={editingDefinition}
        title="Edit Exercise"
      />
    </div>
  );
}
