import { format } from 'date-fns';
import {
  Bell,
  CalendarDays,
  Clock2,
  Clock5,
  Clock8,
  Inbox,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  parseDatePickerFieldValue,
  toDatePickerFieldValue,
} from '@/components/ui/date-picker-field';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { addTaskCalendarDays } from '@/modules/tasks/domain/taskDates';
import type {
  TaskReminder,
  TaskTodaySection,
  TaskTodo,
} from '@/modules/tasks/types/tasks';
import {
  TASK_START_PICKER_OPEN_EVENT,
  type TaskStartPickerFocusTarget,
} from './taskStartPickerEvents';

type PlanningSelection = {
  startDate: string | null;
  todaySection: TaskTodaySection | null;
};

type TaskStartPickerProps = {
  task: Pick<TaskTodo, 'id' | 'title' | 'start_date' | 'today_section'>;
  reminder: TaskReminder | null;
  reminderTime: string;
  ambiguityChoice: 'earlier' | 'later';
  reminderTimeZone: string;
  reminderDisabled: boolean;
  reminderUnavailableMessage?: string | null;
  planningDate: string;
  onPlanningChange: (selection: PlanningSelection) => Promise<void>;
  onReminderChange: (localTime: string) => Promise<void>;
  onAmbiguityChange: (choice: 'earlier' | 'later') => Promise<void>;
  onClear: () => Promise<void>;
};

const todayChoices: Array<{
  value: TaskTodaySection;
  label: string;
  Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
  { value: 'inbox', label: 'Inbox', Icon: Inbox },
  { value: 'now', label: 'Now', Icon: Clock2 },
  { value: 'next', label: 'Next', Icon: Clock5 },
  { value: 'later', label: 'Later', Icon: Clock8 },
];

