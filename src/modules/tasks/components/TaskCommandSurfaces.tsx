import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import { DatePickerField } from '@/components/ui/date-picker-field';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { addTaskCalendarDays } from '@/modules/tasks/domain/taskDates';
import { resolveTaskReminderTimeInput } from '@/modules/tasks/domain/taskReminderTimeInput';
import type { EditableTaskPatch } from '@/modules/tasks/data/taskRepository';
import { isMacLikeTaskPlatform } from '@/modules/tasks/domain/taskSelection';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskBulkCommandMode = 'start' | 'deadline' | 'organization' | 'reminder';

export function TaskBulkCommandDialog({
  mode,
  selectedCount,
  pending,
  hierarchy,
  planningDate,
  reminderTimeZone,
  reminderIncludesToday,
  onOpenChange,
  onApplyDate,
  onApplyOrganization,
  onApplyReminder,
}: {
  mode: TaskBulkCommandMode | null;
  selectedCount: number;
  pending: boolean;
  hierarchy: TaskHierarchyModel;
  planningDate: string;
  reminderTimeZone: string;
  reminderIncludesToday: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyDate: (value: string) => Promise<void>;
  onApplyOrganization: (patch: EditableTaskPatch) => Promise<void>;
  onApplyReminder: (localTime: string) => Promise<void>;
}) {
  const [reminderTime, setReminderTime] = useState('');
  const [confirmedReminderTime, setConfirmedReminderTime] = useState<string | null>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const organizationRef = useRef<HTMLSelectElement>(null);
  const reminderRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (mode === null) return;
    const timer = window.setTimeout(() => {
      if (mode === 'start' || mode === 'deadline') dateRef.current?.click();
      else if (mode === 'organization') organizationRef.current?.focus();
      else reminderRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode]);
  useEffect(() => {
    if (mode !== 'reminder') {
      setReminderTime('');
      setConfirmedReminderTime(null);
    }
  }, [mode]);
  const resolveBulkReminderTime = () => {
    const resolved = resolveTaskReminderTimeInput(reminderTime, {
      today: reminderIncludesToday,
      timeZone: reminderTimeZone,
    });
    if (!resolved) {
      setReminderTime('');
      setConfirmedReminderTime(null);
      toast({
        title: 'Not Allowed.',
        duration: 1_800,
      });
      return null;
    }
    setReminderTime(resolved.displayTime);
    setConfirmedReminderTime(resolved.localTime);
    return resolved.localTime;
  };
  const submitBulkReminder = () => {
    const localTime = confirmedReminderTime ?? resolveBulkReminderTime();
    if (!localTime) return;
    void onApplyReminder(localTime);
  };
  const title = mode === 'start'
    ? "Set Start"
    : mode === 'deadline'
      ? 'Set Deadline'
      : mode === 'organization'
        ? 'Move Selected To'
        : 'Set Reminder Time';

  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent
        footerless
        className="shadow-none sm:max-w-sm"
        aria-describedby={undefined}
        data-task-bulk-selection-surface
      >
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Applies to {selectedCount} selected {selectedCount === 1 ? 'task' : 'tasks'}.
          </p>
          {mode === 'start' || mode === 'deadline' ? (
            <DatePickerField
              ref={dateRef}
              value=""
              onValueChange={(value) => void onApplyDate(value)}
              placeholder={mode === 'start' ? "Select Start" : 'Select Deadline'}
              aria-label={mode === 'start' ? "Start" : 'Deadline'}
              disabled={pending}
              minDate={mode === 'start' ? addTaskCalendarDays(planningDate, 1) : undefined}
              popoverAlign="center"
            />
          ) : mode === 'organization' ? (
            <select
              ref={organizationRef}
              defaultValue=""
              disabled={pending}
              aria-label="Area"
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return;
                const [kind, id] = value.split(':', 2);
                void onApplyOrganization(kind === 'area'
                  ? { area_id: id }
                  : { area_id: null });
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>Select an Area</option>
              <option value="none">No Area</option>
              {hierarchy.areas.length > 0 ? (
                <optgroup label="Areas">
                  {hierarchy.areas.map((area) => (
                    <option key={area.id} value={`area:${area.id}`}>{area.title}</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          ) : mode === 'reminder' ? (
            <div
              className="flex items-center gap-2"
            >
              <Input
                ref={reminderRef}
                type="text"
                inputMode="text"
                autoComplete="off"
                value={reminderTime}
                placeholder="No Reminder"
                aria-label="Reminder Time"
                data-bathos-field-return-owned="true"
                disabled={pending}
                className="w-32 shrink-0"
                onChange={(event) => {
                  setReminderTime(event.target.value);
                  setConfirmedReminderTime(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (confirmedReminderTime !== null) {
                    void onApplyReminder(confirmedReminderTime);
                    return;
                  }
                  resolveBulkReminderTime();
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!reminderTime.trim() || pending}
                onClick={submitBulkReminder}
              >
                Apply
              </Button>
            </div>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export type TaskTemporalAction = {
  label: string;
  run: () => Promise<void>;
};

export function TaskKeyboardHelpDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
}) {
  const platform = globalThis.navigator?.platform ?? '';
  const currentPlatform = isMacLikeTaskPlatform(platform)
    ? 'mac'
    : /Win/i.test(platform)
      ? 'windows'
      : null;
  const groups = [
    {
      label: 'Standard Actions',
      commands: [
        ['Undo a Task Change', '⌘Z / ⌃Z', '⌃Z / ⌥⇧Z'],
        ['Redo a Task Change', '⌘Y / ⌘⇧Z', '⌃Y / ⌃⇧Z'],
        ['Select All Visible Tasks', '⌘A', '⌃A'],
        ['Duplicate Focused, Open, or Selected Tasks', '⌘D', '⌃D'],
        ['Cut Focused or Selected Tasks', '⌘X', '⌃X'],
        ['Copy Focused or Selected Tasks', '⌘C', '⌃C'],
        ['Paste Tasks or Text', '⌘V', '⌃V'],
        ['Close Open Task', '⌘Return / ⌘Escape', '⌃Return'],
        ['Show Keyboard Commands', '⌘/', '⌃/'],
      ],
    },
    {
      label: 'View Navigation',
      commands: [
        ['Open Today', '⌘1', '⌃1'],
        ['Open Upcoming', '⌘2', '⌃2'],
        ['Open Anytime', '⌘3', '⌃3'],
        ['Open Someday', '⌘4', '⌃4'],
        ['Open Done', '⌘5', '⌃5'],
        ['Open Config', '⌘6', '⌃6'],
      ],
    },
    {
      label: 'Tasks-Specific Actions',
      commands: [
        ['Open/Close Task', '⌃Q', '⌥⇧Q'],
        ['Open Previous Task', '⌃W', '⌥⇧W'],
        ['Choose Start', '⌃E', '⌥⇧E'],
        ['Cycle Day Horizon', '⌃R', '⌥⇧R'],
        ['Clear Start', '⌃T', '⌥⇧T'],
        ['New Task', '⌃A', '⌥⇧A'],
        ['Open Next Task', '⌃S', '⌥⇧S'],
        ['Choose Deadline', '⌃D', '⌥⇧D'],
        ['Cycle Actionability', '⌃F', '⌥⇧F'],
        ['Set Start to Someday', '⌃G', '⌥⇧G'],
        ['Toggle Done', '⌃X', '⌥⇧X'],
        ['Edit Checklist', '⌃C', '⌥⇧C'],
        ['Choose Area', '⌃V', '⌥⇧V'],
        ['Edit Reminder Time', '⌃B', '⌥⇧B'],
      ],
    },
    {
      label: 'Pointer and Navigation',
      commands: [
        ['Focus or Advance Through Tasks', 'Space', 'Space'],
        ['Move Back Through Tasks', '⇧Space', '⇧Space'],
        ['Move Task Focus', '▲ or ▼', '▲ or ▼'],
        ['Traverse Page Controls', 'Tab or ⇧Tab', 'Tab or ⇧Tab'],
        ['Select Multiple', '⌘Click', '⌃Click'],
        ['Select Range', '⇧Click', '⇧Click'],
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        footerless
        className="shadow-none focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader><DialogTitle>Keyboard Commands</DialogTitle></DialogHeader>
        <DialogBody className="space-y-5 pt-4">
          {groups.map((group) => {
            const headingId = `task-keyboard-${group.label.toLocaleLowerCase().replaceAll(' ', '-')}`;
            return (
              <section key={group.label} aria-labelledby={headingId}>
                <h3
                  id={headingId}
                  className="mb-2 text-xs font-semibold text-muted-foreground"
                >
                  {group.label}
                </h3>
                <div className="overflow-x-auto border-y border-[hsl(var(--grid-sticky-line))]">
                  <table className="w-full min-w-[30rem] table-fixed text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-[hsl(var(--grid-sticky-line))]">
                        <th scope="col" className="w-[45%] py-2 pr-3 font-medium">Action</th>
                        <th scope="col" className="w-[27.5%] px-2 py-2 font-medium">
                          Mac{currentPlatform === 'mac' ? ' · Current' : ''}
                        </th>
                        <th scope="col" className="w-[27.5%] py-2 pl-2 font-medium">
                          Windows{currentPlatform === 'windows' ? ' · Current' : ''}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--grid-sticky-line))]">
                      {group.commands.map(([description, macKeys, windowsKeys]) => (
                        <tr key={description}>
                          <th scope="row" className="py-2 pr-3 font-normal text-foreground">
                            {description}
                          </th>
                          <td className="px-2 py-2">
                            <kbd className="font-sans text-muted-foreground">{macKeys}</kbd>
                          </td>
                          <td className="py-2 pl-2">
                            <kbd className="font-sans text-muted-foreground">{windowsKeys}</kbd>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function TaskMoveDialog({
  open,
  task,
  hierarchy,
  onOpenChange,
  onCloseAutoFocus,
  onMove,
}: {
  open: boolean;
  task: TaskTodo;
  hierarchy: TaskHierarchyModel;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
  onMove: (patch: EditableTaskPatch) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const move = async (patch: EditableTaskPatch) => {
    if (pending) return;
    setPending(true);
    try {
      await onMove(patch);
      onOpenChange(false);
    } catch {
      // The task shell reports the error and keeps this surface available for retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent
        footerless
        className="shadow-none"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader><DialogTitle>Move Task</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4 pt-4">
          <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
          <div className="border-y border-[hsl(var(--grid-sticky-line))]">
            <TaskCommandButton
              label="No Area"
              current={!task.area_id}
              disabled={pending}
              onClick={() => void move({ area_id: null })}
            />
          </div>
          {hierarchy.areas.length > 0 ? (
            <TaskCommandGroup label="Areas">
              {hierarchy.areas.map((area) => (
                <TaskCommandButton
                  key={area.id}
                  label={area.title}
                  current={task.area_id === area.id}
                  disabled={pending}
                  onClick={() => void move({ area_id: area.id })}
                />
              ))}
            </TaskCommandGroup>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function TaskDoDialog({
  open,
  task,
  actions,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  task: TaskTodo;
  actions: TaskTemporalAction[];
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
}) {
  const [pending, setPending] = useState(false);
  const apply = async (action: TaskTemporalAction) => {
    if (pending) return;
    setPending(true);
    try {
      await action.run();
      onOpenChange(false);
    } catch {
      // The task shell reports the error and keeps this surface available for retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent
        footerless
        className="shadow-none"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader><DialogTitle>Do</DialogTitle></DialogHeader>
        <DialogBody className="space-y-5 pt-4">
          <p className="mb-4 truncate text-sm font-medium text-foreground">{task.title}</p>
          <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
            {actions.map((action) => (
              <TaskCommandButton
                key={action.label}
                label={action.label}
                disabled={pending}
                onClick={() => void apply(action)}
              />
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function TaskBulkWhenDialog({
  open,
  selectedCount,
  actions,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  selectedCount: number;
  actions: TaskTemporalAction[];
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
}) {
  const [pending, setPending] = useState(false);
  const apply = async (action: TaskTemporalAction) => {
    if (pending) return;
    setPending(true);
    try {
      await action.run();
      onOpenChange(false);
    } catch {
      // The task shell reports the error and keeps this surface available for retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent
        footerless
        data-task-bulk-selection-surface
        className="shadow-none"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader><DialogTitle>Plan Selected Tasks</DialogTitle></DialogHeader>
        <DialogBody className="pt-4">
          <p className="mb-4 text-sm font-medium text-foreground">
            {selectedCount} {selectedCount === 1 ? 'Task' : 'Tasks'}
          </p>
          <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
            {actions.map((action) => (
              <TaskCommandButton
                key={action.label}
                label={action.label}
                disabled={pending || selectedCount === 0}
                onClick={() => void apply(action)}
              />
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function TaskCommandGroup({ label, children }: { label: string; children: ReactNode }) {
  const headingId = `task-command-${label.toLocaleLowerCase().replaceAll(' ', '-')}`;
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-1 text-xs font-semibold text-muted-foreground">
        {label}
      </h3>
      <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
        {children}
      </div>
    </section>
  );
}

function TaskCommandButton({
  label,
  current = false,
  disabled,
  nested = false,
  onClick,
}: {
  label: string;
  current?: boolean;
  disabled: boolean;
  nested?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="clear"
      disabled={disabled || current}
      aria-current={current ? 'true' : undefined}
      onClick={onClick}
      className={`h-auto min-h-10 w-full justify-start rounded-none px-2 py-2 text-left ${
        nested ? 'pl-6 text-muted-foreground' : ''
      }`}
    >
      {label}{current ? ' (Current)' : ''}
    </Button>
  );
}
