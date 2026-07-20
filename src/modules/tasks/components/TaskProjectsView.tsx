import { useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, FolderKanban, Pencil, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';
import { handleClientSideLinkNavigation } from '@/lib/navigation';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import type { TaskArea, TaskProject } from '@/modules/tasks/types/tasks';
import { submitTaskFormOnEnter } from '@/modules/tasks/components/taskFormKeyboard';
import { useModuleBasePath } from '@/platform/hooks/useHostModule';

export function TaskProjectsView({ hierarchy }: { hierarchy: TaskHierarchyModel }) {
  const navigate = useNavigate();
  const basePath = useModuleBasePath();
  const [newAreaTitle, setNewAreaTitle] = useState('');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectAreaId, setNewProjectAreaId] = useState('');
  const [creatingArea, setCreatingArea] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const createArea = async (event: FormEvent) => {
    event.preventDefault();
    if (!newAreaTitle.trim() || creatingArea) return;
    setCreatingArea(true);
    try {
      await hierarchy.createArea(newAreaTitle);
      setNewAreaTitle('');
    } catch (error) {
      showError('Area Could Not Be Added', error);
    } finally {
      setCreatingArea(false);
    }
  };

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!newProjectTitle.trim() || creatingProject) return;
    setCreatingProject(true);
    try {
      await hierarchy.createProject(newProjectTitle, newProjectAreaId || null);
      setNewProjectTitle('');
    } catch (error) {
      showError('Project Could Not Be Added', error);
    } finally {
      setCreatingProject(false);
    }
  };

  if (hierarchy.loading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  if (hierarchy.error) {
    return (
      <p role="alert" className="py-12 text-center text-sm text-destructive">
        Projects Could Not Be Loaded
      </p>
    );
  }

  const unassigned = hierarchy.projects.filter((project) => project.area_id === null);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={createArea} className="flex gap-2">
          <Input
            value={newAreaTitle}
            onChange={(event) => setNewAreaTitle(event.target.value)}
            onKeyDown={submitTaskFormOnEnter}
            aria-label="New Area Name"
            placeholder="New Area"
          />
          <Button
            type="submit"
            variant="outline-success"
            size="icon"
            disabled={creatingArea || !newAreaTitle.trim()}
            aria-label="Add Area"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        <form onSubmit={createProject} className="flex gap-2">
          <Input
            value={newProjectTitle}
            onChange={(event) => setNewProjectTitle(event.target.value)}
            onKeyDown={submitTaskFormOnEnter}
            aria-label="New Project Name"
            placeholder="New Project"
          />
          <select
            value={newProjectAreaId}
            onChange={(event) => setNewProjectAreaId(event.target.value)}
            aria-label="New Project Area"
            className="h-10 min-w-0 max-w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">No Area</option>
            {hierarchy.areas.map((area) => (
              <option key={area.id} value={area.id}>{area.title}</option>
            ))}
          </select>
          <Button
            type="submit"
            variant="outline-success"
            size="icon"
            disabled={creatingProject || !newProjectTitle.trim()}
            aria-label="Add Project"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {hierarchy.areas.length === 0 && unassigned.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No Areas or Projects</p>
      ) : (
        <div className="space-y-7">
          {hierarchy.areas.map((area, index) => (
            <AreaSection
              key={area.id}
              area={area}
              areas={hierarchy.areas}
              projects={hierarchy.projects.filter((project) => project.area_id === area.id)}
              onRename={(title) => hierarchy.updateArea(area.id, { title })}
              onMoveUp={index > 0 ? () => hierarchy.reorderArea(area.id, 'up') : undefined}
              onMoveDown={index < hierarchy.areas.length - 1
                ? () => hierarchy.reorderArea(area.id, 'down')
                : undefined}
              onRenameProject={(project, title) => hierarchy.updateProject(project.id, { title })}
              onMoveProject={(project, areaId) => hierarchy.moveProjectToArea(project.id, areaId)}
              onReorderProject={(project, direction) => (
                hierarchy.reorderProject(project.id, direction)
              )}
              areaHref={`${basePath}/areas/${area.id}`}
              projectHref={(project) => `${basePath}/projects/${project.id}`}
              onNavigate={navigate}
            />
          ))}
          {unassigned.length > 0 ? (
            <AreaSection
              area={null}
              areas={hierarchy.areas}
              projects={unassigned}
              onRenameProject={(project, title) => hierarchy.updateProject(project.id, { title })}
              onMoveProject={(project, areaId) => hierarchy.moveProjectToArea(project.id, areaId)}
              onReorderProject={(project, direction) => (
                hierarchy.reorderProject(project.id, direction)
              )}
              projectHref={(project) => `${basePath}/projects/${project.id}`}
              onNavigate={navigate}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function AreaSection({
  area,
  areas,
  projects,
  onRename,
  onMoveUp,
  onMoveDown,
  onRenameProject,
  onMoveProject,
  onReorderProject,
  areaHref,
  projectHref,
  onNavigate,
}: {
  area: TaskArea | null;
  areas: TaskArea[];
  projects: TaskProject[];
  onRename?: (title: string) => Promise<unknown>;
  onMoveUp?: () => Promise<unknown>;
  onMoveDown?: () => Promise<unknown>;
  onRenameProject: (project: TaskProject, title: string) => Promise<unknown>;
  onMoveProject: (project: TaskProject, areaId: string | null) => Promise<unknown>;
  onReorderProject: (project: TaskProject, direction: 'up' | 'down') => Promise<unknown>;
  areaHref?: string;
  projectHref: (project: TaskProject) => string;
  onNavigate: ReturnType<typeof useNavigate>;
}) {
  const sectionId = `task-area-${area?.id ?? 'none'}`;
  return (
    <section aria-labelledby={sectionId}>
      <div className="mb-2 flex min-h-9 items-center gap-2">
        <FolderKanban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {area ? (
          <TaskHierarchyEditableTitle id={sectionId} value={area.title} onSave={onRename!} />
        ) : (
          <h3 id={sectionId} className="text-sm font-semibold text-muted-foreground">
            No Area ({projects.length})
          </h3>
        )}
        {area ? (
          <div className="ml-auto flex gap-1">
            <span className="self-center text-xs text-muted-foreground">{projects.length}</span>
            <a
              href={areaHref}
              aria-label={`Open ${area.title} Area`}
              onClick={(event) => handleClientSideLinkNavigation(
                event,
                onNavigate,
                areaHref!,
              )}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <TaskHierarchyOrderButton label={`Move ${area.title} Up`} icon={ArrowUp} action={onMoveUp} />
            <TaskHierarchyOrderButton label={`Move ${area.title} Down`} icon={ArrowDown} action={onMoveDown} />
          </div>
        ) : null}
      </div>
      <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
        {projects.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">No Projects</p>
        ) : projects.map((project, index) => (
          <div key={project.id} className="flex min-h-14 items-center gap-2 px-2 sm:px-4">
            <TaskHierarchyEditableTitle
              value={project.title}
              onSave={(title) => onRenameProject(project, title)}
            />
            {project.lifecycle !== 'open' ? (
              <span className="text-xs text-muted-foreground">
                {project.lifecycle === 'completed' ? 'Completed' : 'Canceled'}
              </span>
            ) : null}
            <a
              href={projectHref(project)}
              aria-label={`Open ${project.title}`}
              onClick={(event) => handleClientSideLinkNavigation(
                event,
                onNavigate,
                projectHref(project),
              )}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <select
              value={project.area_id ?? ''}
              onChange={(event) => {
                void onMoveProject(project, event.target.value || null).catch((error) => {
                  showError('Project Could Not Be Moved', error);
                });
              }}
              aria-label={`Area for ${project.title}`}
              className="h-9 min-w-0 max-w-36 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">No Area</option>
              {areas.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.title}</option>
              ))}
            </select>
            <TaskHierarchyOrderButton
              label={`Move ${project.title} Up`}
              icon={ArrowUp}
              action={index > 0 ? () => onReorderProject(project, 'up') : undefined}
            />
            <TaskHierarchyOrderButton
              label={`Move ${project.title} Down`}
              icon={ArrowDown}
              action={index < projects.length - 1
                ? () => onReorderProject(project, 'down')
                : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function TaskHierarchyEditableTitle({
  id,
  value,
  onSave,
}: {
  id?: string;
  value: string;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(value);
  const [saving, setSaving] = useState(false);
  const titleButtonRef = useRef<HTMLButtonElement>(null);

  const restoreTitleFocus = () => {
    window.setTimeout(() => titleButtonRef.current?.focus(), 0);
  };

  const cancel = () => {
    setTitle(value);
    setEditing(false);
    restoreTitleFocus();
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle || saving) return;
    if (normalizedTitle === value) {
      cancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(normalizedTitle);
      setEditing(false);
      restoreTitleFocus();
    } catch (error) {
      showError('Name Could Not Be Saved', error);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        ref={titleButtonRef}
        id={id}
        type="button"
        onClick={() => {
          setTitle(value);
          setEditing(true);
        }}
        className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {value}
        <Pencil className="ml-2 inline h-3 w-3 text-muted-foreground" aria-hidden="true" />
      </button>
    );
  }

  return (
    <form
      className="flex min-w-0 flex-1 gap-1"
      onSubmit={save}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={saving}
        aria-label={`Rename ${value}`}
        className="h-9"
      />
      <Button
        type="submit"
        variant="clear"
        size="icon"
        disabled={saving || !title.trim()}
        aria-label="Save Name"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="clear"
        size="icon"
        disabled={saving}
        aria-label="Cancel Rename"
        onClick={cancel}
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
}

export function TaskHierarchyOrderButton({
  label,
  icon: Icon,
  action,
}: {
  label: string;
  icon: typeof ArrowUp;
  action?: () => Promise<unknown>;
}) {
  return (
    <Button
      type="button"
      variant="clear"
      size="icon"
      disabled={!action}
      aria-label={label}
      className="h-9 w-9"
      onClick={() => {
        void action?.().catch((error) => showError('Order Could Not Be Saved', error));
      }}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function showError(title: string, error: unknown) {
  toast({
    title,
    description: error instanceof Error ? error.message : 'Unknown error',
    variant: 'destructive',
  });
}
