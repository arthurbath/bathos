import {
  AlarmClock,
  CalendarIcon,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ControlDecoration } from '@/components/ui/control-decoration';
import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import {
  parseDatePickerFieldValue,
  toDatePickerFieldValue,
} from '@/components/ui/date-picker-field';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { focusAdjacentFormControl } from '@/platform/formInteractions';
import {
  addTaskCalendarDays,
  formatTaskDateControlLabel,
} from '@/modules/tasks/domain/taskDates';
import {
  formatTaskReminderTimeDisplay,
  listTaskReminderHourOptions,
  resolveTaskReminderTimeInput,
  type TaskReminderHourOption,
} from '@/modules/tasks/domain/taskReminderTimeInput';
import type {
  TaskReminder,
  TaskTodaySection,
  TaskTodo,
} from '@/modules/tasks/types/tasks';
import {
  TASK_START_PICKER_ADVANCE_EVENT,
  TASK_START_PICKER_OPEN_EVENT,
  type TaskStartPickerFocusTarget,
} from './taskStartPickerEvents';
import {
  getTaskHorizonPresentation,
  taskHorizonPresentations,
} from './taskHorizonPresentation';

export type PlanningSelection = {
  destination: TaskTodo['destination'];
  startDate: string | null;
  todaySection: TaskTodaySection | null;
};

export type TaskStartPickerProps = {
  task: Pick<TaskTodo, 'id' | 'title' | 'destination' | 'start_date' | 'today_section'>;
  reminder: TaskReminder | null;
  reminderTime: string;
  reminderTimeZone: string;
  reminderDisabled: boolean;
  reminderUnavailableMessage?: string | null;
  planningDate: string;
  onPlanningChange: (selection: PlanningSelection) => Promise<void>;
  onReminderChange: (localTime: string) => Promise<void>;
  onClear: () => Promise<void>;
  clearEnabled?: boolean;
};

