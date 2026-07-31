import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type PointerEventHandler,
} from 'react';
import { ArrowDown, ArrowUp, MoreHorizontal } from 'lucide-react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DataGrid,
  GridEditableCell,
  gridMenuTriggerProps,
  useDataGrid,
} from '@/components/ui/data-grid';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { toast } from '@/hooks/use-toast';
import {
  GRID_ACTIONS_COLUMN_ID,
  GRID_FIXED_COLUMNS,
  GRID_MIN_COLUMN_WIDTH,
  TASKS_AREAS_GRID_DEFAULT_WIDTHS,
} from '@/lib/gridColumnWidths';
import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import type { TaskArea } from '@/modules/tasks/types/tasks';

const taskAreaColumnHelper = createColumnHelper<TaskArea>();
const TASK_AREAS_GRID_HISTORY_KEY = 'tasks_areas_config';
const GRID_CONTROL_FOCUS_CLASS = 'focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0';

type TaskAreaActionsTriggerProps = ComponentPropsWithoutRef<typeof Button> & {
  navCol: number;
  ariaLabel: string;
};

const TaskAreaActionsTrigger = forwardRef<HTMLButtonElement, TaskAreaActionsTriggerProps>(
  function TaskAreaActionsTrigger({
    navCol,
    ariaLabel,
    onKeyDown,
    onMouseDown,
    onPointerDown,
    ...props
  }, ref) {
    const grid = useDataGrid();
    const navProps = gridMenuTriggerProps(grid, navCol) as ComponentPropsWithoutRef<typeof Button>;

    const handleKeyDown: KeyboardEventHandler<HTMLButtonElement> = (event) => {
      (navProps.onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined)?.(event);
      if (!event.defaultPrevented) onKeyDown?.(event);
    };
    const handleMouseDown: MouseEventHandler<HTMLButtonElement> = (event) => {
      (navProps.onMouseDown as MouseEventHandler<HTMLButtonElement> | undefined)?.(event);
      if (!event.defaultPrevented) onMouseDown?.(event);
    };
    const handlePointerDown: PointerEventHandler<HTMLButtonElement> = (event) => {
      (navProps.onPointerDown as PointerEventHandler<HTMLButtonElement> | undefined)?.(event);
      if (!event.defaultPrevented) onPointerDown?.(event);
    };

    return (
      <Button
        ref={ref}
        type="button"
        variant="outline"
        size="icon"
        className={`float-right mr-[5px] h-7 w-7 ${GRID_CONTROL_FOCUS_CLASS}`}
        aria-label={ariaLabel}
        {...props}
        {...navProps}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onPointerDown={handlePointerDown}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </Button>
    );
  },
);

