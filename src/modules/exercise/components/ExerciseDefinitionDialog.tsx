import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { createExerciseDefinitionFormState, normalizeExerciseDefinitionFormState } from '@/modules/exercise/lib/exercise';
import type { ExerciseDefinition, ExerciseDefinitionInput, ExerciseDefinitionFormState } from '@/modules/exercise/types/exercise';

interface ExerciseDefinitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ExerciseDefinitionInput) => Promise<void>;
  pending?: boolean;
  definition?: ExerciseDefinition | null;
  title: string;
}

export function ExerciseDefinitionDialog({
  open,
  onOpenChange,
  onSubmit,
  pending = false,
  definition,
  title,
}: ExerciseDefinitionDialogProps) {
  const [formState, setFormState] = useState<ExerciseDefinitionFormState>(() => createExerciseDefinitionFormState(definition));

  useEffect(() => {
    if (!open) return;
    setFormState(createExerciseDefinitionFormState(definition));
  }, [definition, open]);

  const setPartial = (updates: Partial<ExerciseDefinitionFormState>) => {
    setFormState((current) => ({ ...current, ...updates }));
  };

  const handleSubmit = async () => {
    try {
      const normalized = normalizeExerciseDefinitionFormState(formState);
      await onSubmit(normalized);
    } catch (error) {
      toast({
        title: 'Could Not Save Exercise',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5 pt-5">
          <div className="space-y-2">
            <Label htmlFor="exercise-definition-title">Name</Label>
            <Input
              id="exercise-definition-title"
              name="exercise_label"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              value={formState.name}
              onChange={(event) => setPartial({ name: event.target.value })}
              placeholder=""
            />
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="exercise-definition-has-reps"
                checked={formState.hasReps}
                onCheckedChange={(checked) => setPartial({
                  hasReps: checked === true,
                  repCount: checked === true ? formState.repCount : '',
                })}
              />
              <Label htmlFor="exercise-definition-has-reps">Track Reps</Label>
            </div>
            {formState.hasReps ? (
              <div className="space-y-2">
                <Label htmlFor="exercise-definition-reps">Rep Count</Label>
                <Input
                  id="exercise-definition-reps"
                  inputMode="numeric"
                  value={formState.repCount}
                  onChange={(event) => setPartial({ repCount: event.target.value })}
                  placeholder="10"
                />
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="exercise-definition-has-duration"
                checked={formState.hasDuration}
                onCheckedChange={(checked) => setPartial({
                  hasDuration: checked === true,
                  duration: checked === true ? formState.duration : '',
                })}
              />
              <Label htmlFor="exercise-definition-has-duration">Track Duration</Label>
            </div>
            {formState.hasDuration ? (
              <div className="space-y-2">
                <Label htmlFor="exercise-definition-duration">Duration</Label>
                <Input
                  id="exercise-definition-duration"
                  value={formState.duration}
                  onChange={(event) => setPartial({ duration: event.target.value })}
                  placeholder="05:00"
                />
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="exercise-definition-has-weight"
                checked={formState.hasWeight}
                onCheckedChange={(checked) => setPartial({
                  hasWeight: checked === true,
                  weight: checked === true ? formState.weight : '',
                  hasWeightDelta: checked === true ? formState.hasWeightDelta : false,
                  weightDelta: checked === true ? formState.weightDelta : '',
                })}
              />
              <Label htmlFor="exercise-definition-has-weight">Track Weight</Label>
            </div>
            {formState.hasWeight ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="exercise-definition-weight">Weight (lb)</Label>
                  <Input
                    id="exercise-definition-weight"
                    inputMode="decimal"
                    value={formState.weight}
                    onChange={(event) => setPartial({ weight: event.target.value })}
                    placeholder="45"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="exercise-definition-has-weight-delta"
                    checked={formState.hasWeightDelta}
                    onCheckedChange={(checked) => setPartial({
                      hasWeightDelta: checked === true,
                      weightDelta: checked === true ? formState.weightDelta : '',
                    })}
                  />
                  <Label htmlFor="exercise-definition-has-weight-delta">Use +/- Range</Label>
                </div>

                {formState.hasWeightDelta ? (
                  <div className="space-y-2">
                    <Label htmlFor="exercise-definition-weight-delta">Weight Range (+/- lb)</Label>
                    <Input
                      id="exercise-definition-weight-delta"
                      inputMode="decimal"
                      value={formState.weightDelta}
                      onChange={(event) => setPartial({ weightDelta: event.target.value })}
                      placeholder="5"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button data-dialog-confirm="true" onClick={handleSubmit} disabled={pending}>
            {pending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
