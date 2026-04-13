import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, MoreHorizontal, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ExerciseDefinitionDialog } from '@/modules/exercise/components/ExerciseDefinitionDialog';
import { formatDistanceMiles, formatDurationMs, formatDurationSeconds, formatWeightLbs, moveRoutineExercise, summarizeExerciseDefinition } from '@/modules/exercise/lib/exercise';
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

interface ActiveDurationTimer {
  completed: boolean;
  durationSeconds: number;
  endsAtMs: number;
  exerciseName: string;
}

interface ExerciseDefinitionPickerOption {
  definition: ExerciseDefinition;
  summary: string;
}

const TIMER_COUNTDOWN_TICK_MS = 250;

interface ExerciseRoutinesViewProps {
  definitions: ExerciseDefinition[];
  routines: ExerciseRoutineWithItems[];
  onAddDefinition: (input: ExerciseDefinitionInput, id?: string) => Promise<void | ExerciseDefinition>;
  onUpdateDefinition: (id: string, input: ExerciseDefinitionInput) => Promise<void>;
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
  onAddRoutine,
  onUpdateRoutine,
  onRemoveRoutine,
}: ExerciseRoutinesViewProps) {
  const definitionsById = useMemo(
    () => new Map(definitions.map((definition) => [definition.id, definition])),
    [definitions],
  );
  const [draft, setDraft] = useState<RoutineDraft | null>(null);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [definitionDialogOpen, setDefinitionDialogOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<ExerciseDefinition | null>(null);
  const [definitionDialogInitialName, setDefinitionDialogInitialName] = useState('');
  const [appendCreatedDefinitionToDraft, setAppendCreatedDefinitionToDraft] = useState(false);
  const [savingDefinition, setSavingDefinition] = useState(false);
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
  const [activeTimer, setActiveTimer] = useState<ActiveDurationTimer | null>(null);
  const [timerNowMs, setTimerNowMs] = useState(() => Date.now());
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exercisePickerQuery, setExercisePickerQuery] = useState('');
  const [exercisePickerActiveIndex, setExercisePickerActiveIndex] = useState(0);
  const exercisePickerInputRef = useRef<HTMLInputElement | null>(null);
  const exercisePickerOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const definitionPickerOptions = useMemo<ExerciseDefinitionPickerOption[]>(() => (
    [...definitions]
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
      .map((definition) => ({
        definition,
        summary: summarizeExerciseDefinition(definition).join(' • ') || 'Name only',
      }))
  ), [definitions]);

  const filteredDefinitionPickerOptions = useMemo(() => {
    const normalizedQuery = exercisePickerQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return definitionPickerOptions;

    return definitionPickerOptions.filter(({ definition, summary }) => (
      definition.name.toLocaleLowerCase().includes(normalizedQuery)
      || summary.toLocaleLowerCase().includes(normalizedQuery)
    ));
  }, [definitionPickerOptions, exercisePickerQuery]);
  const trimmedExercisePickerQuery = exercisePickerQuery.trim();
  const showCreateDefinitionOption = trimmedExercisePickerQuery.length > 0 && filteredDefinitionPickerOptions.length === 0;
  const exercisePickerOptionCount = showCreateDefinitionOption ? 1 : filteredDefinitionPickerOptions.length;

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

  useEffect(() => {
    setExercisePickerActiveIndex((current) => {
      if (exercisePickerOptionCount === 0) return 0;
      return Math.min(current, exercisePickerOptionCount - 1);
    });
  }, [exercisePickerOptionCount]);

  useEffect(() => {
    if (!exercisePickerOpen || exercisePickerOptionCount === 0) return;
    const activeOption = exercisePickerOptionRefs.current[exercisePickerActiveIndex];
    if (!activeOption || typeof activeOption.scrollIntoView !== 'function') return;
    activeOption.scrollIntoView({ block: 'nearest' });
  }, [exercisePickerActiveIndex, exercisePickerOpen, exercisePickerOptionCount]);

  const sortedRoutines = useMemo(
    () => [...routines].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
    [routines],
  );
  const activeRoutine = sortedRoutines.find((routine) => routine.id === activeRoutineId) ?? sortedRoutines[0] ?? null;

  useEffect(() => {
    setActiveRoutineId((current) => (
      current && sortedRoutines.some((routine) => routine.id === current)
        ? current
        : sortedRoutines[0]?.id ?? null
    ));
  }, [sortedRoutines]);

  useEffect(() => {
    if (!activeTimer || activeTimer.completed) return undefined;

    if (activeTimer.endsAtMs <= Date.now()) {
      setActiveTimer((current) => current && !current.completed ? { ...current, completed: true } : current);
      return undefined;
    }

    setTimerNowMs(Date.now());
    const countdownIntervalId = window.setInterval(() => {
      setTimerNowMs(Date.now());
    }, TIMER_COUNTDOWN_TICK_MS);
    const completionTimeoutId = window.setTimeout(() => {
      setTimerNowMs(Date.now());
      setActiveTimer((current) => current && !current.completed ? { ...current, completed: true } : current);
    }, Math.max(0, activeTimer.endsAtMs - Date.now()));

    return () => {
      window.clearInterval(countdownIntervalId);
      window.clearTimeout(completionTimeoutId);
    };
  }, [activeTimer]);

  const resetExercisePicker = () => {
    setExercisePickerOpen(false);
    setExercisePickerQuery('');
    setExercisePickerActiveIndex(0);
  };

  const closeDraft = ({ scrollToTop = false }: { scrollToTop?: boolean } = {}) => {
    resetExercisePicker();
    setDraft(null);
    if (scrollToTop && typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  };

  const addExerciseToDraft = (definition: ExerciseDefinition) => {
    setDraft((current) => current ? {
      ...current,
      exerciseDefinitionIds: [...current.exerciseDefinitionIds, definition.id],
    } : current);
    resetExercisePicker();
    exercisePickerInputRef.current?.focus();
  };

  const openCreateDefinition = ({
    initialName = '',
    appendToDraft = false,
  }: {
    initialName?: string;
    appendToDraft?: boolean;
  } = {}) => {
    setExercisePickerOpen(false);
    setEditingDefinition(null);
    setDefinitionDialogInitialName(initialName);
    setAppendCreatedDefinitionToDraft(appendToDraft);
    setDefinitionDialogOpen(true);
  };

  const handleExercisePickerFocus = () => {
    if (definitionPickerOptions.length === 0 && !showCreateDefinitionOption) return;
    setExercisePickerOpen(true);
    setExercisePickerActiveIndex(0);
  };

  const handleExercisePickerChange = (value: string) => {
    setExercisePickerQuery(value);
    setExercisePickerOpen(true);
    setExercisePickerActiveIndex(0);
  };

  const handleExercisePickerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setExercisePickerOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setExercisePickerOpen(true);
      setExercisePickerActiveIndex((current) => (
        exercisePickerOptionCount === 0
          ? 0
          : exercisePickerOpen
            ? Math.min(current + 1, exercisePickerOptionCount - 1)
            : 0
      ));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setExercisePickerOpen(true);
      setExercisePickerActiveIndex((current) => (
        exercisePickerOptionCount === 0
          ? 0
          : exercisePickerOpen
            ? Math.max(current - 1, 0)
            : 0
      ));
      return;
    }

    if (event.key !== 'Enter' || !exercisePickerOpen) return;

    event.preventDefault();
    if (showCreateDefinitionOption) {
      openCreateDefinition({
        initialName: trimmedExercisePickerQuery,
        appendToDraft: true,
      });
      return;
    }

    const selectedOption = filteredDefinitionPickerOptions[exercisePickerActiveIndex];
    if (!selectedOption) return;
    addExerciseToDraft(selectedOption.definition);
  };

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
      closeDraft();
    } finally {
      setSavingRoutine(false);
    }
  };

  const handleDeleteRoutine = async (routine: ExerciseRoutineWithItems) => {
    if (!window.confirm(`Delete routine "${routine.name}"?`)) return;
    await onRemoveRoutine(routine.id);
    setDraft((current) => current?.id === routine.id ? null : current);
  };

  const handleSaveDefinition = async (input: ExerciseDefinitionInput) => {
    setSavingDefinition(true);
    try {
      if (editingDefinition) {
        await onUpdateDefinition(editingDefinition.id, input);
      } else {
        const createdDefinition = await onAddDefinition(input);
        if (appendCreatedDefinitionToDraft && createdDefinition) {
          addExerciseToDraft(createdDefinition);
        }
      }
      setDefinitionDialogOpen(false);
      setEditingDefinition(null);
      setDefinitionDialogInitialName('');
      setAppendCreatedDefinitionToDraft(false);
    } finally {
      setSavingDefinition(false);
    }
  };

  const dismissTimer = () => {
    setActiveTimer(null);
  };

  const startDurationTimer = (definition: ExerciseDefinition) => {
    if (definition.duration_seconds == null) return;

    const nowMs = Date.now();
    setTimerNowMs(nowMs);
    setActiveTimer({
      completed: false,
      durationSeconds: definition.duration_seconds,
      endsAtMs: nowMs + (definition.duration_seconds * 1000),
      exerciseName: definition.name,
    });
  };

  const activeTimerRemainingMs = activeTimer
    ? activeTimer.completed
      ? 0
      : Math.max(0, activeTimer.endsAtMs - timerNowMs)
    : 0;

  return (
    <div className="space-y-4">
      {draft ? (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">{draft.id ? 'Edit Routine' : 'New Routine'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="exercise-routine-name" className="text-sm font-medium">Name</label>
              <Input
                id="exercise-routine-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)}
                placeholder="Morning routine"
              />
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">Order</h3>
                <p className="text-sm text-muted-foreground">{draft.exerciseDefinitionIds.length} exercise{draft.exerciseDefinitionIds.length === 1 ? '' : 's'}</p>
              </div>

              {draft.exerciseDefinitionIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Use Type to Find to add exercises.</p>
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
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Move ${definition.name} up`}
                            onClick={() => setDraft((current) => current ? {
                              ...current,
                              exerciseDefinitionIds: moveRoutineExercise(current.exerciseDefinitionIds, index, -1),
                            } : current)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Move ${definition.name} down`}
                            onClick={() => setDraft((current) => current ? {
                              ...current,
                              exerciseDefinitionIds: moveRoutineExercise(current.exerciseDefinitionIds, index, 1),
                            } : current)}
                            disabled={index === draft.exerciseDefinitionIds.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline-destructive"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Remove ${definition.name} from routine`}
                            onClick={() => setDraft((current) => current ? {
                              ...current,
                              exerciseDefinitionIds: current.exerciseDefinitionIds.filter((_, candidateIndex) => candidateIndex !== index),
                            } : current)}
                          >
                            <Trash2 className="h-4 w-4" />
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
                <h3 className="text-sm font-medium">Exercise Library</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => openCreateDefinition()}>New Exercise</Button>
              </div>

              <div className="max-w-xl space-y-2">
                <label htmlFor="exercise-routine-definition-search" className="text-sm font-medium">Type to Find</label>
                <Popover open={exercisePickerOpen} onOpenChange={setExercisePickerOpen}>
                  <PopoverPrimitive.Anchor asChild>
                    <div>
                      <Input
                        id="exercise-routine-definition-search"
                        ref={exercisePickerInputRef}
                        role="combobox"
                        aria-autocomplete="list"
                        aria-controls="exercise-routine-definition-options"
                        aria-expanded={exercisePickerOpen}
                        aria-activedescendant={
                          exercisePickerOpen
                            ? showCreateDefinitionOption
                              ? 'exercise-routine-definition-option-create'
                              : filteredDefinitionPickerOptions.length > 0
                                ? `exercise-routine-definition-option-${filteredDefinitionPickerOptions[exercisePickerActiveIndex]?.definition.id}`
                                : undefined
                            : undefined
                        }
                        value={exercisePickerQuery}
                        placeholder="Type to find an exercise"
                        autoComplete="off"
                        onFocus={handleExercisePickerFocus}
                        onChange={(event) => handleExercisePickerChange(event.target.value)}
                        onKeyDown={handleExercisePickerKeyDown}
                      />
                    </div>
                  </PopoverPrimitive.Anchor>
                  <PopoverContent
                    align="start"
                    className="w-[min(32rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-0 shadow-none"
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    onCloseAutoFocus={(event) => event.preventDefault()}
                  >
                    <div
                      id="exercise-routine-definition-options"
                      role="listbox"
                      className="max-h-72 overflow-y-auto p-1"
                    >
                      {showCreateDefinitionOption ? (
                        <button
                          id="exercise-routine-definition-option-create"
                          ref={(node) => {
                            exercisePickerOptionRefs.current[0] = node;
                          }}
                          type="button"
                          role="option"
                          aria-selected={exercisePickerActiveIndex === 0}
                          className={`flex w-full items-start rounded-md px-3 py-2 text-left ${exercisePickerActiveIndex === 0 ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                          onMouseEnter={() => setExercisePickerActiveIndex(0)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => openCreateDefinition({
                            initialName: trimmedExercisePickerQuery,
                            appendToDraft: true,
                          })}
                        >
                          <span className="font-medium">Add New Exercise</span>
                        </button>
                      ) : filteredDefinitionPickerOptions.length > 0 ? (
                        filteredDefinitionPickerOptions.map((option, index) => {
                          const active = index === exercisePickerActiveIndex;
                          return (
                            <button
                              key={option.definition.id}
                              id={`exercise-routine-definition-option-${option.definition.id}`}
                              ref={(node) => {
                                exercisePickerOptionRefs.current[index] = node;
                              }}
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={`flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left ${active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                              onMouseEnter={() => setExercisePickerActiveIndex(index)}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => addExerciseToDraft(option.definition)}
                            >
                              <span className="font-medium">{option.definition.name}</span>
                              <span className={`text-sm ${active ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>
                                {option.summary}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <p className="px-3 py-6 text-sm text-muted-foreground">No exercises yet. Start typing to add one.</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => closeDraft({ scrollToTop: true })} disabled={savingRoutine}>
                Cancel
              </Button>
              <Button type="button" onClick={() => { void handleSaveRoutine(); }} disabled={savingRoutine}>
                {savingRoutine ? 'Saving...' : 'Save Routine'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {draft ? null : (
        <section className="mx-auto w-[calc(100vw-2rem)] min-w-0 max-w-2xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Select value={activeRoutine?.id ?? ''} onValueChange={setActiveRoutineId} disabled={sortedRoutines.length === 0}>
                <SelectTrigger aria-label="Current routine" className="h-10 w-full max-w-sm">
                  <SelectValue placeholder="No routines" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRoutines.map((routine) => (
                    <SelectItem key={routine.id} value={routine.id}>
                      {routine.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="shrink-0">
              <Button type="button" onClick={() => setDraft(createRoutineDraft())}>
                <Plus className="h-4 w-4" />
                Add Routine
              </Button>
            </div>
          </div>

          <div
            data-testid="exercise-routine-card-viewport"
            className="w-full max-w-full min-w-0"
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for routine ${activeRoutine.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem
                            aria-label={`Edit Routine ${activeRoutine.name}`}
                            onSelect={() => setDraft(createRoutineDraft(activeRoutine))}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            aria-label={`Delete routine ${activeRoutine.name}`}
                            className="text-destructive focus:text-destructive"
                            onSelect={() => { void handleDeleteRoutine(activeRoutine); }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                                definition.distance_miles != null ? {
                                  id: 'distance',
                                  value: <p>Distance: {formatDistanceMiles(definition.distance_miles)} mi</p>,
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
            ) : (
              <Card className="h-full w-full max-w-full overflow-hidden">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-lg">No Routines Yet</CardTitle>
                  <CardDescription>Create your first routine from the header action.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Build an ordered routine, then switch between your saved routines here.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      <ExerciseDefinitionDialog
        open={definitionDialogOpen}
        onOpenChange={(open) => {
          setDefinitionDialogOpen(open);
          if (!open) {
            setEditingDefinition(null);
            setDefinitionDialogInitialName('');
            setAppendCreatedDefinitionToDraft(false);
          }
        }}
        onSubmit={handleSaveDefinition}
        pending={savingDefinition}
        definition={editingDefinition}
        initialName={definitionDialogInitialName}
        title={editingDefinition ? 'Edit Exercise' : 'Add Exercise'}
      />

      <Dialog open={activeTimer != null} onOpenChange={(open) => { if (!open) dismissTimer(); }}>
        <DialogContent hideClose className="max-w-sm gap-5 shadow-none">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle>{activeTimer?.exerciseName ?? 'Exercise Timer'}</DialogTitle>
            <DialogDescription>
              {`${activeTimer ? formatDurationSeconds(activeTimer.durationSeconds) : '00:00'} timer`}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-[hsl(var(--grid-sticky-line))] px-4 py-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">{activeTimer?.completed ? 'Complete' : 'Remaining'}</p>
            <p className="mt-2 text-5xl font-semibold tabular-nums" role="timer" aria-live="off">
              {formatDurationMs(activeTimerRemainingMs)}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" onClick={dismissTimer}>
              {activeTimer?.completed ? 'Dismiss' : 'Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