export function TaskAreaSettings({
  hierarchy,
  userId,
}: {
  hierarchy: TaskHierarchyModel;
  userId?: string;
}) {
  const [newAreaTitle, setNewAreaTitle] = useState('');
  const [creatingArea, setCreatingArea] = useState(false);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [deletingAreaId, setDeletingAreaId] = useState<string | null>(null);
  const [deletingArea, setDeletingArea] = useState(false);
  const addAreaButtonRef = useRef<HTMLButtonElement>(null);
  const deletingAreaRecord = hierarchy.areas.find(({ id }) => id === deletingAreaId);
  const {
    columnSizing,
    columnSizingInfo,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'tasks_areas',
    defaults: TASKS_AREAS_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.tasks_areas,
  });

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

  const renameArea = useCallback(async (area: TaskArea, nextValue: string) => {
    const title = nextValue.trim();
    if (title === area.title) return;
    if (!title) {
      const error = new Error('Name is required.');
      showError('Area Could Not Be Renamed', error);
      throw error;
    }
    try {
      await hierarchy.updateArea(area.id, { title });
    } catch (error) {
      showError('Area Could Not Be Renamed', error);
      throw error;
    }
  }, [hierarchy]);

  const reorderArea = useCallback(async (
    area: TaskArea,
    direction: 'up' | 'down',
  ) => {
    try {
      await hierarchy.reorderArea(area.id, direction);
    } catch (error) {
      showError('Area Could Not Be Moved', error);
    }
  }, [hierarchy]);

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

  const columns = useMemo(() => [
    taskAreaColumnHelper.accessor('title', {
      id: 'name',
      header: 'Name',
      size: TASKS_AREAS_GRID_DEFAULT_WIDTHS.name,
      minSize: GRID_MIN_COLUMN_WIDTH,
      meta: { containsEditableInput: true },
      cell: ({ row }) => (
        <GridEditableCell
          value={row.original.title}
          navCol={0}
          onChange={(nextValue) => renameArea(row.original, nextValue)}
        />
      ),
    }),
    taskAreaColumnHelper.display({
      id: GRID_ACTIONS_COLUMN_ID,
      header: '',
      enableSorting: false,
      enableResizing: false,
      size: TASKS_AREAS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
      minSize: TASKS_AREAS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
      maxSize: TASKS_AREAS_GRID_DEFAULT_WIDTHS[GRID_ACTIONS_COLUMN_ID],
      meta: { headerClassName: 'px-0', cellClassName: 'px-0', containsButton: true },
      cell: ({ row }) => {
        const area = row.original;
        const index = hierarchy.areas.findIndex(({ id }) => id === area.id);
        const canMoveUp = index > 0;
        const canMoveDown = index >= 0 && index < hierarchy.areas.length - 1;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <TaskAreaActionsTrigger
                navCol={1}
                ariaLabel={`Actions for ${area.title}`}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              {canMoveUp ? (
                <DropdownMenuItem onSelect={() => void reorderArea(area, 'up')}>
                  <ArrowUp className="mr-2 h-4 w-4" aria-hidden="true" />
                  Move Up
                </DropdownMenuItem>
              ) : null}
              {canMoveDown ? (
                <DropdownMenuItem onSelect={() => void reorderArea(area, 'down')}>
                  <ArrowDown className="mr-2 h-4 w-4" aria-hidden="true" />
                  Move Down
                </DropdownMenuItem>
              ) : null}
              {canMoveUp || canMoveDown ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeletingAreaId(area.id)}
              >
                <TASK_ICONS.Delete className="mr-2 h-4 w-4" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ], [hierarchy.areas, renameArea, reorderArea]);

  const table = useReactTable({
    data: hierarchy.areas,
    columns,
    defaultColumn: { minSize: GRID_MIN_COLUMN_WIDTH },
    state: { columnSizing, columnSizingInfo },
    enableColumnResizing: columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <Card aria-labelledby="task-config-areas">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle id="task-config-areas">Areas</CardTitle>
            <Button
              ref={addAreaButtonRef}
              type="button"
              variant="outline-success"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Add Area"
              title="Add Area"
              disabled={hierarchy.loading || hierarchy.error !== null}
              onClick={() => setAreaDialogOpen(true)}
            >
              <TASK_ICONS.AddArea className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2.5">
          {hierarchy.loading ? (
            <div className="flex min-h-16 items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : hierarchy.error ? (
            <p role="alert" className="py-4 text-center text-sm text-destructive">
              Areas Could Not Be Loaded
            </p>
          ) : hierarchy.areas.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No areas</p>
          ) : (
            <DataGrid
              table={table}
              historyKey={TASK_AREAS_GRID_HISTORY_KEY}
              maxHeight="none"
              stickyFirstColumn={false}
            />
          )}
        </CardContent>
      </Card>

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
                ? `${deletingAreaRecord.title}, its tasks, and checklist items will move to Done together.`
                : 'The area and its contents will move to Done together.'}
            </AlertDialogDescription>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingArea}>Keep Area</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingArea}
              className="bg-destructive text-destructive-foreground "
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
