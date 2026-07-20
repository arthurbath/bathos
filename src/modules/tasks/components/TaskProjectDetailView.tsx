import { useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ListChecks, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import {
  TaskHierarchyEditableTitle,
  TaskHierarchyOrderButton,
} from '@/modules/tasks/components/TaskProjectsView';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import { useTaskProjectDetail } from '@/modules/tasks/hooks/useTaskProjectDetail';
import type { TaskChecklistItem, TaskHeading, TaskTodo } from '@/modules/tasks/types/tasks';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';

export function TaskProjectDetailView({
  ownerId,
  projectId,
  hierarchy,
}: {
  ownerId: string;
  projectId: string;
  hierarchy: TaskHierarchyModel;
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
        <div>
          <h3 className="text-2xl font-semibold leading-tight text-foreground">{project.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{area?.title ?? 'No Area'}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={createHeading} className="flex gap-2">
          <Input
            value={newHeadingTitle}
            onChange={(event) => setNewHeadingTitle(event.target.value)}
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
      </div>

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
    </div>
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
