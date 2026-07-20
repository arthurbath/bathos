import { Archive, Pause, Play, RefreshCw, Repeat2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useTaskRecurrences } from '@/modules/tasks/hooks/useTaskRecurrences';
import type {
  TaskArea,
  TaskRecurrenceDefinition,
  TaskRecurrenceFrequency,
  TaskRecurrenceMissedPolicy,
  TaskRecurrenceRevision,
  TaskRecurrenceRuleMode,
  TaskTemplate,
  TaskTemplateRevision,
} from '@/modules/tasks/types/tasks';

export function TaskRecurrencePanel({
  ownerId,
  templates,
  templateRevisions,
  areas,
}: {
  ownerId: string;
  templates: TaskTemplate[];
  templateRevisions: Map<string, TaskTemplateRevision>;
  areas: TaskArea[];
}) {
  const model = useTaskRecurrences(ownerId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [ruleMode, setRuleMode] = useState<TaskRecurrenceRuleMode>('calendar');
  const [frequency, setFrequency] = useState<TaskRecurrenceFrequency>('weekly');
  const [intervalCount, setIntervalCount] = useState(1);
  const [startDate, setStartDate] = useState(model.planningDate);
  const [missedPolicy, setMissedPolicy] = useState<TaskRecurrenceMissedPolicy>('latest');
  const [targetAreaId, setTargetAreaId] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const selectedTemplate = templates.find((template) => template.id === templateId) ?? null;
  const currentRevisionByDefinition = model.revisions;
  const occurrenceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const occurrence of model.occurrences) {
      counts.set(occurrence.recurrence_id, (counts.get(occurrence.recurrence_id) ?? 0) + 1);
    }
    return counts;
  }, [model.occurrences]);

  useEffect(() => {
    if (!templateId || !templates.some((template) => template.id === templateId)) {
      setTemplateId(templates[0]?.id ?? '');
    }
  }, [templateId, templates]);
  useEffect(() => {
    if (!startDate) setStartDate(model.planningDate);
  }, [model.planningDate, startDate]);

  const reset = () => {
    setEditingId(null);
    setName('');
    setRuleMode('calendar');
    setFrequency('weekly');
    setIntervalCount(1);
    setStartDate(model.planningDate);
    setMissedPolicy('latest');
    setTargetAreaId('');
  };

  const edit = (
    definition: TaskRecurrenceDefinition,
    revision: TaskRecurrenceRevision,
  ) => {
    setEditingId(definition.id);
    setTemplateId(revision.template_id);
    setName(definition.name);
    setRuleMode(revision.rule_mode);
    setFrequency(revision.frequency);
    setIntervalCount(revision.interval_count);
    setStartDate(revision.start_date);
    setMissedPolicy(revision.missed_policy);
    setTargetAreaId(revision.target_area_id ?? '');
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>('[data-recurrence-name]')?.focus();
    }, 0);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTemplate || !name.trim() || pendingAction) return;
    const existing = editingId
      ? model.definitions.find((definition) => definition.id === editingId)
      : null;
    setPendingAction('save');
    try {
      await model.save({
        recurrenceId: existing?.id,
        expectedRecordRevision: existing?.record_revision,
        name,
        templateId: selectedTemplate.id,
        templateRevision: templateRevisions.get(selectedTemplate.id)?.revision
          ?? selectedTemplate.current_revision,
        ruleMode,
        frequency,
        intervalCount,
        startDate,
        missedPolicy,
        catchUpLimit: 50,
        targetAreaId: selectedTemplate.kind === 'project' ? targetAreaId || null : null,
      });
      toast({ title: editingId ? 'Repeat Revision Saved' : 'Repeat Saved' });
      reset();
    } catch (error) {
      showRecurrenceError('Repeat Could Not Be Saved', error);
    } finally {
      setPendingAction(null);
    }
  };

  const changeStatus = async (
    definition: TaskRecurrenceDefinition,
    status: 'active' | 'paused' | 'archived',
  ) => {
    setPendingAction(`${status}:${definition.id}`);
    try {
      await model.setStatus(definition, status);
      toast({ title: status === 'active' ? 'Repeat Resumed' : status === 'paused' ? 'Repeat Paused' : 'Repeat Archived' });
      if (editingId === definition.id) reset();
    } catch (error) {
      showRecurrenceError('Repeat Could Not Be Updated', error);
    } finally {
      setPendingAction(null);
    }
  };

  const evaluate = async (definition: TaskRecurrenceDefinition) => {
    setPendingAction(`evaluate:${definition.id}`);
    try {
      const result = await model.evaluate(definition);
      toast({
        title: result.generated_count === 0 ? 'Repeat Is Current' : 'Repeat Caught Up',
        description: result.generated_count === 0
          ? undefined
          : `${result.generated_count} ${result.generated_count === 1 ? 'item' : 'items'} created`,
      });
    } catch (error) {
      showRecurrenceError('Repeat Could Not Be Evaluated', error);
    } finally {
      setPendingAction(null);
    }
  };

  const connected = model.mode === 'connected';

  return (
    <section className="space-y-4 border-t border-[hsl(var(--grid-sticky-line))] pt-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Repeat2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-semibold">Repeats</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Generate independent work from an immutable template revision.
        </p>
      </div>

      <form onSubmit={save} className="space-y-4 rounded-md border border-[hsl(var(--grid-sticky-line))] p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold">{editingId ? 'Save Repeat Revision' : 'Save Repeat'}</h3>
          {editingId ? <Button type="button" variant="clear" size="sm" onClick={reset}>Cancel</Button> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Template">
            <select
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value);
                if (!name.trim()) {
                  setName(templates.find((item) => item.id === event.target.value)?.name ?? '');
                }
              }}
              disabled={!connected || templates.length === 0}
              className={selectClassName}
            >
              {templates.length === 0 ? <option value="">No Templates</option> : null}
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Repeat Name">
            <Input
              data-recurrence-name
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!connected}
            />
          </Field>
          <Field label="Rule Mode">
            <select
              value={ruleMode}
              onChange={(event) => setRuleMode(event.target.value as TaskRecurrenceRuleMode)}
              disabled={!connected}
              className={selectClassName}
            >
              <option value="calendar">Calendar</option>
              <option value="after_completion">After Completion</option>
            </select>
          </Field>
          <Field label="Frequency">
            <select
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as TaskRecurrenceFrequency)}
              disabled={!connected}
              className={selectClassName}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <Field label="Every">
            <Input
              type="number"
              min={1}
              max={1000}
              value={intervalCount}
              onChange={(event) => setIntervalCount(Number(event.target.value))}
              disabled={!connected}
            />
          </Field>
          <Field label="Start Date">
            <DatePickerField value={startDate} onValueChange={setStartDate} disabled={!connected} />
          </Field>
          <Field label="Missed Events">
            <select
              value={missedPolicy}
              onChange={(event) => setMissedPolicy(event.target.value as TaskRecurrenceMissedPolicy)}
              disabled={!connected}
              className={selectClassName}
            >
              <option value="latest">Create Latest</option>
              <option value="skip">Skip Missed</option>
              <option value="all">Create All</option>
            </select>
          </Field>
          {selectedTemplate?.kind === 'project' ? (
            <Field label="Area" required={false}>
              <select
                value={targetAreaId}
                onChange={(event) => setTargetAreaId(event.target.value)}
                disabled={!connected}
                className={selectClassName}
              >
                <option value="">No Area</option>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.title}</option>)}
              </select>
            </Field>
          ) : null}
        </div>
        <Button
          type="submit"
          variant="outline-success"
          disabled={!connected || !templateId || !name.trim() || intervalCount < 1 || pendingAction !== null}
        >
          {editingId ? 'Save Revision' : 'Save Repeat'}
        </Button>
      </form>

      {model.definitions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No Repeats</p>
      ) : (
        <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
          {model.definitions.map((definition) => {
            const revision = currentRevisionByDefinition.get(definition.id);
            if (!revision) return null;
            const evaluationFailed = model.evaluationFailures.has(definition.id);
            return (
              <article key={definition.id} className="flex flex-wrap items-center gap-3 px-2 py-4 sm:px-4">
                <Repeat2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{definition.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatRule(revision)} / {definition.status === 'active' ? 'Active' : 'Paused'} / {occurrenceCounts.get(definition.id) ?? 0} Created
                    {evaluationFailed ? (
                      <span className="text-warning"> / Catch-Up Failed</span>
                    ) : null}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={!connected || pendingAction !== null} onClick={() => edit(definition, revision)}>
                  Revise
                </Button>
                <Button type="button" variant={evaluationFailed ? 'outline-warning' : 'outline'} size="icon" disabled={!connected || definition.status !== 'active' || pendingAction !== null} onClick={() => void evaluate(definition)} aria-label={`${evaluationFailed ? 'Retry catch-up for' : 'Catch up'} ${definition.name}`}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button type="button" variant="outline" size="icon" disabled={!connected || pendingAction !== null} onClick={() => void changeStatus(definition, definition.status === 'active' ? 'paused' : 'active')} aria-label={`${definition.status === 'active' ? 'Pause' : 'Resume'} ${definition.name}`}>
                  {definition.status === 'active' ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                </Button>
                <ArchiveRepeatButton
                  definition={definition}
                  disabled={!connected || pendingAction !== null}
                  onArchive={() => changeStatus(definition, 'archived')}
                />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  required = true,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      <span>{label}{required ? <> <span className="text-destructive">*</span></> : null}</span>
      {children}
    </label>
  );
}

function ArchiveRepeatButton({
  definition,
  disabled,
  onArchive,
}: {
  definition: TaskRecurrenceDefinition;
  disabled: boolean;
  onArchive: () => Promise<void>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="clear" size="icon" disabled={disabled} aria-label={`Archive ${definition.name}`}>
          <Archive className="h-4 w-4" aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="shadow-none">
        <AlertDialogHeader><AlertDialogTitle>Archive Repeat</AlertDialogTitle></AlertDialogHeader>
        <AlertDialogBody>
          <AlertDialogDescription>
            Archive {definition.name}? Existing generated work will not change, and no future work will be created.
          </AlertDialogDescription>
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onArchive()}>Archive</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function formatRule(revision: TaskRecurrenceRevision): string {
  const units = {
    daily: ['day', 'days'],
    weekly: ['week', 'weeks'],
    monthly: ['month', 'months'],
    yearly: ['year', 'years'],
  } as const;
  const unit = units[revision.frequency][revision.interval_count === 1 ? 0 : 1];
  const cadence = revision.interval_count === 1
    ? revision.frequency[0].toUpperCase() + revision.frequency.slice(1)
    : `Every ${revision.interval_count} ${unit}`;
  return revision.rule_mode === 'after_completion' ? `${cadence} After Completion` : cadence;
}

function showRecurrenceError(title: string, error: unknown): void {
  toast({
    title,
    description: error instanceof Error ? error.message : 'Unknown error',
    variant: 'destructive',
  });
}

const selectClassName = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
