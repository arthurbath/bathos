import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { ExerciseDefinitionDialog } from '@/modules/exercise/components/ExerciseDefinitionDialog';
import { formatDurationMs, formatDurationSeconds, formatWeightLbs, moveRoutineExercise, summarizeExerciseDefinition } from '@/modules/exercise/lib/exercise';
import type {
  ExerciseDefinition,
  ExerciseDefinitionInput,
  ExerciseRoutineInput,
  ExerciseRoutineWithItems,
} from '@/modules/exercise/types/exercise';

interface RoutineDraft {
  id: string | null;
  name: string;
  exerciseDefinitionIds: string[];
}

type AudioSessionType = 'ambient' | 'auto' | 'play-and-record' | 'playback' | 'transient' | 'transient-solo';

interface AudioSessionHandle {
  type: AudioSessionType;
}

interface AlarmAudioController {
  alarmIntervalId: number | null;
  audioContext: AudioContext | null;
  previousSessionType: AudioSessionType | null;
  requestId: number;
  warmedUp: boolean;
}

interface ActiveDurationTimer {
  alarmActive: boolean;
  durationSeconds: number;
  endsAtMs: number;
  exerciseName: string;
}

const TIMER_COUNTDOWN_TICK_MS = 250;
const TIMER_ALARM_REPEAT_MS = 1250;
const TIMER_AUDIO_SESSION_PREFERENCES: AudioSessionType[] = ['transient-solo', 'playback'];

function getAudioContextConstructor(): (new () => AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const audioWindow = window as Window & typeof globalThis & {
    webkitAudioContext?: new () => AudioContext;
  };
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

function getNavigatorAudioSession(): AudioSessionHandle | null {
  if (typeof navigator === 'undefined') return null;
  const audioNavigator = navigator as Navigator & {
    audioSession?: AudioSessionHandle;
  };
  return audioNavigator.audioSession ?? null;
}

function warmUpAlarmAudioContext(context: AudioContext) {
  const startAt = context.currentTime + 0.01;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, startAt);
  gain.gain.setValueAtTime(0.00001, startAt);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.02);
  window.setTimeout(() => gain.disconnect(), 120);
}

function scheduleAlarmBeep(context: AudioContext, frequency: number, startAt: number, durationSeconds: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSeconds);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + durationSeconds);
  window.setTimeout(() => gain.disconnect(), Math.ceil((durationSeconds + 0.1) * 1000));
}

function playAlarmPattern(context: AudioContext) {
  const startAt = context.currentTime + 0.01;
  scheduleAlarmBeep(context, 1120, startAt, 0.18);
  scheduleAlarmBeep(context, 860, startAt + 0.28, 0.18);
}

async function ensureAlarmAudioReady(controller: AlarmAudioController): Promise<AudioContext | null> {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) return null;

  if (!controller.audioContext || controller.audioContext.state === 'closed') {
    controller.audioContext = new AudioContextConstructor();
    controller.warmedUp = false;
  }

  const context = controller.audioContext;
  if (context.state === 'suspended') {
    await context.resume();
  }

  if (!controller.warmedUp) {
    warmUpAlarmAudioContext(context);
    controller.warmedUp = true;
  }

  return context;
}

function activateAlarmAudioSession(controller: AlarmAudioController) {
  const audioSession = getNavigatorAudioSession();
  if (!audioSession) return;

  if (controller.previousSessionType == null) {
    controller.previousSessionType = audioSession.type ?? 'auto';
  }

  for (const sessionType of TIMER_AUDIO_SESSION_PREFERENCES) {
    try {
      audioSession.type = sessionType;
      return;
    } catch {
      continue;
    }
  }
}

function restoreAlarmAudioSession(controller: AlarmAudioController) {
  const audioSession = getNavigatorAudioSession();
  const previousSessionType = controller.previousSessionType;
  controller.previousSessionType = null;

  if (!audioSession || previousSessionType == null) return;

  try {
    audioSession.type = previousSessionType;
  } catch {
    // Ignore restore failures. Unsupported browsers simply stay on their default session policy.
  }
}

function suspendAlarmAudioContext(controller: AlarmAudioController) {
  const context = controller.audioContext;
  if (!context || context.state !== 'running') return;
  void context.suspend().catch(() => undefined);
}

