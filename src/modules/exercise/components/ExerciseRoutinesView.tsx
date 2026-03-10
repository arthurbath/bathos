import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { ExerciseDefinitionDialog } from '@/modules/exercise/components/ExerciseDefinitionDialog';
import { moveRoutineExercise, summarizeExerciseDefinition } from '@/modules/exercise/lib/exercise';
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
  const [draft, setDraft] = useState<RoutineDraft | null>(null);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [definitionDialogOpen, setDefinitionDialogOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<ExerciseDefinition | null>(null);
  const [savingDefinition, setSavingDefinition] = useState(false);

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Routines</CardTitle>
            <CardDescription>Build ordered lists of exercises and keep editing them without leaving the draft.</CardDescription>
          </div>
          <Button type="button" onClick={() => setDraft(createRoutineDraft())}>
            <Plus className="h-4 w-4" />
            Add Routine
          </Button>
        </CardHeader>
      </Card>

      {draft ? (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">{draft.id ? 'Edit Routine' : 'New Routine'}</CardTitle>
            <CardDescription>Empty routines can be saved, but only routines with exercises are runnable.</CardDescription>
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
                <Badge variant="outline">{draft.exerciseDefinitionIds.length} exercise{draft.exerciseDefinitionIds.length === 1 ? '' : 's'}</Badge>
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

      {routines.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {routines.map((routine) => (
            <Card key={routine.id}>
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{routine.name}</CardTitle>
                    <CardDescription>
                      {routine.items.length > 0
                        ? `${routine.items.length} exercise${routine.items.length === 1 ? '' : 's'}`
                        : 'No exercises in this routine yet'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Edit Routine ${routine.name}`}
                      onClick={() => setDraft(createRoutineDraft(routine))}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline-destructive"
                      size="sm"
                      aria-label={`Delete routine ${routine.name}`}
                      onClick={() => { void handleDeleteRoutine(routine); }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {routine.items.length > 0 ? routine.items.map((item, index) => {
                  const definition = definitionsById.get(item.exercise_definition_id);
                  if (!definition) return null;
                  return (
                    <Badge key={`${item.id}-${index}`} variant="outline">
                      {index + 1}. {definition.name}
                    </Badge>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground">This routine can be edited, but it will not appear in Run until it has at least one exercise.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

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
    </div>
  );
}
