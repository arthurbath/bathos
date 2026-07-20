import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  CircleSlash2,
  ListChecks,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
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
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import {
  TaskHierarchyEditableTitle,
  TaskHierarchyOrderButton,
} from '@/modules/tasks/components/TaskProjectsView';
import { submitTaskFormOnEnter } from '@/modules/tasks/components/taskFormKeyboard';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import { useTaskProjectDetail } from '@/modules/tasks/hooks/useTaskProjectDetail';
import type { TaskChecklistItem, TaskHeading, TaskTodo } from '@/modules/tasks/types/tasks';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';

export function TaskProjectDetailView({
  ownerId,
  projectId,
  hierarchy,
  planningDate,
}: {
  ownerId: string;
  projectId: string;
  hierarchy: TaskHierarchyModel;
  planningDate: string;
}) {
  const detail = useTaskProjectDetail(ownerId, projectId);
  const navigate = useNavigate();
  const basePath = useModuleBasePath();
  const project = hierarchy.projects.find(({ id }) => id === projectId);
  const headings = hierarchy.headings.filter(({ project_id }) => project_id === projectId);
  const [newHeadingTitle, setNewHeadingTitle] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskHeadingId, setNewTaskHeadingId] = useState('');
  const [creatingHeading, setCreatingHeading] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [projectAction, setProjectAction] = useState<'complete' | 'cancel' | 'delete' | null>(null);
  const [changingProject, setChangingProject] = useState(false);

  const createHeading = async (event: FormEvent) => {
    event.preventDefault();
    if (!newHeadingTitle.trim() || creatingHeading) return;
    setCreatingHeading(true);
    try {
      await hierarchy.createHeading(projectId, newHeadingTitle);
      setNewHeadingTitle('');
    } catch (error) {
      showError('Heading Could Not Be Added', error);
    } finally {
      setCreatingHeading(false);
    }
  };

  const createTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!newTaskTitle.trim() || creatingTask) return;
    setCreatingTask(true);
    try {
      await detail.createTask(newTaskTitle, newTaskHeadingId || null);
      setNewTaskTitle('');
    } catch (error) {
      showError('Task Could Not Be Added', error);
    } finally {
      setCreatingTask(false);
    }
  };

  if (hierarchy.loading || detail.loading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  if (hierarchy.error || detail.error) {
    return (
      <p role="alert" className="py-12 text-center text-sm text-destructive">
        Project Could Not Be Loaded
      </p>
    );
  }
  if (!project) {
    return (
      <p role="alert" className="py-12 text-center text-sm text-muted-foreground">
        Project Not Found
      </p>
    );
  }

  const area = hierarchy.areas.find(({ id }) => id === project.area_id);
  const projectsHref = `${basePath}/projects`;
  const ungroupedTasks = detail.tasks.filter(({ heading_id }) => heading_id === null);
  const openDescendantCount = detail.tasks.filter(({ lifecycle }) => lifecycle === 'open').length;

  const confirmProjectAction = async () => {
    if (!projectAction || changingProject) return;
    setChangingProject(true);
    try {
      if (projectAction === 'delete') {
        await hierarchy.deleteHierarchy('project', project.id);
        navigate(projectsHref);
      } else {
        await hierarchy.transitionProject(
          project.id,
          projectAction === 'complete' ? 'complete_project' : 'cancel_project',
          openDescendantCount > 0,
        );
      }
      setProjectAction(null);
    } catch (error) {
      showError('Project Could Not Be Changed', error);
    } finally {
      setChangingProject(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <a
          href={projectsHref}
          onClick={(event) => handleClientSideLinkNavigation(event, navigate, projectsHref)}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Projects
        </a>
        <div className="flex flex-wrap items-start gap-3">
          <div className="w-full min-w-0 sm:flex-1">
            <h3 className="text-2xl font-semibold leading-tight text-foreground">{project.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {area?.title ?? 'No Area'}{project.lifecycle === 'open' ? '' : ` · ${project.lifecycle === 'completed' ? 'Completed' : 'Canceled'}`}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {project.lifecycle === 'open' ? (
              <>
                <Button type="button" variant="outline-success" size="sm" onClick={() => setProjectAction('complete')}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Complete
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setProjectAction('cancel')}>
                  <CircleSlash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void hierarchy.transitionProject(project.id, 'reopen_project').catch((error) => {
                  showError('Project Could Not Be Reopened', error);
                })}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Reopen
              </Button>
            )}
            <Button type="button" variant="outline-destructive" size="sm" onClick={() => setProjectAction('delete')}>
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {project.lifecycle === 'open' ? (
        <ProjectPlanningForm
          project={project}
          planningDate={planningDate}
          onSave={(patch) => hierarchy.updateProject(project.id, patch)}
        />
      ) : null}

      {project.lifecycle === 'open' ? <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={createHeading} className="flex gap-2">
          <Input
            value={newHeadingTitle}
            onChange={(event) => setNewHeadingTitle(event.target.value)}
            onKeyDown={submitTaskFormOnEnter}
            aria-label="New Heading Name"
            placeholder="New Heading"
          />
          <Button
            type="submit"
            variant="outline-success"
            size="icon"
            disabled={creatingHeading || !newHeadingTitle.trim()}
            aria-label="Add Heading"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        <form onSubmit={createTask} className="flex gap-2">
          <Input
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
            onKeyDown={submitTaskFormOnEnter}
            aria-label="New Project Task Name"
            placeholder="New Task"
          />
          <select
            value={newTaskHeadingId}
            onChange={(event) => setNewTaskHeadingId(event.target.value)}
            aria-label="New Task Heading"
            className="h-10 min-w-0 max-w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">No Heading</option>
            {headings.map((heading) => (
              <option key={heading.id} value={heading.id}>{heading.title}</option>
            ))}
          </select>
          <Button
            type="submit"
            variant="outline-success"
            size="icon"
            disabled={creatingTask || !newTaskTitle.trim()}
            aria-label="Add Project Task"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </div> : null}

      {headings.length === 0 && ungroupedTasks.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No Project Tasks</p>
      ) : (
        <div className="space-y-7">
          {ungroupedTasks.length > 0 ? (
            <ProjectTaskSection
              heading={null}
              headings={headings}
              tasks={ungroupedTasks}
              detail={detail}
            />
          ) : null}
          {headings.map((heading, index) => (
            <ProjectTaskSection
              key={heading.id}
              heading={heading}
              headings={headings}
              tasks={detail.tasks.filter(({ heading_id }) => heading_id === heading.id)}
              detail={detail}
              onRename={(title) => hierarchy.updateHeading(heading.id, { title })}
              onMoveUp={index > 0 ? () => hierarchy.reorderHeading(heading.id, 'up') : undefined}
              onMoveDown={index < headings.length - 1
                ? () => hierarchy.reorderHeading(heading.id, 'down')
                : undefined}
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={projectAction !== null}
        onOpenChange={(open) => { if (!open && !changingProject) setProjectAction(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {projectAction === 'delete'
                ? 'Delete Project'
                : projectAction === 'complete' ? 'Complete Project' : 'Cancel Project'}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody>
            <AlertDialogDescription>
              {projectAction === 'delete'
                ? 'The project, headings, tasks, and checklist items will move to Trash together.'
                : openDescendantCount > 0
                  ? `${openDescendantCount} open ${openDescendantCount === 1 ? 'task' : 'tasks'} will be ${projectAction === 'complete' ? 'completed' : 'canceled'} with the project.`
                  : `The project will be ${projectAction === 'complete' ? 'completed' : 'canceled'}.`}
            </AlertDialogDescription>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingProject}>Keep Project</AlertDialogCancel>
            <AlertDialogAction
              disabled={changingProject}
              className={projectAction === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
              onClick={(event) => {
                event.preventDefault();
                void confirmProjectAction();
              }}
            >
              {projectAction === 'delete' ? 'Move to Trash' : 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProjectPlanningForm({
  project,
  planningDate,
  onSave,
}: {
  project: NonNullable<TaskHierarchyModel['projects'][number]>;
  planningDate: string;
  onSave: (patch: Parameters<TaskHierarchyModel['updateProject']>[1]) => Promise<unknown>;
}) {
  const [destination, setDestination] = useState(project.destination);
  const [todaySection, setTodaySection] = useState(project.today_section);
  const [startDate, setStartDate] = useState(project.start_date ?? '');
  const [deadline, setDeadline] = useState(project.deadline ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDestination(project.destination);
    setTodaySection(project.today_section);
    setStartDate(project.start_date ?? '');
    setDeadline(project.deadline ?? '');
  }, [
    project.deadline,
    project.destination,
    project.start_date,
    project.today_section,
  ]);

  const normalizedStartDate = destination === 'someday'
    ? null
    : startDate || (destination === 'today' ? planningDate : null);
  const normalizedTodaySection = destination === 'today' ? todaySection : 'daytime';
  const invalidDateRange = Boolean(
    normalizedStartDate && deadline && deadline < normalizedStartDate,
  );
  const changed = destination !== project.destination
    || normalizedTodaySection !== project.today_section
    || normalizedStartDate !== project.start_date
    || (deadline || null) !== project.deadline;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!changed || invalidDateRange || saving) return;
    setSaving(true);
    try {
      await onSave({
        destination,
        today_section: normalizedTodaySection,
        start_date: normalizedStartDate,
        deadline: deadline || null,
      });
    } catch (error) {
      showError('Project Planning Could Not Be Saved', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      aria-label="Project Planning"
      onSubmit={save}
      className="space-y-4 rounded-md border border-[hsl(var(--grid-sticky-line))] p-4"
    >
      <h4 className="text-sm font-semibold text-foreground">Planning</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`project-destination-${project.id}`}>
            Destination
          </label>
          <select
            id={`project-destination-${project.id}`}
            value={destination}
            disabled={saving}
            onChange={(event) => {
              const next = event.target.value as typeof destination;
              setDestination(next);
              if (next === 'someday') setStartDate('');
              if (next !== 'today') setTodaySection('daytime');
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="today">Today</option>
            <option value="anytime">Anytime</option>
            <option value="someday">Someday</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`project-today-section-${project.id}`}>
            Today Section
          </label>
          <select
            id={`project-today-section-${project.id}`}
            value={normalizedTodaySection}
            disabled={saving || destination !== 'today'}
            onChange={(event) => setTodaySection(event.target.value as typeof todaySection)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="daytime">Today</option>
            <option value="evening">This Evening</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`project-start-date-${project.id}`}>
            Start Date
          </label>
          <div className="flex gap-2">
            <DatePickerField
              id={`project-start-date-${project.id}`}
              value={destination === 'someday' ? '' : startDate}
              onValueChange={setStartDate}
              disabled={saving || destination === 'someday'}
              placeholder="No Start Date"
              aria-label="Project Start Date"
            />
            {destination !== 'someday' && startDate ? (
              <Button
                type="button"
                variant="clear"
                size="icon"
                disabled={saving}
                aria-label="Clear Project Start Date"
                onClick={() => setStartDate('')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor={`project-deadline-${project.id}`}>
            Deadline
          </label>
          <div className="flex gap-2">
            <DatePickerField
              id={`project-deadline-${project.id}`}
              value={deadline}
              onValueChange={setDeadline}
              disabled={saving}
              placeholder="No Deadline"
              aria-label="Project Deadline"
            />
            {deadline ? (
              <Button
                type="button"
                variant="clear"
                size="icon"
                disabled={saving}
                aria-label="Clear Project Deadline"
                onClick={() => setDeadline('')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {invalidDateRange ? (
        <p role="alert" className="text-sm text-destructive">
          Deadline cannot be earlier than the start date.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || invalidDateRange || !changed}>
          Save Planning
        </Button>
      </div>
    </form>
  );
}

function ProjectTaskSection({
  heading,
  headings,
  tasks,
  detail,
  onRename,
  onMoveUp,
  onMoveDown,
}: {
  heading: TaskHeading | null;
  headings: TaskHeading[];
  tasks: TaskTodo[];
  detail: ReturnType<typeof useTaskProjectDetail>;
  onRename?: (title: string) => Promise<unknown>;
  onMoveUp?: () => Promise<unknown>;
  onMoveDown?: () => Promise<unknown>;
}) {
  const sectionId = `task-heading-${heading?.id ?? 'none'}`;
  return (
    <section aria-labelledby={sectionId}>
      <div className="mb-2 flex min-h-9 items-center gap-2">
        {heading ? (
          <TaskHierarchyEditableTitle id={sectionId} value={heading.title} onSave={onRename!} />
        ) : (
          <h4 id={sectionId} className="text-sm font-semibold text-muted-foreground">
            No Heading ({tasks.length})
          </h4>
        )}
        {heading ? (
          <div className="ml-auto flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{tasks.length}</span>
            <TaskHierarchyOrderButton
              label={`Move ${heading.title} Up`}
              icon={ArrowUp}
              action={onMoveUp}
            />
            <TaskHierarchyOrderButton
              label={`Move ${heading.title} Down`}
              icon={ArrowDown}
              action={onMoveDown}
            />
          </div>
        ) : null}
      </div>
      <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
        {tasks.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">No Tasks</p>
        ) : tasks.map((task, index) => (
          <ProjectTaskRow
            key={task.id}
            task={task}
            headings={headings}
            checklistItems={detail.checklistItems.filter(({ task_id }) => task_id === task.id)}
            onRename={(title) => detail.updateTask(task.id, { title })}
            onSetActionability={(actionability) => (
              detail.updateTask(task.id, { actionability })
            )}
            onMoveHeading={(headingId) => detail.moveTaskToHeading(task.id, headingId)}
            onMoveUp={index > 0 ? () => detail.reorderTask(task.id, 'up') : undefined}
            onMoveDown={index < tasks.length - 1
              ? () => detail.reorderTask(task.id, 'down')
              : undefined}
            onCreateChecklistItem={(title) => detail.createChecklistItem(task.id, title)}
            onRenameChecklistItem={(item, title) => (
              detail.updateChecklistItem(item.id, { title })
            )}
            onCompleteChecklistItem={(item, completed) => (
              detail.completeChecklistItem(item.id, completed)
            )}
            onReorderChecklistItem={(item, direction) => (
              detail.reorderChecklistItem(item.id, direction)
            )}
          />
        ))}
      </div>
    </section>
  );
}

function ProjectTaskRow({
  task,
  headings,
  checklistItems,
  onRename,
  onSetActionability,
  onMoveHeading,
  onMoveUp,
  onMoveDown,
  onCreateChecklistItem,
  onRenameChecklistItem,
  onCompleteChecklistItem,
  onReorderChecklistItem,
}: {
  task: TaskTodo;
  headings: TaskHeading[];
  checklistItems: TaskChecklistItem[];
  onRename: (title: string) => Promise<unknown>;
  onSetActionability: (actionability: TaskTodo['actionability']) => Promise<unknown>;
  onMoveHeading: (headingId: string | null) => Promise<unknown>;
  onMoveUp?: () => Promise<unknown>;
  onMoveDown?: () => Promise<unknown>;
  onCreateChecklistItem: (title: string) => Promise<unknown>;
  onRenameChecklistItem: (item: TaskChecklistItem, title: string) => Promise<unknown>;
  onCompleteChecklistItem: (item: TaskChecklistItem, completed: boolean) => Promise<unknown>;
  onReorderChecklistItem: (
    item: TaskChecklistItem,
    direction: 'up' | 'down',
  ) => Promise<unknown>;
}) {
  return (
    <article className="px-2 py-3 sm:px-4">
      <div className="flex min-h-9 items-center gap-1">
        <TaskHierarchyEditableTitle value={task.title} onSave={onRename} />
        <TaskHierarchyOrderButton
          label={`Move ${task.title} Up`}
          icon={ArrowUp}
          action={onMoveUp}
        />
        <TaskHierarchyOrderButton
          label={`Move ${task.title} Down`}
          icon={ArrowDown}
          action={onMoveDown}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={task.actionability}
          onChange={(event) => {
            void onSetActionability(
              event.target.value as TaskTodo['actionability'],
            ).catch((error) => {
              showError('Task Actionability Could Not Be Updated', error);
            });
          }}
          aria-label={`Actionability for ${task.title}`}
          className="h-9 min-w-32 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="actionable">Actionable</option>
          <option value="waiting">Waiting</option>
        </select>
        <select
          value={task.heading_id ?? ''}
          onChange={(event) => {
            void onMoveHeading(event.target.value || null).catch((error) => {
              showError('Task Could Not Be Moved', error);
            });
          }}
          aria-label={`Heading for ${task.title}`}
          className="h-9 min-w-36 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">No Heading</option>
          {headings.map((heading) => (
            <option key={heading.id} value={heading.id}>{heading.title}</option>
          ))}
        </select>
        <details className="group min-w-0 flex-1">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            Checklist ({checklistItems.length})
          </summary>
          <ChecklistEditor
            task={task}
            items={checklistItems}
            onCreate={onCreateChecklistItem}
            onRename={onRenameChecklistItem}
            onComplete={onCompleteChecklistItem}
            onReorder={onReorderChecklistItem}
          />
        </details>
      </div>
    </article>
  );
}

function ChecklistEditor({
  task,
  items,
  onCreate,
  onRename,
  onComplete,
  onReorder,
}: {
  task: TaskTodo;
  items: TaskChecklistItem[];
  onCreate: (title: string) => Promise<unknown>;
  onRename: (item: TaskChecklistItem, title: string) => Promise<unknown>;
  onComplete: (item: TaskChecklistItem, completed: boolean) => Promise<unknown>;
  onReorder: (item: TaskChecklistItem, direction: 'up' | 'down') => Promise<unknown>;
}) {
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      await onCreate(title);
      setTitle('');
    } catch (error) {
      showError('Checklist Item Could Not Be Added', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-md border border-[hsl(var(--grid-sticky-line))] p-3">
      {items.map((item, index) => (
        <div key={item.id} className="flex min-h-9 items-center gap-1">
          <input
            type="checkbox"
            checked={item.completed}
            onChange={(event) => {
              void onComplete(item, event.target.checked).catch((error) => {
                showError('Checklist Item Could Not Be Updated', error);
              });
            }}
            aria-label={`${item.completed ? 'Reopen' : 'Complete'} ${item.title}`}
            className="h-4 w-4 shrink-0 accent-[hsl(var(--success))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className={item.completed ? 'min-w-0 flex-1 opacity-60 line-through' : 'min-w-0 flex-1'}>
            <TaskHierarchyEditableTitle
              value={item.title}
              onSave={(nextTitle) => onRename(item, nextTitle)}
            />
          </div>
          <TaskHierarchyOrderButton
            label={`Move ${item.title} Up`}
            icon={ArrowUp}
            action={index > 0 ? () => onReorder(item, 'up') : undefined}
          />
          <TaskHierarchyOrderButton
            label={`Move ${item.title} Down`}
            icon={ArrowDown}
            action={index < items.length - 1 ? () => onReorder(item, 'down') : undefined}
          />
        </div>
      ))}
      <form onSubmit={create} className="flex gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={submitTaskFormOnEnter}
          aria-label={`New Checklist Item for ${task.title}`}
          placeholder="New Checklist Item"
          className="h-9"
        />
        <Button
          type="submit"
          variant="outline-success"
          size="icon"
          disabled={creating || !title.trim()}
          aria-label={`Add Checklist Item to ${task.title}`}
          className="h-9 w-9"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function showError(title: string, error: unknown) {
  toast({
    title,
    description: error instanceof Error ? error.message : 'Unknown error',
    variant: 'destructive',
  });
}