function stopAlarmLoop(controller: AlarmAudioController) {
  controller.requestId += 1;

  if (controller.alarmIntervalId != null) {
    window.clearInterval(controller.alarmIntervalId);
    controller.alarmIntervalId = null;
  }

  restoreAlarmAudioSession(controller);
  suspendAlarmAudioContext(controller);
}

async function startAlarmLoop(controller: AlarmAudioController) {
  stopAlarmLoop(controller);
  const requestId = controller.requestId;

  const context = await ensureAlarmAudioReady(controller);
  if (!context || controller.requestId !== requestId) return;

  activateAlarmAudioSession(controller);
  playAlarmPattern(context);

  controller.alarmIntervalId = window.setInterval(() => {
    void ensureAlarmAudioReady(controller).then((readyContext) => {
      if (!readyContext || controller.requestId !== requestId) return;
      playAlarmPattern(readyContext);
    });
  }, TIMER_ALARM_REPEAT_MS);
}

function disposeAlarmAudio(controller: AlarmAudioController) {
  stopAlarmLoop(controller);

  if (!controller.audioContext || controller.audioContext.state === 'closed') return;
  void controller.audioContext.close().catch(() => undefined);
  controller.audioContext = null;
  controller.warmedUp = false;
}

interface ExerciseRoutinesViewProps {
  definitions: ExerciseDefinition[];
  routines: ExerciseRoutineWithItems[];
  onAddDefinition: (input: ExerciseDefinitionInput, id?: string) => Promise<void>;
  onUpdateDefinition: (id: string, input: ExerciseDefinitionInput) => Promise<void>;
  onRemoveDefinition: (id: string) => Promise<void>;
  onAddRoutine: (input: ExerciseRoutineInput) => Promise<void>;
  onUpdateRoutine: (id: string, input: ExerciseRoutineInput) => Promise<void>;
  onRemoveRoutine: (id: string) => Promise<void>;
}

function createRoutineDraft(routine?: ExerciseRoutineWithItems | null): RoutineDraft {
  return {
    id: routine?.id ?? null,
    name: routine?.name ?? '',
    exerciseDefinitionIds: routine?.items.map((item) => item.exercise_definition_id) ?? [],
  };
}

