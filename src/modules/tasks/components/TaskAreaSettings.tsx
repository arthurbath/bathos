import { useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';
import {
  TaskHierarchyEditableTitle,
  TaskHierarchyOrderButton,
} from '@/modules/tasks/components/TaskProjectsView';
import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';

export function TaskAreaSettings({ hierarchy }: { hierarchy: TaskHierarchyModel }) {
  const [newAreaTitle, setNewAreaTitle] = useState('');
  const [creatingArea, setCreatingArea] = useState(false);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [deletingAreaId, setDeletingAreaId] = useState<string | null>(null);
  const [deletingArea, setDeletingArea] = useState(false);
  const addAreaButtonRef = useRef<HTMLButtonElement>(null);
  const deletingAreaRecord = hierarchy.areas.find(({ id }) => id === deletingAreaId);

  const createArea = async (event: FormEvent) => {
    event.preventDefault();
    if (!newAreaTitle.trim() || creatingArea) return;
    setCreatingArea(true);
    try {
      await hierarchy.createArea(newAreaTitle);
      setNewAreaTitle('');
      setAreaDialogOpen(false);
    } catch (error) {
      showError('Area Could Not Be Added', error);
    } finally {
      setCreatingArea(false);
    }
  };

  const deleteArea = async () => {
    if (!deletingAreaId || deletingArea) return;
    setDeletingArea(true);
    try {
      await hierarchy.deleteHierarchy('area', deletingAreaId);
      setDeletingAreaId(null);
    } catch (error) {
      showError('Area Could Not Be Deleted', error);
    } finally {
      setDeletingArea(false);
    }
  };

  return (
    <>
      <section
        aria-labelledby="task-config-areas"
        className="rounded-md border border-[hsl(var(--grid-sticky-line))] p-4"
      >
        <div className="flex min-h-8 items-center gap-3">
          <TASK_ICONS.Area
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <h3 id="task-config-areas" className="text-sm font-semibold text-foreground">
            Areas
          </h3>
          <Button
            ref={addAreaButtonRef}
            type="button"
            variant="outline-success"
            size="sm"
            className="ml-auto h-8 w-8 p-0"
            aria-label="Add Area"
            title="Add Area"
            disabled={hierarchy.loading || hierarchy.error !== null}
            onClick={() => setAreaDialogOpen(true)}
          >
            <TASK_ICONS.AddArea className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {hierarchy.loading ? (
          <div className="flex min-h-16 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : hierarchy.error ? (
          <p role="alert" className="pt-4 text-sm text-destructive">
            Areas Could Not Be Loaded
          </p>
        ) : hierarchy.areas.length === 0 ? (
          <p className="pt-4 text-sm text-muted-foreground">No areas</p>
        ) : (
          <div className="mt-4 divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
            {hierarchy.areas.map((area, index) => (
              <div key={area.id} className="flex min-h-12 items-center gap-1 px-1 sm:px-2">
                <TaskHierarchyEditableTitle
                  value={area.title}
                  onSave={(title) => hierarchy.updateArea(area.id, { title })}
                />
                <TaskHierarchyOrderButton
                  label={`Move ${area.title} Up`}
                  icon={ArrowUp}
                  action={index > 0 ? () => hierarchy.reorderArea(area.id, 'up') : undefined}
                />
                <TaskHierarchyOrderButton
                  label={`Move ${area.title} Down`}
                  icon={ArrowDown}
                  action={index < hierarchy.areas.length - 1
                    ? () => hierarchy.reorderArea(area.id, 'down')
                    : undefined}
                />
                <Button
                  type="button"
                  variant="clear"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  aria-label={`Delete ${area.title}`}
                  onClick={() => setDeletingAreaId(area.id)}
                >
                  <TASK_ICONS.Delete className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={areaDialogOpen}
        onOpenChange={(open) => {
          if (!open && creatingArea) return;
          setAreaDialogOpen(open);
          if (!open) setNewAreaTitle('');
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            addAreaButtonRef.current?.focus();
          }}
        >
          <DialogHeader><DialogTitle>Add Area</DialogTitle></DialogHeader>
          <form data-bathos-return-submits="true" className="contents" onSubmit={createArea}>
            <DialogBody className="space-y-2 pt-4">
              <label htmlFor="new-task-area-title" className="text-sm font-medium text-foreground">
                Name <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <Input
                id="new-task-area-title"
                autoFocus
                value={newAreaTitle}
                onChange={(event) => setNewAreaTitle(event.target.value)}
                disabled={creatingArea}
                autoComplete="off"
              />
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={creatingArea}
                onClick={() => setAreaDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingArea || !newAreaTitle.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingAreaId !== null}
        onOpenChange={(open) => {
          if (!open && !deletingArea) setDeletingAreaId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Area</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody>
            <AlertDialogDescription>
              {deletingAreaRecord
                ? `${deletingAreaRecord.title}, its projects, tasks, and checklist items will move to Done together.`
                : 'The area and its contents will move to Done together.'}
            </AlertDialogDescription>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingArea}>Keep Area</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingArea}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void deleteArea();
              }}
            >
              Move to Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function showError(title: string, error: unknown) {
  toast({
    title,
    description: error instanceof Error ? error.message : 'Unknown error',
    variant: 'destructive',
  });
}
