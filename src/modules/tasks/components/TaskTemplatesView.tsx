import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Archive, Copy, FolderKanban, ListTodo, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';
import { addTaskCalendarDays } from '@/modules/tasks/domain/taskDates';
import { useTaskTemplates } from '@/modules/tasks/hooks/useTaskTemplates';
import { TaskRecurrencePanel } from '@/modules/tasks/components/TaskRecurrencePanel';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import type {
  TaskTemplate,
  TaskTemplateKind,
  TaskTemplateSnapshot,
} from '@/modules/tasks/types/tasks';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';

export function TaskTemplatesView({
  ownerId,
  hierarchy,
}: {
  ownerId: string;
  hierarchy: TaskHierarchyModel;
}) {
  const navigate = useNavigate();
  const basePath = useModuleBasePath();
  const model = useTaskTemplates(ownerId);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<TaskTemplateKind>('todo');
  const [sourceId, setSourceId] = useState('');
  const [name, setName] = useState('');
  const [captureAnchor, setCaptureAnchor] = useState(model.planningDate);
  const [instanceAnchors, setInstanceAnchors] = useState<Record<string, string>>({});
  const [targetAreas, setTargetAreas] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const sources = sourceType === 'todo' ? model.todos : model.projects;
  const selectedTemplate = templateId
    ? model.templates.find((template) => template.id === templateId) ?? null
    : null;

  useEffect(() => {
    if (!sourceId || !sources.some((source) => source.id === sourceId)) {
      setSourceId(sources[0]?.id ?? '');
    }
  }, [sourceId, sources]);
  useEffect(() => {
    if (!captureAnchor) setCaptureAnchor(model.planningDate);
  }, [captureAnchor, model.planningDate]);

  const sourceLabelById = useMemo(() => new Map([
    ...model.todos.map((todo) => [todo.id, todo.title] as const),
    ...model.projects.map((project) => [project.id, project.title] as const),
  ]), [model.projects, model.todos]);

  const resetCapture = () => {
    setTemplateId(null);
    setSourceType('todo');
    setName('');
  };

  const saveTemplate = async (event: FormEvent) => {
    event.preventDefault();
    if (!sourceId || !name.trim() || pendingAction) return;
    setPendingAction('capture');
    try {
      await model.capture({
        templateId,
        sourceType,
        sourceId,
        name,
        anchorDate: captureAnchor,
      });
      toast({ title: templateId ? 'Template Revision Saved' : 'Template Saved' });
      resetCapture();
    } catch (error) {
      showTemplateError('Template Could Not Be Saved', error);
    } finally {
      setPendingAction(null);
    }
  };

  const revise = (template: TaskTemplate) => {
    setTemplateId(template.id);
    setSourceType(template.kind);
    setName(template.name);
    const availableSources = template.kind === 'todo' ? model.todos : model.projects;
    const priorSource = model.revisions.get(template.id)?.source_id;
    setSourceId(
      availableSources.some((source) => source.id === priorSource)
        ? priorSource!
        : availableSources[0]?.id ?? '',
    );
    window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-template-name]')?.focus(), 0);
  };

  const instantiate = async (template: TaskTemplate) => {
    if (pendingAction) return;
    setPendingAction(`instantiate:${template.id}`);
    try {
      const result = await model.instantiate({
        templateId: template.id,
        templateRevision: template.current_revision,
        anchorDate: instanceAnchors[template.id] ?? model.planningDate,
        targetAreaId: template.kind === 'project'
          ? targetAreas[template.id] || null
          : null,
      });
      toast({ title: 'Template Created' });
      const revision = model.revisions.get(template.id);
      navigate(result.result.project_id
        ? `${basePath}/projects/${result.result.project_id}`
        : `${basePath}/${getTodoTemplateDestination(
          revision?.snapshot,
          instanceAnchors[template.id] ?? model.planningDate,
          model.planningDate,
        )}`);
    } catch (error) {
      showTemplateError('Template Could Not Be Created', error);
    } finally {
      setPendingAction(null);
    }
  };

  if (model.loading || hierarchy.loading) {
    return <div className="flex min-h-40 items-center justify-center"><LoadingSpinner /></div>;
  }
  if (model.error || hierarchy.error) {
    return <p role="alert" className="py-12 text-center text-sm text-destructive">Templates Could Not Be Loaded</p>;
  }

  const connected = model.mode === 'connected';

  return (
    <div className="space-y-8">
      {!connected ? (
        <p role="status" className="rounded-md border border-info/50 px-4 py-3 text-sm text-info">
          Connect Task Storage to Save or Create Templates
        </p>
      ) : null}

      <form onSubmit={saveTemplate} className="space-y-4 rounded-md border border-[hsl(var(--grid-sticky-line))] p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold">{selectedTemplate ? 'Save Template Revision' : 'Save Template'}</h3>
          {selectedTemplate ? (
            <Button type="button" variant="clear" size="sm" onClick={resetCapture}>Cancel</Button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Source Type <span className="text-destructive">*</span></span>
            <select
              value={sourceType}
              onChange={(event) => {
                const kind = event.target.value as TaskTemplateKind;
                setSourceType(kind);
                setSourceId('');
              }}
              disabled={!connected || Boolean(selectedTemplate)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="todo">To-Do</option>
              <option value="project">Project</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Current Source <span className="text-destructive">*</span></span>
            <select
              value={sourceId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSourceId(nextId);
                if (!name.trim()) setName(sourceLabelById.get(nextId) ?? '');
              }}
              disabled={!connected || sources.length === 0}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {sources.length === 0 ? <option value="">No Open Sources</option> : null}
              {sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Template Name <span className="text-destructive">*</span></span>
            <Input
              data-template-name
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!connected}
              autoComplete="off"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Reference Date <span className="text-destructive">*</span></span>
            <DatePickerField
              value={captureAnchor}
              onValueChange={setCaptureAnchor}
              disabled={!connected}
            />
          </label>
        </div>
        <Button
          type="submit"
          variant="outline-success"
          disabled={!connected || !sourceId || !name.trim() || pendingAction !== null}
          className="gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {selectedTemplate ? 'Save Revision' : 'Save Template'}
        </Button>
      </form>

      {model.templates.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No Templates</p>
      ) : (
        <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
          {model.templates.map((template) => {
            const revision = model.revisions.get(template.id);
            const Icon = template.kind === 'project' ? FolderKanban : ListTodo;
            const nodeCount = revision ? countTemplateNodes(revision.snapshot) : null;
            return (
              <article key={template.id} className="space-y-4 px-2 py-5 sm:px-4">
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">{template.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {template.kind === 'project' ? 'Project' : 'To-Do'} / Revision {template.current_revision}
                      {nodeCount === null ? '' : ` / ${nodeCount} ${nodeCount === 1 ? 'Item' : 'Items'}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!connected || pendingAction !== null}
                    onClick={() => revise(template)}
                  >
                    Revise
                  </Button>
                  <ArchiveTemplateButton
                    template={template}
                    disabled={!connected || pendingAction !== null}
                    onArchive={async () => {
                      setPendingAction(`archive:${template.id}`);
                      try {
                        await model.archive(template);
                        if (templateId === template.id) resetCapture();
                        toast({ title: 'Template Archived' });
                      } catch (error) {
                        showTemplateError('Template Could Not Be Archived', error);
                      } finally {
                        setPendingAction(null);
                      }
                    }}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <label className="space-y-1 text-xs font-medium text-muted-foreground">
                    <span>Creation Date</span>
                    <DatePickerField
                      value={instanceAnchors[template.id] ?? model.planningDate}
                      onValueChange={(value) => setInstanceAnchors((current) => ({
                        ...current,
                        [template.id]: value,
                      }))}
                      disabled={!connected}
                    />
                  </label>
                  {template.kind === 'project' ? (
                    <label className="space-y-1 text-xs font-medium text-muted-foreground">
                      <span>Area</span>
                      <select
                        value={targetAreas[template.id] ?? ''}
                        onChange={(event) => setTargetAreas((current) => ({
                          ...current,
                          [template.id]: event.target.value,
                        }))}
                        disabled={!connected}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">No Area</option>
                        {hierarchy.areas.map((area) => <option key={area.id} value={area.id}>{area.title}</option>)}
                      </select>
                    </label>
                  ) : <span />}
                  <Button
                    type="button"
                    variant="outline-success"
                    disabled={!connected || !revision || pendingAction !== null}
                    onClick={() => void instantiate(template)}
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Create
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <TaskRecurrencePanel
        ownerId={ownerId}
        templates={model.templates}
        templateRevisions={model.revisions}
        areas={hierarchy.areas}
      />
    </div>
  );
}

function ArchiveTemplateButton({
  template,
  disabled,
  onArchive,
}: {
  template: TaskTemplate;
  disabled: boolean;
  onArchive: () => Promise<void>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="clear" size="icon" disabled={disabled} aria-label={`Archive ${template.name}`}>
          <Archive className="h-4 w-4" aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="shadow-none">
        <AlertDialogHeader><AlertDialogTitle>Archive Template</AlertDialogTitle></AlertDialogHeader>
        <AlertDialogBody>
          <AlertDialogDescription>
            Archive {template.name}? Existing to-dos and projects created from it will not change.
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

function countTemplateNodes(snapshot: TaskTemplateSnapshot): number {
  if (snapshot.kind === 'todo') return 1 + snapshot.root.checklist.length;
  return 1
    + snapshot.headings.length
    + snapshot.todos.length
    + snapshot.todos.reduce((total, todo) => total + todo.checklist.length, 0);
}

function getTodoTemplateDestination(
  snapshot: TaskTemplateSnapshot | undefined,
  anchorDate: string,
  planningDate: string,
): 'inbox' | 'today' | 'upcoming' | 'anytime' | 'someday' {
  if (!snapshot || snapshot.kind !== 'todo') return 'anytime';
  if (snapshot.root.destination === 'inbox') return 'inbox';
  if (snapshot.root.destination === 'someday') return 'someday';
  if (snapshot.root.destination === 'today') {
    if (anchorDate === planningDate) return 'today';
    return anchorDate > planningDate ? 'upcoming' : 'anytime';
  }
  const startDate = snapshot.root.start_offset_days === null
    ? null
    : addTaskCalendarDays(anchorDate, snapshot.root.start_offset_days);
  return startDate && startDate > planningDate ? 'upcoming' : 'anytime';
}

function showTemplateError(title: string, error: unknown): void {
  toast({
    title,
    description: error instanceof Error ? error.message : 'Unknown error',
    variant: 'destructive',
  });
}