function TaskStartPickerPanel({
  task,
  reminder,
  reminderTime,
  ambiguityChoice,
  reminderTimeZone,
  reminderDisabled,
  reminderUnavailableMessage,
  planningDate,
  onPlanningChange,
  onReminderChange,
  onAmbiguityChange,
  onClear,
  focusTarget,
  active,
}: TaskStartPickerProps & {
  focusTarget: TaskStartPickerFocusTarget;
  active: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reminderRef = useRef<HTMLInputElement>(null);
  const firstHorizonRef = useRef<HTMLButtonElement>(null);
  const selectedDate = parseDatePickerFieldValue(task.start_date ?? undefined);
  const minimumDateValue = addTaskCalendarDays(planningDate, 1);
  const minimumDate = parseDatePickerFieldValue(minimumDateValue);
  const visibleMonth = selectedDate ?? minimumDate ?? new Date();
  const planned = task.start_date !== null || task.today_section !== null;

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      if (focusTarget === 'reminder') {
        reminderRef.current?.focus();
        return;
      }
      const selectedHorizon = panelRef.current?.querySelector<HTMLButtonElement>(
        '[data-task-start-horizon][aria-pressed="true"]',
      );
      const selectedDay = panelRef.current?.querySelector<HTMLButtonElement>(
        'button[name="day"][aria-selected="true"]',
      );
      (selectedHorizon ?? selectedDay ?? firstHorizonRef.current)?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [active, focusTarget]);

  return (
    <div ref={panelRef} className="w-[min(20rem,calc(100vw-2rem))]" data-task-start-picker>
      <div className="space-y-2 p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Today
        </div>
        <div className="grid grid-cols-4 gap-1">
          {todayChoices.map(({ value, label, Icon }, index) => {
            const selected = task.start_date === null && task.today_section === value;
            return (
              <Button
                key={value}
                ref={index === 0 ? firstHorizonRef : undefined}
                type="button"
                variant="clear"
                aria-pressed={selected}
                data-task-start-horizon={value}
                className={cn(
                  'h-auto min-w-0 flex-col gap-1 px-1.5 py-2 text-xs',
                  selected && 'bg-accent text-accent-foreground',
                )}
                onClick={() => void onPlanningChange({
                  startDate: null,
                  todaySection: value,
                })}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="truncate">{label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[hsl(var(--grid-sticky-line))]">
        <Calendar
          mode="single"
          selected={selectedDate}
          disabled={minimumDate ? { before: minimumDate } : undefined}
          defaultMonth={visibleMonth}
          onSelect={(date) => {
            if (!date) return;
            void onPlanningChange({
              startDate: toDatePickerFieldValue(date),
              todaySection: task.today_section ?? 'next',
            });
          }}
          allowTabExit
          className="mx-auto"
        />
      </div>

      <div className="space-y-3 border-t border-[hsl(var(--grid-sticky-line))] p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Bell className="h-4 w-4" aria-hidden />
          <label htmlFor={`task-start-reminder-${task.id}`}>Reminder</label>
        </div>
        <Input
          ref={reminderRef}
          id={`task-start-reminder-${task.id}`}
          type="time"
          value={reminderTime}
          aria-label="Reminder Time"
          disabled={reminderDisabled || !planned}
          onChange={(event) => void onReminderChange(event.target.value)}
        />
        {reminderUnavailableMessage ? (
          <p className="text-xs text-warning">{reminderUnavailableMessage}</p>
        ) : null}
        {reminderTime && !reminderDisabled && planned ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor={`task-start-ambiguity-${task.id}`}
              >
                Repeated Time
              </label>
              <select
                id={`task-start-ambiguity-${task.id}`}
                value={ambiguityChoice}
                onChange={(event) => void onAmbiguityChange(
                  event.target.value as 'earlier' | 'later',
                )}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="earlier">Earlier</option>
                <option value="later">Later</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Time Zone</span>
              <p className="flex h-9 items-center truncate text-xs text-muted-foreground">
                {reminderTimeZone}
              </p>
            </div>
          </div>
        ) : null}
        {reminder?.resolution_kind === 'gap_forward' ? (
          <p className="text-xs text-warning">
            Adjusted to the first valid time after the daylight-saving gap.
          </p>
        ) : null}
      </div>

      <div className="border-t border-[hsl(var(--grid-sticky-line))] p-2">
        <Button
          type="button"
          variant="clear"
          className="w-full justify-start gap-2 text-muted-foreground"
          disabled={!planned && !reminderTime}
          onClick={() => void onClear()}
        >
          <X className="h-4 w-4" aria-hidden />
          Clear
        </Button>
      </div>
    </div>
  );
}

function getStartSummary(
  startDate: string | null,
  todaySection: TaskTodaySection | null,
): string {
  if (startDate) {
    const date = parseDatePickerFieldValue(startDate);
    return date ? format(date, 'MMM d, yyyy') : startDate;
  }
  if (todaySection) {
    const label = todayChoices.find((choice) => choice.value === todaySection)?.label;
    return `Today · ${label ?? todaySection}`;
  }
  return 'No Start';
}

export function TaskStartPickerField(props: TaskStartPickerProps) {
  const [open, setOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<TaskStartPickerFocusTarget>('start');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const summary = useMemo(
    () => getStartSummary(props.task.start_date, props.task.today_section),
    [props.task.start_date, props.task.today_section],
  );

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const handleRequest = (event: Event) => {
      const request = event as CustomEvent<TaskStartPickerFocusTarget>;
      setFocusTarget(request.detail === 'reminder' ? 'reminder' : 'start');
      setOpen(true);
    };
    trigger.addEventListener(TASK_START_PICKER_OPEN_EVENT, handleRequest);
    return () => trigger.removeEventListener(TASK_START_PICKER_OPEN_EVENT, handleRequest);
  }, []);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setFocusTarget('start');
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          id={`task-start-${props.task.id}`}
          type="button"
          variant="outline"
          aria-label="Start"
          className={cn(
            'h-10 w-full justify-start rounded-md border-[hsl(var(--grid-sticky-line))] bg-background px-3 text-left font-normal hover:bg-background',
            props.task.start_date === null
              && props.task.today_section === null
              && 'text-muted-foreground',
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{summary}</span>
          {props.reminderTime ? (
            <Bell
              className="ml-auto h-4 w-4 shrink-0 text-info"
              aria-label={`Reminder ${props.reminderTime}`}
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0 shadow-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <TaskStartPickerPanel {...props} focusTarget={focusTarget} active={open} />
      </PopoverContent>
    </Popover>
  );
}

export function TaskStartDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  ...props
}: TaskStartPickerProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-auto max-w-[calc(100vw-2rem)] p-0 shadow-none sm:max-w-none"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Start</DialogTitle>
        </DialogHeader>
        <DialogBody className="p-0">
          <p className="truncate px-4 pb-3 text-sm font-medium text-foreground">
            {props.task.title}
          </p>
          <TaskStartPickerPanel
            {...props}
            focusTarget="start"
            active={open}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
