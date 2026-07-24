import { format } from 'date-fns';
import {
  Bell,
  CalendarIcon,
  Clock2,
  Clock5,
  Clock8,
  Inbox,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { addTaskCalendarDays } from '@/modules/tasks/domain/taskDates';
import {
  formatTaskReminderTimeDisplay,
  resolveTaskReminderTimeInput,
} from '@/modules/tasks/domain/taskReminderTimeInput';
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
  reminderTimeZone: string;
  reminderDisabled: boolean;
  reminderUnavailableMessage?: string | null;
  planningDate: string;
  onPlanningChange: (selection: PlanningSelection) => Promise<void>;
  onReminderChange: (localTime: string) => Promise<void>;
  onClear: () => Promise<void>;
};

const todayChoices: Array<{
  value: TaskTodaySection;
  label: string;
  Icon: LucideIcon;
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
  reminderTimeZone,
  reminderDisabled,
  reminderUnavailableMessage,
  planningDate,
  onPlanningChange,
  onReminderChange,
  onClear,
  focusTarget,
  active,
  onRequestClose,
}: TaskStartPickerProps & {
  focusTarget: TaskStartPickerFocusTarget;
  active: boolean;
  onRequestClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reminderRef = useRef<HTMLInputElement>(null);
  const firstHorizonRef = useRef<HTMLButtonElement>(null);
  const selectedDate = parseDatePickerFieldValue(task.start_date ?? undefined);
  const minimumDateValue = addTaskCalendarDays(planningDate, 1);
  const minimumDate = parseDatePickerFieldValue(minimumDateValue);
  const planningToday = parseDatePickerFieldValue(planningDate);
  const visibleMonth = selectedDate ?? minimumDate ?? new Date();
  const planned = task.start_date !== null || task.today_section !== null;
  const committedReminderDisplay = formatTaskReminderTimeDisplay(reminderTime) ?? '';
  const [reminderInput, setReminderInput] = useState(committedReminderDisplay);
  const reminderInputConfirmedRef = useRef(true);
  const keyboardDateConfirmationRef = useRef(false);

  useEffect(() => {
    if (document.activeElement === reminderRef.current) return;
    setReminderInput(committedReminderDisplay);
    reminderInputConfirmedRef.current = true;
  }, [committedReminderDisplay]);

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

  const focusSelectedHorizon = () => {
    const selectedHorizon = panelRef.current?.querySelector<HTMLButtonElement>(
      '[data-task-start-horizon][aria-pressed="true"]',
    );
    (selectedHorizon ?? firstHorizonRef.current)?.focus();
  };

  const focusCalendarDay = (position: 'first' | 'last') => {
    const days = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>(
      'button[name="day"]:not(:disabled)',
    ) ?? []).filter((button) => !button.className.includes('day-outside'));
    const selectedDay = days.find((button) => button.getAttribute('aria-selected') === 'true');
    (selectedDay ?? (position === 'first' ? days[0] : days.at(-1)))?.focus();
  };

  const focusCalendarHeader = () => {
    const caption = panelRef.current?.querySelector<HTMLButtonElement>(
      'button[name="caption-month-year"]',
    );
    if (caption) {
      caption.focus();
      return;
    }
    const previousYear = panelRef.current?.querySelector<HTMLButtonElement>(
      'button[name="previous-year"]:not(:disabled)',
    );
    const nextYear = panelRef.current?.querySelector<HTMLButtonElement>(
      'button[name="next-year"]:not(:disabled)',
    );
    (previousYear ?? nextYear)?.focus();
  };

  const handlePanelKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== 'ArrowLeft'
      && event.key !== 'ArrowRight'
      && event.key !== 'ArrowUp'
      && event.key !== 'ArrowDown'
    ) {
      return;
    }
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;

    const horizon = target.closest<HTMLButtonElement>('[data-task-start-horizon]');
    if (horizon) {
      const horizons = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-task-start-horizon]:not(:disabled)',
      ) ?? []);
      const index = horizons.indexOf(horizon);
      if (event.key === 'ArrowLeft' && index > 0) horizons[index - 1]?.focus();
      else if (event.key === 'ArrowRight' && index < horizons.length - 1) horizons[index + 1]?.focus();
      else if (event.key === 'ArrowDown') focusCalendarHeader();
      else return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (target === reminderRef.current) {
      if (event.key === 'ArrowUp') focusCalendarDay('last');
      else if (event.key === 'ArrowDown') {
        panelRef.current?.querySelector<HTMLButtonElement>('[data-task-start-clear]')?.focus();
      } else return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const clearButton = target.closest<HTMLButtonElement>('[data-task-start-clear]');
    if (clearButton && event.key === 'ArrowUp') {
      reminderRef.current?.focus();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const calendarHeader = target.closest<HTMLButtonElement>(
      'button[name="caption-month-year"], button[name="previous-month"], button[name="next-month"], button[name="previous-year"], button[name="next-year"]',
    );
    if (calendarHeader && event.key === 'ArrowUp') {
      focusSelectedHorizon();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const monthButton = target.closest<HTMLButtonElement>('button[name="month"]');
    if (monthButton && event.key === 'ArrowDown') {
      const months = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[name="month"]:not(:disabled)',
      ) ?? []);
      const index = months.indexOf(monthButton);
      if (index >= Math.max(0, months.length - 3)) {
        reminderRef.current?.focus();
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

  };

  const commitReminderInput = async (): Promise<boolean> => {
    const rawValue = reminderInput;
    if (!rawValue.trim()) {
      if (reminderTime) await onReminderChange('');
      setReminderInput('');
      reminderInputConfirmedRef.current = true;
      return true;
    }

    const resolved = resolveTaskReminderTimeInput(rawValue, {
      today: task.start_date === null,
      timeZone: reminderTimeZone,
    });
    if (!resolved) {
      setReminderInput(committedReminderDisplay);
      reminderInputConfirmedRef.current = true;
      toast({
        title: 'Not allowed.',
        duration: 1_800,
      });
      return false;
    }

    try {
      if (resolved.localTime !== reminderTime) {
        await onReminderChange(resolved.localTime);
      }
      setReminderInput(resolved.displayTime);
      reminderInputConfirmedRef.current = true;
      return true;
    } catch {
      setReminderInput(committedReminderDisplay);
      reminderInputConfirmedRef.current = true;
      return false;
    }
  };

  return (
    <div
      ref={panelRef}
      className="mx-auto w-[min(20rem,calc(100vw-2rem))]"
      data-task-start-picker
      onKeyDownCapture={handlePanelKeyDownCapture}
    >
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
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  event.stopPropagation();
                  void onPlanningChange({
                    startDate: null,
                    todaySection: value,
                  }).then(onRequestClose);
                }}
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
          fromDate={minimumDate}
          defaultMonth={visibleMonth}
          today={planningToday}
          initialFocusDate={selectedDate ?? minimumDate}
          onDayGridExitDown={() => {
            if (reminderRef.current?.disabled) return false;
            reminderRef.current?.focus();
            return Boolean(reminderRef.current);
          }}
          onKeyDownCapture={(event) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            if (target?.closest('button[name="day"]:not(:disabled)')) {
              keyboardDateConfirmationRef.current = event.key === 'Enter';
            }
          }}
          onSelect={(date) => {
            if (!date) return;
            const closeAfterSave = keyboardDateConfirmationRef.current;
            keyboardDateConfirmationRef.current = false;
            void onPlanningChange({
              startDate: toDatePickerFieldValue(date),
              todaySection: task.today_section ?? 'next',
            }).then(() => {
              if (closeAfterSave) onRequestClose();
            });
          }}
          allowTabExit
          className="mx-auto"
        />
      </div>

      <div className="space-y-3 border-t border-[hsl(var(--grid-sticky-line))] p-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
            <Bell className="h-4 w-4 shrink-0" aria-hidden />
            <label htmlFor={`task-start-reminder-${task.id}`}>Reminder</label>
          </div>
          <Input
            ref={reminderRef}
            id={`task-start-reminder-${task.id}`}
            type="text"
            inputMode="text"
            autoComplete="off"
            value={reminderInput}
            placeholder="No Reminder"
            aria-label="Reminder Time"
            disabled={reminderDisabled}
            className="ml-auto w-32 shrink-0"
            onChange={(event) => {
              reminderInputConfirmedRef.current = false;
              setReminderInput(event.target.value);
            }}
            onBlur={() => {
              if (!reminderInputConfirmedRef.current) void commitReminderInput();
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              event.stopPropagation();
              if (reminderInputConfirmedRef.current) {
                onRequestClose();
                return;
              }
              void commitReminderInput();
            }}
          />
        </div>
        {reminderUnavailableMessage ? (
          <p className="text-xs text-warning">{reminderUnavailableMessage}</p>
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
          data-task-start-clear
          className="w-full justify-start gap-2 text-muted-foreground"
          disabled={!planned && !reminderTime}
          onClick={() => {
            void onClear().then(onRequestClose);
          }}
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
          <span className="truncate">{summary}</span>
          {props.reminderTime ? (
            <Bell
              className="ml-auto h-4 w-4 shrink-0 text-info"
              aria-label={`Reminder ${props.reminderTime}`}
            />
          ) : null}
          <CalendarIcon
            className={cn(
              'h-4 w-4 shrink-0 text-foreground opacity-50',
              !props.reminderTime && 'ml-auto',
            )}
            aria-hidden
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0 shadow-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <TaskStartPickerPanel
          {...props}
          focusTarget={focusTarget}
          active={open}
          onRequestClose={() => setOpen(false)}
        />
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
        <DialogBody className="mx-0 p-0">
          <p className="truncate px-4 pb-3 text-sm font-medium text-foreground">
            {props.task.title}
          </p>
          <TaskStartPickerPanel
            {...props}
            focusTarget="start"
            active={open}
            onRequestClose={() => onOpenChange(false)}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
