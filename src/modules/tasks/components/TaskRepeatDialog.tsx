import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { AlarmClock, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DatePickerField,
  toDatePickerFieldValue,
} from '@/components/ui/date-picker-field';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  getTaskRecurrenceDatePair,
  getTaskRecurrencePreviewDates,
  isTaskRecurrenceAnchorDate,
} from '@/modules/tasks/domain/taskRecurrenceDates';
import {
  addTaskCalendarDays,
  differenceInTaskCalendarDays,
} from '@/modules/tasks/domain/taskDates';
import {
  formatTaskReminderTimeDisplay,
  listTaskReminderHourOptions,
  resolveTaskReminderTimeInput,
} from '@/modules/tasks/domain/taskReminderTimeInput';
import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type {
  TaskRecurrenceEditInput,
  TaskRecurrenceSaveResult,
} from '@/modules/tasks/data/taskRecurrenceService';
import type {
  TaskRecurrenceDateBasis,
  TaskRecurrenceDayType,
  TaskRecurrenceDefinition,
  TaskRecurrenceFrequency,
  TaskRecurrencePosition,
  TaskRecurrenceRevision,
  TaskRecurrenceRuleConfig,
  TaskRecurrenceRuleMode,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

const weekdayLabels = [
  [1, 'M', 'Mon', 'Monday'],
  [2, 'T', 'Tue', 'Tuesday'],
  [3, 'W', 'Wed', 'Wednesday'],
  [4, 'T', 'Thu', 'Thursday'],
  [5, 'F', 'Fri', 'Friday'],
  [6, 'S', 'Sat', 'Saturday'],
  [7, 'S', 'Sun', 'Sunday'],
] as const;

const months = [
  [1, 'January', 'Jan'],
  [2, 'February', 'Feb'],
  [3, 'March', 'Mar'],
  [4, 'April', 'Apr'],
  [5, 'May', 'May'],
  [6, 'June', 'Jun'],
  [7, 'July', 'Jul'],
  [8, 'August', 'Aug'],
  [9, 'September', 'Sep'],
  [10, 'October', 'Oct'],
  [11, 'November', 'Nov'],
  [12, 'December', 'Dec'],
] as const;

const dayTypes: Array<[TaskRecurrenceDayType, string]> = [
  ['day', 'Day'],
  ['weekday', 'Weekday'],
  ['weekend_day', 'Weekend Day'],
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
];

export function TaskRepeatDialog({
  task,
  planningDate,
  open,
  onOpenChange,
  definition = null,
  revision = null,
  onEdit,
}: {
  task: TaskTodo | null;
  planningDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition?: TaskRecurrenceDefinition | null;
  revision?: TaskRecurrenceRevision | null;
  onEdit?: (input: TaskRecurrenceEditInput) => Promise<TaskRecurrenceSaveResult>;
  areas?: ReadonlyArray<{ id: string; title: string }>;
}) {
  const { mode, recurrenceService } = useTasksRuntime();
  const editing = definition !== null && revision !== null;
  const initialBasis = recurrenceBasis(revision);
  const initialOffset = revision?.deadline_after_start_days
    ?? revision?.deadline_offset_days
    ?? taskDeadlineAfterStartDays(task);
  const initialHasDeadline = revision
    ? (revision.deadline_after_start_days ?? revision.deadline_offset_days) !== null
    : task?.deadline != null;
  const initialMinimumAnchor = initialBasis === 'deadline' && initialHasDeadline
    ? addTaskCalendarDays(planningDate, initialOffset)
    : planningDate;
  const initialAnchor = clampToPlanningDate(
    revision?.start_date ?? task?.start_date ?? planningDate,
    initialMinimumAnchor,
  );

  const [ruleMode, setRuleMode] = useState<TaskRecurrenceRuleMode>('calendar');
  const [frequency, setFrequency] = useState<TaskRecurrenceFrequency>('weekly');
  const [intervalCountInput, setIntervalCountInput] = useState('1');
  const [anchorDate, setAnchorDate] = useState(initialAnchor);
  const [dateBasis, setDateBasis] = useState<TaskRecurrenceDateBasis>(initialBasis);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([
    isoWeekday(initialAnchor),
  ]);
  const [position, setPosition] = useState<TaskRecurrencePosition>(
    Number(initialAnchor.slice(8, 10)),
  );
  const [dayType, setDayType] = useState<TaskRecurrenceDayType>('day');
  const [selectedMonths, setSelectedMonths] = useState<number[]>([
    Number(initialAnchor.slice(5, 7)),
  ]);
  const [addDeadline, setAddDeadline] = useState(initialHasDeadline);
  const [deadlineOffsetInput, setDeadlineOffsetInput] = useState(String(initialOffset));
  const [addReminder, setAddReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('12:00');
  const [reminderInput, setReminderInput] = useState('12:00 pm');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const basis = recurrenceBasis(revision);
    const offset = revision?.deadline_after_start_days
      ?? revision?.deadline_offset_days
      ?? taskDeadlineAfterStartDays(task);
    const hasDeadline = revision
      ? (revision.deadline_after_start_days ?? revision.deadline_offset_days) !== null
      : task?.deadline != null;
    const minimumAnchor = basis === 'deadline' && hasDeadline
      ? addTaskCalendarDays(planningDate, offset)
      : planningDate;
    const date = clampToPlanningDate(
      revision?.start_date ?? task?.start_date ?? planningDate,
      minimumAnchor,
    );
    const normalized = normalizeRuleForEditor(revision?.rule_config, date);
    setRuleMode(revision?.rule_mode ?? 'calendar');
    setFrequency(revision?.frequency ?? 'weekly');
    setIntervalCountInput(String(revision?.interval_count ?? 1));
    setAnchorDate(date);
    setDateBasis(basis);
    setSelectedWeekdays(normalized.weekdays);
    setPosition(normalized.position);
    setDayType(normalized.dayType);
    setSelectedMonths(normalized.months);
    setAddDeadline(hasDeadline);
    setDeadlineOffsetInput(String(offset));
    setAddReminder(revision?.reminder_local_time !== null && revision !== null);
    const nextReminderTime = revision?.reminder_local_time?.slice(0, 5) ?? '12:00';
    setReminderTime(nextReminderTime);
    setReminderInput(formatTaskReminderTimeDisplay(nextReminderTime) ?? '12:00 pm');
    setPending(false);
  }, [open, planningDate, revision, task]);

  const maximumPosition = maxPositionForDayType(dayType);
  useEffect(() => {
    if (position !== 'last' && position > maximumPosition) {
      setPosition(maximumPosition);
    }
  }, [maximumPosition, position]);

  const ruleConfig = useMemo<TaskRecurrenceRuleConfig>(() => {
    if (frequency === 'weekly') {
      return { version: 2, weekdays: selectedWeekdays };
    }
    if (frequency === 'monthly') {
      return { version: 2, position, day_type: dayType };
    }
    if (frequency === 'yearly') {
      return { version: 2, months: selectedMonths, position, day_type: dayType };
    }
    return { version: 2 };
  }, [dayType, frequency, position, selectedMonths, selectedWeekdays]);

  const intervalCount = normalizeRepeatInterval(intervalCountInput);
  const deadlineAfterStartDays = normalizeDayOffset(deadlineOffsetInput);
  const offset = addDeadline ? deadlineAfterStartDays : null;
  const minimumAnchorDate = dateBasis === 'deadline' && offset !== null
    ? addTaskCalendarDays(planningDate, offset)
    : planningDate;
  const previewSeedAnchor = anchorDate < minimumAnchorDate
    ? minimumAnchorDate
    : anchorDate;
  const previewAnchors = ruleMode === 'after_completion'
    ? [previewSeedAnchor]
    : getTaskRecurrencePreviewDates({
        startDate: previewSeedAnchor,
        frequency,
        intervalCount,
        ruleConfig,
        endMode: 'never',
        afterDateExclusive: editing ? minimumAnchorDate : null,
        limit: 3,
      });
  const previewPairs = previewAnchors
    .map((anchor) => getTaskRecurrenceDatePair(anchor, dateBasis, offset))
    .filter((pair): pair is NonNullable<typeof pair> => pair !== null);
  const alignedAnchor = previewAnchors[0] ?? anchorDate;
  const alignedNextStart = previewPairs[0]?.startDate ?? anchorDate;

  useEffect(() => {
    if (
      ruleMode === 'calendar'
      && alignedAnchor !== anchorDate
    ) {
      setAnchorDate(alignedAnchor);
    }
  }, [alignedAnchor, anchorDate, ruleMode]);

  const changeDeadlinePresence = (checked: boolean) => {
    setAddDeadline(checked);
    setDateBasis('start');
  };

  const changeDateBasis = (basis: TaskRecurrenceDateBasis) => {
    if (basis === dateBasis) return;
    setDateBasis(basis);
  };

  const isAnchorDateDisabled = (date: Date): boolean => {
    if (ruleMode === 'after_completion' || frequency === 'daily') return false;
    return !isTaskRecurrenceAnchorDate(
      toDatePickerFieldValue(date),
      frequency,
      ruleConfig,
    );
  };

  const reminderHourOptions = useMemo(
    () => listTaskReminderHourOptions({ today: false, timeZone: 'UTC' }),
    [],
  );

  const changeReminderPresence = (checked: boolean) => {
    setAddReminder(checked);
    if (!checked) return;
    const nextTime = reminderTime || '12:00';
    setReminderTime(nextTime);
    setReminderInput(formatTaskReminderTimeDisplay(nextTime) ?? '12:00 pm');
  };

  const commitReminderInput = () => {
    const resolved = resolveTaskReminderTimeInput(reminderInput, {
      today: false,
      timeZone: 'UTC',
    });
    if (!resolved) {
      setReminderTime('');
      setReminderInput('');
      setAddReminder(false);
      return;
    }
    setReminderTime(resolved.localTime);
    setReminderInput(resolved.displayTime);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (
      pending
      || mode !== 'connected'
      || alignedNextStart < planningDate
      || (frequency === 'yearly' && selectedMonths.length === 0)
      || (dateBasis === 'deadline' && !addDeadline)
    ) return;
    setPending(true);
    try {
      const common = {
        ruleMode,
        frequency,
        intervalCount,
        nextStartDate: alignedNextStart,
        dateBasis,
        ruleConfig,
        endMode: 'never' as const,
        endAfterCount: null,
        endOnDate: null,
        reminderLocalTime: addReminder ? reminderTime : null,
        deadlineAfterStartDays: offset,
      };
      const result = editing
        ? await (onEdit ?? recurrenceService.edit.bind(recurrenceService))({
            definition,
            revision,
            ...common,
          })
        : task
          ? await recurrenceService.createFromTask({ taskId: task.id, ...common })
          : null;
      if (!result) throw new Error('The recurrence is unavailable');
      if (
        ruleMode === 'calendar'
        && result.definition.next_occurrence_date !== null
        && result.definition.next_occurrence_date <= planningDate
      ) {
        await recurrenceService.evaluate(result.definition.id, planningDate);
      }
      toast({ title: editing ? 'Repeat Updated' : 'Repeat Saved' });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Repeat Could Not Be Saved',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  };

  const formId = `task-repeat-form-${task?.id ?? definition?.id ?? 'unavailable'}`;
  const summary = task?.title ?? revision?.prototype_snapshot.root.title ?? definition?.name ?? 'New Task';
  const selectedMonthSummary = formatSelectedMonthSummary(selectedMonths);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Repeat' : 'Repeat Task'}</DialogTitle>
          <p className="text-sm text-muted-foreground" data-task-repeat-summary>{summary}</p>
        </DialogHeader>
        <DialogBody className="pt-[25px]">
          <form id={formId} onSubmit={save} className="space-y-5">
            <div className="space-y-2" data-task-repeat-cadence-phrase>
              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                <span className="text-sm">Repeat</span>
                <Select
                  value={ruleMode}
                  onValueChange={(value) => setRuleMode(value as TaskRecurrenceRuleMode)}
                >
                  <SelectTrigger className="w-full" aria-label="Repeat Type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="after_completion">After Completion</SelectItem>
                    <SelectItem value="calendar">On a Schedule</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[auto_5rem_1fr] items-center gap-2">
                <span className="text-sm">Every</span>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={intervalCountInput}
                  aria-label="Repeat Interval"
                  onChange={(event) => setIntervalCountInput(event.target.value)}
                  onBlur={() => setIntervalCountInput(String(intervalCount))}
                />
                <Select
                  value={frequency}
                  onValueChange={(value) => setFrequency(value as TaskRecurrenceFrequency)}
                >
                  <SelectTrigger aria-label="Frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{intervalCount === 1 ? 'Day' : 'Days'}</SelectItem>
                    <SelectItem value="weekly">{intervalCount === 1 ? 'Week' : 'Weeks'}</SelectItem>
                    <SelectItem value="monthly">{intervalCount === 1 ? 'Month' : 'Months'}</SelectItem>
                    <SelectItem value="yearly">{intervalCount === 1 ? 'Year' : 'Years'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {ruleMode === 'calendar' && frequency === 'weekly' ? (
                <div className="flex items-center gap-2" aria-label="Repeat Weekdays">
                  <span className="shrink-0 text-sm">On</span>
                  <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
                    {weekdayLabels.map(([day, compactLabel, wideLabel, fullLabel]) => (
                      <Button
                        key={day}
                        type="button"
                        variant={selectedWeekdays.includes(day) ? 'success' : 'outline'}
                        size="icon"
                        className="h-9 w-full min-w-0"
                        aria-label={fullLabel}
                        aria-pressed={selectedWeekdays.includes(day)}
                        onClick={() => setSelectedWeekdays((current) => (
                          current.includes(day)
                            ? current.length === 1 ? current : current.filter((value) => value !== day)
                            : [...current, day].sort((left, right) => left - right)
                        ))}
                      >
                        <span className="md:hidden">{compactLabel}</span>
                        <span className="hidden md:inline">{wideLabel}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {ruleMode === 'calendar' && frequency === 'yearly' ? (
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                  <span className="text-sm">In</span>
                  <MultiSelectFilter
                    label="Months"
                    options={months.map(([month, label]) => ({ value: String(month), label }))}
                    selectedValues={selectedMonths.map(String)}
                    selectedSummary={selectedMonthSummary}
                    onSelectedValuesChange={(values) => {
                      if (values.length > 0) setSelectedMonths(values.map(Number));
                    }}
                    triggerClassName="h-10 w-full"
                    showBulkActions={false}
                    deferSelectionUntilClose
                  />
                </div>
              ) : null}

              {ruleMode === 'calendar' && (frequency === 'monthly' || frequency === 'yearly') ? (
                <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                  <span className="text-sm">On the</span>
                  <Select
                    value={String(position)}
                    onValueChange={(value) => setPosition(value === 'last' ? 'last' : Number(value))}
                  >
                    <SelectTrigger aria-label="Ordinal"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: maximumPosition }, (_, index) => index + 1).map((value) => (
                        <SelectItem key={value} value={String(value)}>{ordinalNumber(value)}</SelectItem>
                      ))}
                      <SelectItem value="last">Last</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={dayType}
                    onValueChange={(value) => setDayType(value as TaskRecurrenceDayType)}
                  >
                    <SelectTrigger aria-label="Day Type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {dayTypes.map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <OptionSwitch
              label="Tasks Have Deadlines"
              checked={addDeadline}
              onCheckedChange={changeDeadlinePresence}
              className="!mt-7"
            />

            <div className="!mt-7 space-y-2" data-task-repeat-date-phrase>
              <div
                className={addDeadline
                  ? 'grid grid-cols-[auto_7rem_auto_minmax(0,1fr)] items-center gap-2'
                  : 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2'}
              >
                <span className="text-sm">{addDeadline ? 'Next' : 'Next Starts on'}</span>
                {addDeadline ? (
                  <Select
                    value={dateBasis}
                    onValueChange={(value) => changeDateBasis(value as TaskRecurrenceDateBasis)}
                  >
                    <SelectTrigger className="w-full" aria-label="Next Date Type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="start">Starts</SelectItem>
                      <SelectItem value="deadline">Due</SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}
                {addDeadline ? (
                  <span className="text-sm" data-task-repeat-anchor-preposition>on</span>
                ) : null}
                <DatePickerField
                  aria-label={dateBasis === 'deadline' ? 'Next Deadline' : 'Next Start'}
                  value={alignedAnchor}
                  onValueChange={setAnchorDate}
                  todayDate={planningDate}
                  minDate={minimumAnchorDate}
                  isDateDisabled={isAnchorDateDisabled}
                />
              </div>

              {addDeadline ? (
                <label className="grid grid-cols-[auto_5rem_auto] items-center justify-start gap-2 text-sm">
                  <span>{dateBasis === 'deadline' ? 'And Starts' : 'With Deadlines'}</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={deadlineOffsetInput}
                    aria-label={dateBasis === 'deadline' ? 'Days Before Deadline' : 'Days After Start'}
                    onChange={(event) => setDeadlineOffsetInput(event.target.value)}
                    onBlur={() => setDeadlineOffsetInput(String(normalizeDayOffset(deadlineOffsetInput)))}
                  />
                  <span>{dateBasis === 'deadline' ? 'Days Prior' : 'Days After'}</span>
                </label>
              ) : null}
            </div>

            {previewPairs.length > 0 ? (
              <div className="space-y-1 text-sm text-muted-foreground" aria-label="Next Occurrences">
                <span className="font-medium text-foreground">Next</span>
                <ol className="space-y-1">
                  {previewPairs.map((pair) => (
                    <li key={`${pair.startDate}:${pair.deadline ?? ''}`}>
                      <span className="text-foreground">Start</span>{' '}
                      {formatRepeatPreviewDate(pair.startDate)}
                      {pair.deadline ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="text-foreground">Deadline</span>{' '}
                          {formatRepeatPreviewDate(pair.deadline)}
                        </>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <OptionSwitch
              label="Tasks Have Reminders"
              checked={addReminder}
              onCheckedChange={changeReminderPresence}
            >
              {addReminder ? (
                <InputGroup className="h-10 min-w-48 flex-1">
                  <InputGroupInput
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    value={reminderInput}
                    placeholder="No Reminder"
                    aria-label="Reminder Time"
                    decoration={<TASK_ICONS.Reminder />}
                    className="h-10 py-2 text-sm"
                    onChange={(event) => setReminderInput(event.target.value)}
                    onBlur={commitReminderInput}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      commitReminderInput();
                    }}
                  />
                  <InputGroupAddon align="inline-end" className="h-full gap-0 p-0">
                    {reminderInput.length > 0 ? (
                      <InputGroupButton
                        size="icon-xs"
                        aria-label="Clear Reminder"
                        className="h-full w-7 rounded-none bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setReminderTime('');
                          setReminderInput('');
                          setAddReminder(false);
                        }}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </InputGroupButton>
                    ) : null}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <InputGroupButton
                          size="icon-sm"
                          aria-label="Choose Reminder Hour"
                          className="h-full w-10 rounded-none rounded-r-md border-0 border-l border-input bg-transparent text-foreground"
                        >
                          <AlarmClock aria-hidden />
                        </InputGroupButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                        <DropdownMenuGroup>
                          <DropdownMenuRadioGroup
                            value={reminderTime}
                            onValueChange={(localTime) => {
                              setReminderTime(localTime);
                              setReminderInput(
                                formatTaskReminderTimeDisplay(localTime) ?? reminderInput,
                              );
                            }}
                          >
                            {reminderHourOptions.map((option) => (
                              <DropdownMenuRadioItem key={option.localTime} value={option.localTime}>
                                {option.displayTime}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </InputGroupAddon>
                </InputGroup>
              ) : null}
            </OptionSwitch>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="submit"
            form={formId}
            data-bathos-form-submit="true"
            disabled={
              pending
              || mode !== 'connected'
              || alignedNextStart < planningDate
              || (frequency === 'yearly' && selectedMonths.length === 0)
              || (dateBasis === 'deadline' && !addDeadline)
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function normalizeRuleForEditor(
  config: TaskRecurrenceRuleConfig | null | undefined,
  date: string,
): {
  weekdays: number[];
  position: TaskRecurrencePosition;
  dayType: TaskRecurrenceDayType;
  months: number[];
} {
  if (config?.version === 2) {
    return {
      weekdays: normalizeWeekdays(config.weekdays, date),
      position: config.position ?? Number(date.slice(8, 10)),
      dayType: config.day_type ?? 'day',
      months: normalizeMonths(config.months, date),
    };
  }
  let dayType: TaskRecurrenceDayType = 'day';
  let position: TaskRecurrencePosition = config?.month_day ?? Number(date.slice(8, 10));
  if (config?.monthly_kind === 'last_day' || config?.yearly_kind === 'last_day') {
    position = 'last';
  } else if (config?.monthly_kind === 'ordinal_day_type') {
    position = config.ordinal === -1 ? 'last' : config.ordinal ?? 1;
    dayType = config.day_type === 'weekend_day' ? 'weekend_day' : 'weekday';
  } else if (config?.monthly_kind === 'ordinal_weekday' || config?.yearly_kind === 'ordinal_weekday') {
    position = config.ordinal === -1 ? 'last' : config.ordinal ?? 1;
    dayType = weekdayDayType(config.weekday ?? isoWeekday(date));
  }
  return {
    weekdays: normalizeWeekdays(config?.weekdays, date),
    position,
    dayType,
    months: normalizeMonths(config?.months ?? (config?.month ? [config.month] : undefined), date),
  };
}

function recurrenceBasis(revision: TaskRecurrenceRevision | null): TaskRecurrenceDateBasis {
  return revision?.date_basis
    ?? (revision?.deadline_offset_days !== null && revision ? 'deadline' : 'start');
}

function taskDeadlineAfterStartDays(task: TaskTodo | null): number {
  if (task?.start_date === null || task?.start_date === undefined || task.deadline === null) {
    return 0;
  }
  return Math.max(0, differenceInTaskCalendarDays(task.deadline, task.start_date));
}

function normalizeWeekdays(values: number[] | undefined, date: string): number[] {
  const normalized = [...new Set((values ?? []).filter((value) => value >= 1 && value <= 7))]
    .sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : [isoWeekday(date)];
}

function normalizeMonths(values: number[] | undefined, date: string): number[] {
  const normalized = [...new Set((values ?? []).filter((value) => value >= 1 && value <= 12))]
    .sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : [Number(date.slice(5, 7))];
}

function formatSelectedMonthSummary(selectedMonths: number[]): string {
  const selectedLabels = months
    .filter(([month]) => selectedMonths.includes(month))
    .map(([, , shortLabel]) => shortLabel);
  if (selectedLabels.length >= 8) {
    return `${selectedLabels.slice(0, 7).join(', ')}, ...`;
  }
  return selectedLabels.join(', ');
}

function maxPositionForDayType(dayType: TaskRecurrenceDayType): number {
  if (dayType === 'day') return 31;
  if (dayType === 'weekday') return 23;
  if (dayType === 'weekend_day') return 10;
  return 5;
}

function weekdayDayType(weekday: number): TaskRecurrenceDayType {
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][
    Math.min(Math.max(weekday, 1), 7) - 1
  ] as TaskRecurrenceDayType;
}

function OptionSwitch({
  label,
  checked,
  onCheckedChange,
  children,
  className,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function normalizeDayOffset(value: string): number {
  const normalized = Number(value.trim());
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function normalizeRepeatInterval(value: string): number {
  const normalized = Number(value.trim());
  return Number.isSafeInteger(normalized) && normalized >= 1 && normalized <= 1000
    ? normalized
    : 1;
}

function formatRepeatPreviewDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) return value;
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return `${year} ${monthLabel} ${day}`;
}

function clampToPlanningDate(value: string, planningDate: string): string {
  return value < planningDate ? planningDate : value;
}

function isoWeekday(value: string): number {
  const day = new Date(`${value}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function ordinalNumber(value: number): string {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}