export function ExerciseRoutinesView({
  definitions,
  routines,
  onAddDefinition,
  onUpdateDefinition,
  onRemoveDefinition,
  onAddRoutine,
  onUpdateRoutine,
  onRemoveRoutine,
}: ExerciseRoutinesViewProps) {
  const definitionsById = useMemo(
    () => new Map(definitions.map((definition) => [definition.id, definition])),
    [definitions],
  );
  const touchStartXRef = useRef<number | null>(null);
  const [draft, setDraft] = useState<RoutineDraft | null>(null);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [definitionDialogOpen, setDefinitionDialogOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<ExerciseDefinition | null>(null);
  const [savingDefinition, setSavingDefinition] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const alarmAudioRef = useRef<AlarmAudioController>({
    alarmIntervalId: null,
    audioContext: null,
    previousSessionType: null,
    requestId: 0,
    warmedUp: false,
  });
  const [activeTimer, setActiveTimer] = useState<ActiveDurationTimer | null>(null);
  const [timerNowMs, setTimerNowMs] = useState(() => Date.now());

  useEffect(() => {
    setDraft((current) => {
      if (!current) return current;
      const nextExerciseDefinitionIds = current.exerciseDefinitionIds.filter((id) => definitionsById.has(id));
      if (nextExerciseDefinitionIds.length === current.exerciseDefinitionIds.length) {
        return current;
      }
      return { ...current, exerciseDefinitionIds: nextExerciseDefinitionIds };
    });
  }, [definitionsById]);

  const slideCount = routines.length + 1;
  const activeRoutine = activeCardIndex < routines.length ? routines[activeCardIndex] ?? null : null;
  const showingAddRoutineCard = activeCardIndex === routines.length;

  useEffect(() => {
    setActiveCardIndex((current) => Math.min(current, slideCount - 1));
  }, [slideCount]);

  useEffect(() => {
    if (!activeTimer || activeTimer.alarmActive) return undefined;

    if (activeTimer.endsAtMs <= Date.now()) {
      setActiveTimer((current) => current && !current.alarmActive ? { ...current, alarmActive: true } : current);
      return undefined;
    }

    setTimerNowMs(Date.now());
    const countdownIntervalId = window.setInterval(() => {
      setTimerNowMs(Date.now());
    }, TIMER_COUNTDOWN_TICK_MS);
    const alarmTimeoutId = window.setTimeout(() => {
      setTimerNowMs(Date.now());
      setActiveTimer((current) => current && !current.alarmActive ? { ...current, alarmActive: true } : current);
    }, Math.max(0, activeTimer.endsAtMs - Date.now()));

    return () => {
      window.clearInterval(countdownIntervalId);
      window.clearTimeout(alarmTimeoutId);
    };
  }, [activeTimer]);

  useEffect(() => {
    const alarmAudio = alarmAudioRef.current;
    if (!activeTimer?.alarmActive) return undefined;

    void startAlarmLoop(alarmAudio);
    return () => {
      stopAlarmLoop(alarmAudio);
    };
  }, [activeTimer?.alarmActive]);

  useEffect(() => {
    const alarmAudio = alarmAudioRef.current;
    return () => {
      disposeAlarmAudio(alarmAudio);
    };
  }, []);

  const handleSaveRoutine = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      toast({
        title: 'Routine Name Required',
        variant: 'destructive',
      });
      return;
    }

    setSavingRoutine(true);
    try {
      const input: ExerciseRoutineInput = {
        name,
        exercise_definition_ids: draft.exerciseDefinitionIds,
      };

      if (draft.id) {
        await onUpdateRoutine(draft.id, input);
      } else {
        await onAddRoutine(input);
      }
      setDraft(null);
    } finally {
      setSavingRoutine(false);
    }
  };

  const handleDeleteRoutine = async (routine: ExerciseRoutineWithItems) => {
    if (!window.confirm(`Delete routine "${routine.name}"?`)) return;
    await onRemoveRoutine(routine.id);
    setDraft((current) => current?.id === routine.id ? null : current);
  };

  const handleDeleteDefinition = async (definition: ExerciseDefinition) => {
    if (!window.confirm(`Delete exercise "${definition.name}"? It will be removed from every routine.`)) return;
    await onRemoveDefinition(definition.id);
    setDraft((current) => current ? {
      ...current,
      exerciseDefinitionIds: current.exerciseDefinitionIds.filter((id) => id !== definition.id),
    } : current);
  };

  const handleSaveDefinition = async (input: ExerciseDefinitionInput) => {
    setSavingDefinition(true);
    try {
      if (editingDefinition) {
        await onUpdateDefinition(editingDefinition.id, input);
      } else {
        await onAddDefinition(input);
      }
      setDefinitionDialogOpen(false);
      setEditingDefinition(null);
    } finally {
      setSavingDefinition(false);
    }
  };

  const openCreateDefinition = () => {
    setEditingDefinition(null);
    setDefinitionDialogOpen(true);
  };

  const openEditDefinition = (definition: ExerciseDefinition) => {
    setEditingDefinition(definition);
    setDefinitionDialogOpen(true);
  };

  const goToPreviousCard = () => {
    if (slideCount <= 1) return;
    setActiveCardIndex((current) => current === 0 ? slideCount - 1 : current - 1);
  };

  const goToNextCard = () => {
    if (slideCount <= 1) return;
    setActiveCardIndex((current) => current === slideCount - 1 ? 0 : current + 1);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const touchStartX = touchStartXRef.current;
    const touchEndX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    if (touchStartX == null || touchEndX == null) return;

    const deltaX = touchEndX - touchStartX;
    if (Math.abs(deltaX) < 40) return;
    if (deltaX < 0) {
      goToNextCard();
      return;
    }
    goToPreviousCard();
  };

  const dismissTimer = () => {
    stopAlarmLoop(alarmAudioRef.current);
    setActiveTimer(null);
  };

  const startDurationTimer = (definition: ExerciseDefinition) => {
    if (definition.duration_seconds == null) return;

    stopAlarmLoop(alarmAudioRef.current);
    const nowMs = Date.now();
    setTimerNowMs(nowMs);
    setActiveTimer({
      alarmActive: false,
      durationSeconds: definition.duration_seconds,
      endsAtMs: nowMs + (definition.duration_seconds * 1000),
      exerciseName: definition.name,
    });

    void ensureAlarmAudioReady(alarmAudioRef.current);
  };

  const activeTimerRemainingMs = activeTimer
    ? activeTimer.alarmActive
      ? 0
      : Math.max(0, activeTimer.endsAtMs - timerNowMs)
    : 0;

  return (
    <div className="space-y-4">
      {draft ? (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">{draft.id ? 'Edit Routine' : 'New Routine'}</CardTitle>
            <CardDescription>Save empty routines now and fill in the exercise order later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="exercise-routine-name" className="text-sm font-medium">Routine Name</label>
              <Input
                id="exercise-routine-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)}
                placeholder="Morning routine"
              />
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">Routine Order</h3>
                <p className="text-sm text-muted-foreground">{draft.exerciseDefinitionIds.length} exercise{draft.exerciseDefinitionIds.length === 1 ? '' : 's'}</p>
              </div>

              {draft.exerciseDefinitionIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add exercises from the library below.</p>
              ) : (
                <div className="space-y-2">
                  {draft.exerciseDefinitionIds.map((exerciseDefinitionId, index) => {
                    const definition = definitionsById.get(exerciseDefinitionId);
                    if (!definition) return null;
                    return (
                      <div key={`${exerciseDefinitionId}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--grid-sticky-line))] px-3 py-2">
                        <div className="min-w-0">
                          <p className="font-medium">{index + 1}. {definition.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {summarizeExerciseDefinition(definition).join(' • ') || 'Name only'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Move ${definition.name} up`}
                            onClick={() => setDraft((current) => current ? {
                              ...current,
                              exerciseDefinitionIds: moveRoutineExercise(current.exerciseDefinitionIds, index, -1),
                            } : current)}
                            disabled={index === 0}
                          >
                            Up
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Move ${definition.name} down`}
                            onClick={() => setDraft((current) => current ? {
                              ...current,
                              exerciseDefinitionIds: moveRoutineExercise(current.exerciseDefinitionIds, index, 1),
                            } : current)}
                            disabled={index === draft.exerciseDefinitionIds.length - 1}
                          >
                            Down
                          </Button>
                          <Button
                            type="button"
                            variant="outline-destructive"
                            size="sm"
                            aria-label={`Remove ${definition.name} from routine`}
                            onClick={() => setDraft((current) => current ? {
                              ...current,
                              exerciseDefinitionIds: current.exerciseDefinitionIds.filter((_, candidateIndex) => candidateIndex !== index),
                            } : current)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium">Exercise Library</h3>
                  <p className="text-sm text-muted-foreground">Create, update, delete, and add exercises to this routine without leaving the draft.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={openCreateDefinition}>New Exercise</Button>
              </div>

              {definitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No exercises yet. Create one to start building this routine.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {definitions.map((definition) => (
                    <Card key={definition.id}>
                      <CardHeader className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">{definition.name}</CardTitle>
                            <CardDescription>{summarizeExerciseDefinition(definition).join(' • ') || 'Name only'}</CardDescription>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            aria-label={`Add ${definition.name} to routine`}
                            onClick={() => setDraft((current) => current ? {
                              ...current,
                              exerciseDefinitionIds: [...current.exerciseDefinitionIds, definition.id],
                            } : current)}
                          >
                            Add
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Edit ${definition.name}`}
                          onClick={() => openEditDefinition(definition)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline-destructive"
                          size="sm"
                          aria-label={`Delete ${definition.name}`}
                          onClick={() => { void handleDeleteDefinition(definition); }}
                        >
                          Delete
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={savingRoutine}>
                Cancel
              </Button>
              <Button type="button" onClick={() => { void handleSaveRoutine(); }} disabled={savingRoutine}>
                {savingRoutine ? 'Saving...' : 'Save Routine'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="mx-auto w-[calc(100vw-2rem)] min-w-0 max-w-2xl space-y-3">
        <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label="Previous routine card"
              onClick={goToPreviousCard}
              disabled={slideCount <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label="Next routine card"
              onClick={goToNextCard}
              disabled={slideCount <= 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
        </div>

        <div
          data-testid="exercise-routine-card-viewport"
          className="w-full max-w-full min-w-0"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {activeRoutine ? (
            <Card className="w-full max-w-full overflow-hidden">
              <CardHeader className="space-y-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-lg">{activeRoutine.name}</CardTitle>
                    <CardDescription>
                      {activeRoutine.items.length > 0
                        ? `${activeRoutine.items.length} exercise${activeRoutine.items.length === 1 ? '' : 's'}`
                        : 'No exercises in this routine yet'}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Edit Routine ${activeRoutine.name}`}
                      onClick={() => setDraft(createRoutineDraft(activeRoutine))}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline-destructive"
                      size="sm"
                      aria-label={`Delete routine ${activeRoutine.name}`}
                      onClick={() => { void handleDeleteRoutine(activeRoutine); }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {activeRoutine.items.length > 0 ? (
                  <div className="space-y-3">
                    {activeRoutine.items.map((item, index) => {
                      const definition = definitionsById.get(item.exercise_definition_id);
                      if (!definition) {
                        return (
                          <div key={`${item.id}-${index}`} className="rounded-md border border-[hsl(var(--grid-sticky-line))] px-3 py-3">
                            <p className="font-medium">{index + 1}. Exercise Unavailable</p>
                            <p className="mt-1 text-sm text-muted-foreground">This exercise definition no longer exists.</p>
                          </div>
                        );
                      }

                      return (
                        <div key={`${item.id}-${index}`} className="rounded-md border border-[hsl(var(--grid-sticky-line))] px-3 py-3">
                          <p className="font-medium break-words">{index + 1}. {definition.name}</p>
                          {(() => {
                            const metadata = [
                              definition.rep_count != null ? {
                                id: 'reps',
                                value: <p>Reps: {definition.rep_count}</p>,
                              } : null,
                              definition.duration_seconds != null ? {
                                id: 'duration',
                                value: (
                                  <div className="flex items-center gap-2">
                                    <span>Duration: {formatDurationSeconds(definition.duration_seconds)}</span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      aria-label={`Start ${formatDurationSeconds(definition.duration_seconds)} timer for ${definition.name}`}
                                      onClick={() => startDurationTimer(definition)}
                                    >
                                      <Play className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ),
                              } : null,
                              definition.weight_lbs != null ? {
                                id: 'weight',
                                value: (
                                  <p>
                                    Weight: {formatWeightLbs(definition.weight_lbs)}
                                    {definition.weight_delta_lbs != null && definition.weight_delta_lbs !== 0 ? `+/-${formatWeightLbs(definition.weight_delta_lbs)}` : ''} lb
                                  </p>
                                ),
                              } : null,
                              definition.weight_lbs == null && definition.weight_delta_lbs != null && definition.weight_delta_lbs !== 0 ? {
                                id: 'range',
                                value: <p>Range: +/- {formatWeightLbs(definition.weight_delta_lbs)} lb</p>,
                              } : null,
                            ].filter((value): value is { id: string; value: ReactNode } => value != null);

                            return metadata.length > 0 ? (
                              <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                                {metadata.map((metadataItem) => (
                                  <div key={metadataItem.id}>{metadataItem.value}</div>
                                ))}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">This routine is empty. Add exercises to define the order.</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {showingAddRoutineCard ? (
            <Card className="h-full w-full max-w-full overflow-hidden">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg">Add Routine</CardTitle>
                <CardDescription>Create a new routine from the last card in the stack.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Build a new ordered routine, then page back to review it.</p>
                <Button type="button" onClick={() => setDraft(createRoutineDraft())}>
                  <Plus className="h-4 w-4" />
                  Add Routine
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

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
        title={editingDefinition ? 'Edit Exercise' : 'Add Exercise'}
      />

      <Dialog open={activeTimer != null} onOpenChange={(open) => { if (!open) dismissTimer(); }}>
        <DialogContent hideClose className="max-w-sm gap-5 shadow-none">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle>{activeTimer?.exerciseName ?? 'Exercise Timer'}</DialogTitle>
            <DialogDescription>
              {activeTimer?.alarmActive
                ? 'Time elapsed. The alarm will continue until you dismiss it.'
                : `Running ${activeTimer ? formatDurationSeconds(activeTimer.durationSeconds) : '00:00'} timer.`}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-[hsl(var(--grid-sticky-line))] px-4 py-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">Remaining</p>
            <p className="mt-2 text-5xl font-semibold tabular-nums" role="timer" aria-live="off">
              {formatDurationMs(activeTimerRemainingMs)}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" onClick={dismissTimer}>
              {activeTimer?.alarmActive ? 'Dismiss Timer' : 'Cancel Timer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