export function TaskStartPickerPanel({
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
  clearEnabled,
  focusTarget,
  active,
  onRequestClose,
  onTabExit,
}: TaskStartPickerProps & {
  focusTarget: TaskStartPickerFocusTarget;
  active: boolean;
  onRequestClose: () => void;
  onTabExit: (backwards: boolean) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reminderRef = useRef<HTMLInputElement>(null);
  const reminderHourButtonRef = useRef<HTMLButtonElement>(null);
  const firstHorizonRef = useRef<HTMLButtonElement>(null);
  const initialFocusTimerRef = useRef<number | null>(null);
  const selectedDate = parseDatePickerFieldValue(task.start_date ?? undefined);
  const minimumDateValue = addTaskCalendarDays(planningDate, 1);
  const minimumDate = parseDatePickerFieldValue(minimumDateValue);
  const planningToday = parseDatePickerFieldValue(planningDate);
  const [calendarMonth, setCalendarMonth] = useState(
    () => selectedDate ?? minimumDate ?? new Date(),
  );
  const [calendarFocusDate, setCalendarFocusDate] = useState<Date | undefined>();
  const [calendarFocusRequestKey, setCalendarFocusRequestKey] = useState(0);
  const planned = clearEnabled ?? (task.destination === 'someday'
    || task.start_date !== null
    || task.today_section !== null);
  const committedReminderDisplay = formatTaskReminderTimeDisplay(reminderTime) ?? '';
  const [reminderInput, setReminderInput] = useState(committedReminderDisplay);
  const [reminderHourMenuOpen, setReminderHourMenuOpen] = useState(false);
  const [reminderHourNow, setReminderHourNow] = useState(() => new Date());
  const reminderInputConfirmedRef = useRef(true);
  const reminderCommitRef = useRef<Promise<boolean> | null>(null);
  const reminderUsesTodayRules = task.start_date === null
    || task.start_date === planningDate;
  const reminderHourOptions = useMemo(
    () => listTaskReminderHourOptions({
      today: reminderUsesTodayRules,
      timeZone: reminderTimeZone,
      now: reminderHourNow,
    }),
    [reminderHourNow, reminderTimeZone, reminderUsesTodayRules],
  );
  const reminderHourMenuDisabled = reminderDisabled || reminderHourOptions.length === 0;

  useEffect(() => {
    if (document.activeElement === reminderRef.current) return;
    setReminderInput(committedReminderDisplay);
    reminderInputConfirmedRef.current = true;
  }, [committedReminderDisplay]);

  useEffect(() => {
    if (!active) return undefined;
    setReminderHourNow(new Date());
    const timer = window.setInterval(() => setReminderHourNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [active]);

  const focusReminderInput = useCallback(() => {
    const input = reminderRef.current;
    if (!input || input.disabled) return false;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
    return true;
  }, []);

  const focusCurrentStartChoice = useCallback(() => {
    const selectedHorizon = panelRef.current?.querySelector<HTMLButtonElement>(
      '[data-task-start-horizon][aria-pressed="true"]',
    );
    const selectedDay = panelRef.current?.querySelector<HTMLButtonElement>(
      'button[name="day"][aria-selected="true"]',
    );
    const selectedSomeday = panelRef.current?.querySelector<HTMLButtonElement>(
      '[data-task-start-someday][aria-pressed="true"]',
    );
    (selectedHorizon ?? selectedDay ?? selectedSomeday ?? firstHorizonRef.current)?.focus();
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      initialFocusTimerRef.current = null;
      if (focusTarget === 'reminder') {
        focusReminderInput();
        return;
      }
      focusCurrentStartChoice();
    }, 0);
    initialFocusTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (initialFocusTimerRef.current === timer) initialFocusTimerRef.current = null;
    };
  }, [active, focusCurrentStartChoice, focusReminderInput, focusTarget]);

  useEffect(() => {
    if (!active) return;
    setCalendarMonth(
      parseDatePickerFieldValue(task.start_date ?? minimumDateValue) ?? new Date(),
    );
    setCalendarFocusDate(undefined);
    setCalendarFocusRequestKey(0);
  }, [active, minimumDateValue, task.start_date]);

  const focusCalendarDate = useCallback((date: Date) => {
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setCalendarFocusDate(date);
    setCalendarFocusRequestKey((requestKey) => requestKey + 1);
  }, []);

  const advanceStartFocus = useCallback(() => {
    const panel = panelRef.current;
    const activeElement = document.activeElement;
    if (!panel || !(activeElement instanceof HTMLElement) || !panel.contains(activeElement)) {
      focusCurrentStartChoice();
      return;
    }

    const horizon = activeElement.closest<HTMLButtonElement>('[data-task-start-horizon]');
    if (horizon) {
      if (minimumDate) focusCalendarDate(minimumDate);
      return;
    }

    const day = activeElement.closest<HTMLButtonElement>(
      'button[name="day"][data-calendar-date]',
    );
    const dateValue = day?.dataset.calendarDate;
    const date = parseDatePickerFieldValue(dateValue);
    if (date) {
      const nextDate = parseDatePickerFieldValue(
        addTaskCalendarDays(toDatePickerFieldValue(date), 1),
      );
      if (nextDate) focusCalendarDate(nextDate);
      return;
    }

    if (activeElement.closest('[data-task-start-someday]')) {
      firstHorizonRef.current?.focus();
      return;
    }

    focusCurrentStartChoice();
  }, [focusCalendarDate, focusCurrentStartChoice, minimumDate]);

  useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (!panel) return;
    const handleAdvance = () => advanceStartFocus();
    panel.addEventListener(TASK_START_PICKER_ADVANCE_EVENT, handleAdvance);
    return () => panel.removeEventListener(TASK_START_PICKER_ADVANCE_EVENT, handleAdvance);
  }, [active, advanceStartFocus]);

  useEffect(() => {
    if (reminderHourMenuDisabled) setReminderHourMenuOpen(false);
  }, [reminderHourMenuDisabled]);

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

  const focusFooterAction = (position: 'first' | 'last' = 'first') => {
    const footerActions = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>(
      '[data-task-start-footer-action]:not(:disabled)',
    ) ?? []);
    const footerAction = position === 'first' ? footerActions[0] : footerActions.at(-1);
    footerAction?.focus();
    return Boolean(footerAction);
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
    if (initialFocusTimerRef.current !== null) {
      window.clearTimeout(initialFocusTimerRef.current);
      initialFocusTimerRef.current = null;
    }
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    if (target.closest('[data-task-reminder-hour-menu]')) return;
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      onTabExit(event.shiftKey);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onRequestClose();
      return;
    }
    if (
      event.key !== 'ArrowLeft'
      && event.key !== 'ArrowRight'
      && event.key !== 'ArrowUp'
      && event.key !== 'ArrowDown'
    ) {
      return;
    }

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
      else if (event.key === 'ArrowDown') focusFooterAction();
      else if (
        event.key === 'ArrowRight'
        && reminderRef.current.selectionStart === reminderInput.length
        && reminderRef.current.selectionEnd === reminderInput.length
        && !reminderHourButtonRef.current?.disabled
      ) {
        reminderHourButtonRef.current?.focus();
      }
      else return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const reminderHourButton = target.closest<HTMLButtonElement>(
      '[data-task-reminder-hour-trigger]',
    );
    if (reminderHourButton) {
      if (event.key === 'ArrowLeft') focusReminderInput();
      else if (event.key === 'ArrowUp') focusCalendarDay('last');
      else if (event.key === 'ArrowDown') focusFooterAction('last');
      else return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const footerAction = target.closest<HTMLButtonElement>('[data-task-start-footer-action]');
    if (footerAction) {
      const footerActions = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-task-start-footer-action]:not(:disabled)',
      ) ?? []);
      const index = footerActions.indexOf(footerAction);
      if (event.key === 'ArrowLeft' && index > 0) footerActions[index - 1]?.focus();
      else if (event.key === 'ArrowRight' && index < footerActions.length - 1) {
        footerActions[index + 1]?.focus();
      } else if (event.key === 'ArrowUp') {
        if (
          index === footerActions.length - 1
          && footerActions.length > 1
          && !reminderHourButtonRef.current?.disabled
        ) {
          reminderHourButtonRef.current?.focus();
        } else if (!focusReminderInput()) {
          focusCalendarDay('last');
        }
      }
      else return;
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
        if (!focusReminderInput()) focusFooterAction();
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

  };

  const commitReminderInput = (): Promise<boolean> => {
    if (reminderCommitRef.current !== null) return reminderCommitRef.current;

    const commit = (async () => {
      const rawValue = reminderInput;
      if (!rawValue.trim()) {
        reminderInputConfirmedRef.current = true;
        try {
          if (reminderTime) await onReminderChange('');
          setReminderInput('');
          return true;
        } catch {
          setReminderInput(committedReminderDisplay);
          return false;
        }
      }

      const resolved = resolveTaskReminderTimeInput(rawValue, {
        today: task.start_date === null,
        timeZone: reminderTimeZone,
      });
      if (!resolved) {
        setReminderInput(committedReminderDisplay);
        reminderInputConfirmedRef.current = true;
        toast({
          title: 'Not Allowed.',
        });
        return false;
      }

      reminderInputConfirmedRef.current = true;
      try {
        if (resolved.localTime !== reminderTime) {
          await onReminderChange(resolved.localTime);
        }
        setReminderInput(resolved.displayTime);
        return true;
      } catch {
        setReminderInput(committedReminderDisplay);
        return false;
      }
    })();
    reminderCommitRef.current = commit;
    void commit.finally(() => {
      if (reminderCommitRef.current === commit) reminderCommitRef.current = null;
    });
    return commit;
  };

  const applyReminderHour = async (option: TaskReminderHourOption) => {
    reminderInputConfirmedRef.current = true;
    setReminderInput(option.displayTime);
    try {
      if (option.localTime !== reminderTime.slice(0, 5)) {
        await onReminderChange(option.localTime);
      }
    } catch {
      setReminderInput(committedReminderDisplay);
    }
  };

  return (
    <div
      ref={panelRef}
      className="mx-auto w-[min(20rem,calc(100vw-2rem))]"
      data-task-start-picker
      onKeyDownCapture={handlePanelKeyDownCapture}
      onPointerDownCapture={() => {
        if (initialFocusTimerRef.current === null) return;
        window.clearTimeout(initialFocusTimerRef.current);
        initialFocusTimerRef.current = null;
      }}
    >
      <div className="space-y-2 p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Today
        </div>
        <div className="grid grid-cols-4 gap-1">
          {taskHorizonPresentations.map(({
            id,
            label,
            icon: Icon,
            colorClass,
          }, index) => {
            const selected = task.start_date === null && task.today_section === id;
            return (
              <Button
                key={id}
                ref={index === 0 ? firstHorizonRef : undefined}
                type="button"
                variant="clear"
                aria-pressed={selected}
                data-task-start-horizon={id}
                className={cn(
                  'h-auto min-w-0 flex-col gap-1 px-1.5 py-2 text-xs',
                  selected && 'bg-accent text-accent-foreground',
                )}
                onClick={() => void onPlanningChange({
                  destination: 'anytime',
                  startDate: null,
                  todaySection: id,
                }).then(onRequestClose)}
              >
                <Icon
                  className={cn('h-4 w-4', colorClass)}
                  data-task-horizon-symbol={id}
                  data-task-horizon-surface="picker"
                  aria-hidden
                />
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
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          initialFocusDate={calendarFocusDate}
          initialFocusRequestKey={calendarFocusRequestKey}
          today={planningToday}
          onDayGridExitDown={() => {
            if (!focusReminderInput()) return focusFooterAction();
            return true;
          }}
          onSelect={(date) => {
            if (!date) return;
            void onPlanningChange({
              destination: 'anytime',
              startDate: toDatePickerFieldValue(date),
              todaySection: task.today_section ?? 'next',
            }).then(onRequestClose);
          }}
          allowTabExit
          className="mx-auto"
        />
      </div>

      <div className="space-y-3 border-t border-[hsl(var(--grid-sticky-line))] p-3">
        <InputGroup data-disabled={reminderDisabled ? 'true' : undefined}>
          <InputGroupInput
            ref={reminderRef}
            id={`task-start-reminder-${task.id}`}
            type="text"
            inputMode="text"
            autoComplete="off"
            value={reminderInput}
            placeholder="No Reminder"
            aria-label="Reminder Time"
            decoration={<TASK_ICONS.Reminder />}
            data-bathos-field-return-owned="true"
            disabled={reminderDisabled}
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
          <InputGroupAddon
            align="inline-end"
            className="h-full p-0"
          >
            <DropdownMenu
              open={reminderHourMenuOpen}
              onOpenChange={(nextOpen) => {
                if (nextOpen && reminderHourMenuDisabled) return;
                if (nextOpen) setReminderHourNow(new Date());
                setReminderHourMenuOpen(nextOpen);
              }}
            >
              <DropdownMenuTrigger asChild>
                <InputGroupButton
                  ref={reminderHourButtonRef}
                  size="icon-sm"
                  aria-label="Choose Reminder Hour"
                  data-task-reminder-hour-trigger
                  disabled={reminderHourMenuDisabled}
                  className="h-full w-10 rounded-none rounded-r-md border-l border-[hsl(var(--grid-sticky-line))] bg-muted/15 text-muted-foreground hover:bg-muted/35 hover:text-foreground disabled:bg-transparent disabled:text-muted-foreground/40 disabled:opacity-100"
                >
                  <AlarmClock aria-hidden />
                </InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-[min(20rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto"
                data-task-reminder-hour-menu
                onEscapeKeyDown={(event) => event.stopPropagation()}
              >
                <DropdownMenuGroup>
                  <DropdownMenuRadioGroup
                    value={reminderTime.slice(0, 5)}
                    onValueChange={(localTime) => {
                      const option = reminderHourOptions.find(
                        (candidate) => candidate.localTime === localTime,
                      );
                      if (option) void applyReminderHour(option);
                    }}
                  >
                    {reminderHourOptions.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.localTime}
                        value={option.localTime}
                      >
                        {option.displayTime}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </InputGroupAddon>
        </InputGroup>
        {reminderUnavailableMessage ? (
          <p className="text-xs text-warning">{reminderUnavailableMessage}</p>
        ) : null}
        {reminder?.resolution_kind === 'gap_forward' ? (
          <p className="text-xs text-warning">
            Adjusted to the first valid time after the daylight-saving gap.
          </p>
        ) : null}
      </div>

      <div
        className="relative grid grid-cols-2 gap-0 border-t border-[hsl(var(--grid-sticky-line))] p-2"
        data-task-start-footer
      >
        <Button
          type="button"
          variant="clear"
          data-task-start-clear
          data-task-start-footer-action
          className="relative w-full justify-center gap-2 text-muted-foreground"
          disabled={!planned && !reminderTime}
          onClick={() => {
            void onClear().then(onRequestClose);
          }}
        >
          <X className="h-4 w-4" aria-hidden />
          Clear
        </Button>
        <Button
          type="button"
          variant="clear"
          aria-pressed={task.destination === 'someday'}
          data-task-start-someday
          data-task-start-footer-action
          className={cn(
            'relative w-full justify-center gap-2',
            task.destination === 'someday'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground',
          )}
          onClick={() => {
            void onPlanningChange({
              destination: 'someday',
              startDate: null,
              todaySection: null,
            }).then(onRequestClose);
          }}
        >
          <TASK_ICONS.Someday className="h-4 w-4" aria-hidden />
          Someday
        </Button>
        <span
          aria-hidden="true"
          data-task-start-footer-divider
          className="pointer-events-none absolute inset-y-2 left-1/2 w-px bg-[hsl(var(--grid-sticky-line)/0.35)]"
        />
      </div>
    </div>
  );
}

function getStartSummary(
  destination: TaskTodo['destination'],
  startDate: string | null,
  todaySection: TaskTodaySection | null,
  planningDate: string,
): string {
  if (startDate) {
    return formatTaskDateControlLabel(startDate, planningDate);
  }
  if (todaySection) {
    const label = taskHorizonPresentations.find(({ id }) => id === todaySection)?.label;
    return `Today · ${label ?? todaySection}`;
  }
  if (destination === 'someday') return 'Someday';
  return "No Start";
}

export function TaskStartPickerField(props: TaskStartPickerProps) {
  const [open, setOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<TaskStartPickerFocusTarget>('start');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tabExitDirectionRef = useRef<'forward' | 'backward' | null>(null);
  const summary = useMemo(
    () => getStartSummary(
      props.task.destination,
      props.task.start_date,
      props.task.today_section,
      props.planningDate,
    ),
    [
      props.planningDate,
      props.task.destination,
      props.task.start_date,
      props.task.today_section,
    ],
  );
  const horizonPresentation = props.task.today_section
    ? getTaskHorizonPresentation(props.task.today_section)
    : null;
  const StartDecorationIcon = horizonPresentation?.icon ?? TASK_ICONS.Start;

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
            'h-10 w-full justify-start rounded-md border-[hsl(var(--grid-sticky-line))] bg-background px-3 text-left font-normal ',
            props.task.destination !== 'someday'
              && props.task.start_date === null
              && props.task.today_section === null
              && 'text-muted-foreground',
          )}
        >
          <ControlDecoration className={horizonPresentation?.colorClass}>
            <StartDecorationIcon />
          </ControlDecoration>
          <span className="ml-2 min-w-0 flex-1 truncate">{summary}</span>
          {props.reminderTime ? (
            <TASK_ICONS.Reminder
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
        onCloseAutoFocus={(event) => {
          const direction = tabExitDirectionRef.current;
          if (!direction) return;
          event.preventDefault();
          tabExitDirectionRef.current = null;
          if (triggerRef.current) {
            focusAdjacentFormControl(triggerRef.current, direction === 'backward');
          }
        }}
      >
        <TaskStartPickerPanel
          {...props}
          focusTarget={focusTarget}
          active={open}
          onRequestClose={() => setOpen(false)}
          onTabExit={(backwards) => {
            tabExitDirectionRef.current = backwards ? 'backward' : 'forward';
            if (triggerRef.current) {
              focusAdjacentFormControl(triggerRef.current, backwards);
            }
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
