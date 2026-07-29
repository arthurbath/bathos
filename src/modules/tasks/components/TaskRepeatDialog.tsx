import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { getTaskRecurrencePreviewDates } from '@/modules/tasks/domain/taskRecurrenceDates';
import {
  addTaskCalendarDays,
  formatTaskDateControlLabel,
} from '@/modules/tasks/domain/taskDates';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type {
  TaskRecurrenceEditInput,
  TaskRecurrenceSaveResult,
} from '@/modules/tasks/data/taskRecurrenceService';
import type {
  TaskRecurrenceDefinition,
  TaskRecurrenceEndMode,
  TaskRecurrenceFrequency,
  TaskRecurrenceRevision,
  TaskRecurrenceRuleConfig,
  TaskRecurrenceRuleMode,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

const weekdayLabels = [
  [1, 'M'],
  [2, 'T'],
  [3, 'W'],
  [4, 'T'],
  [5, 'F'],
  [6, 'S'],
  [7, 'S'],
] as const;

const weekdays = [
  [1, 'Monday'],
  [2, 'Tuesday'],
  [3, 'Wednesday'],
  [4, 'Thursday'],
  [5, 'Friday'],
  [6, 'Saturday'],
  [7, 'Sunday'],
] as const;

const monthlyOrdinals = [
  [1, 'First'],
  [2, 'Second'],
  [3, 'Third'],
  [4, 'Fourth'],
  [5, 'Fifth'],
  [-1, 'Last'],
] as const;

const months = [
  [1, 'January'],
  [2, 'February'],
  [3, 'March'],
  [4, 'April'],
  [5, 'May'],
  [6, 'June'],
  [7, 'July'],
  [8, 'August'],
  [9, 'September'],
  [10, 'October'],
  [11, 'November'],
  [12, 'December'],
] as const;

type MonthlyPattern = 'date' | 'weekday_position' | 'day_type_position';
type MonthlyOrdinal = -1 | 1 | 2 | 3 | 4 | 5;
type YearlyPattern = 'date' | 'last_day' | 'weekday_position';

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
}) {
  const { mode, recurrenceService } = useTasksRuntime();
  const editing = definition !== null && revision !== null;
  const initialScheduleDate = revision?.start_date
    ?? task?.deadline
    ?? task?.start_date
    ?? planningDate;
  const [ruleMode, setRuleMode] = useState<TaskRecurrenceRuleMode>('calendar');
  const [frequency, setFrequency] = useState<TaskRecurrenceFrequency>('weekly');
  const [intervalCount, setIntervalCount] = useState(1);
  const [scheduleDate, setScheduleDate] = useState(initialScheduleDate);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([
    isoWeekday(initialScheduleDate),
  ]);
  const [monthlyPattern, setMonthlyPattern] = useState<MonthlyPattern>('date');
  const [monthlyDate, setMonthlyDate] = useState<number | 'last'>(
    Number(initialScheduleDate.slice(8, 10)),
  );
  const [monthlyOrdinal, setMonthlyOrdinal] = useState<MonthlyOrdinal>(
    ordinalInMonth(initialScheduleDate),
  );
  const [monthlyWeekday, setMonthlyWeekday] = useState(isoWeekday(initialScheduleDate));
  const [monthlyDayType, setMonthlyDayType] = useState<'weekday' | 'weekend_day'>(
    'weekday',
  );
  const [yearlyPattern, setYearlyPattern] = useState<YearlyPattern>('date');
  const [yearlyMonth, setYearlyMonth] = useState(Number(initialScheduleDate.slice(5, 7)));
  const [yearlyDate, setYearlyDate] = useState(Number(initialScheduleDate.slice(8, 10)));
  const [yearlyOrdinal, setYearlyOrdinal] = useState<MonthlyOrdinal>(
    ordinalInMonth(initialScheduleDate),
  );
  const [yearlyWeekday, setYearlyWeekday] = useState(isoWeekday(initialScheduleDate));
  const [endMode, setEndMode] = useState<TaskRecurrenceEndMode>('never');
  const [endAfterCount, setEndAfterCount] = useState(10);
  const [endOnDate, setEndOnDate] = useState(initialScheduleDate);
  const [addReminder, setAddReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('12:00');
  const [addDeadline, setAddDeadline] = useState(task?.deadline != null);
  const [deadlineOffsetDays, setDeadlineOffsetDays] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const date = revision?.start_date
      ?? task?.deadline
      ?? task?.start_date
      ?? planningDate;
    const config = recurrenceRuleConfigRecord(revision?.rule_config);
    const monthlyKind = config.monthly_kind;
    const yearlyKind = config.yearly_kind;
    setRuleMode(revision?.rule_mode ?? 'calendar');
    setFrequency(revision?.frequency ?? 'weekly');
    setIntervalCount(revision?.interval_count ?? 1);
    setScheduleDate(date);
    setSelectedWeekdays(
      Array.isArray(config.weekdays)
        ? config.weekdays.filter((day): day is number => (
            typeof day === 'number' && day >= 1 && day <= 7
          ))
        : [isoWeekday(date)],
    );
    setMonthlyPattern(
      monthlyKind === 'ordinal_weekday'
        ? 'weekday_position'
        : monthlyKind === 'ordinal_day_type'
          ? 'day_type_position'
          : 'date',
    );
    setMonthlyDate(
      monthlyKind === 'last_day'
        ? 'last'
        : typeof config.month_day === 'number'
          ? config.month_day
          : Number(date.slice(8, 10)),
    );
    setMonthlyOrdinal(recurrenceOrdinal(config.ordinal, date));
    setMonthlyWeekday(recurrenceWeekday(config.weekday, date));
    setMonthlyDayType(config.day_type === 'weekend_day' ? 'weekend_day' : 'weekday');
    setYearlyPattern(
      yearlyKind === 'ordinal_weekday'
        ? 'weekday_position'
        : yearlyKind === 'last_day'
          ? 'last_day'
          : 'date',
    );
    setYearlyMonth(
      typeof config.month === 'number' ? config.month : Number(date.slice(5, 7)),
    );
    setYearlyDate(
      typeof config.month_day === 'number'
        ? config.month_day
        : Number(date.slice(8, 10)),
    );
    setYearlyOrdinal(recurrenceOrdinal(config.ordinal, date));
    setYearlyWeekday(recurrenceWeekday(config.weekday, date));
    setEndMode(revision?.end_mode ?? 'never');
    setEndAfterCount(revision?.end_after_count ?? 10);
    setEndOnDate(revision?.end_on_date ?? date);
    setAddReminder(revision?.reminder_local_time !== null && revision !== null);
    setReminderTime(revision?.reminder_local_time?.slice(0, 5) ?? '12:00');
    setAddDeadline(revision
      ? revision.deadline_offset_days !== null
      : task?.deadline != null);
    setDeadlineOffsetDays(revision?.deadline_offset_days ?? 0);
    setPending(false);
  }, [open, planningDate, revision, task]);

  const ruleConfig = useMemo<TaskRecurrenceRuleConfig>(() => (
    frequency === 'weekly'
      ? { weekdays: selectedWeekdays }
      : frequency === 'monthly'
        ? monthlyPattern === 'date'
          ? monthlyDate === 'last'
            ? { monthly_kind: 'last_day' }
            : { monthly_kind: 'day_of_month', month_day: monthlyDate }
          : monthlyPattern === 'weekday_position'
            ? {
                monthly_kind: 'ordinal_weekday',
                ordinal: monthlyOrdinal,
                weekday: monthlyWeekday,
              }
            : {
                monthly_kind: 'ordinal_day_type',
                ordinal: monthlyOrdinal,
                day_type: monthlyDayType,
              }
        : frequency === 'yearly'
          ? yearlyPattern === 'date'
            ? {
                yearly_kind: 'fixed_date',
                month: yearlyMonth,
                month_day: yearlyDate,
              }
            : yearlyPattern === 'last_day'
              ? {
                  yearly_kind: 'last_day',
                  month: yearlyMonth,
                }
              : {
                  yearly_kind: 'ordinal_weekday',
                  month: yearlyMonth,
                  ordinal: yearlyOrdinal,
                  weekday: yearlyWeekday,
                }
        : {}
  ), [
    frequency,
    monthlyDate,
    monthlyDayType,
    monthlyOrdinal,
    monthlyPattern,
    monthlyWeekday,
    selectedWeekdays,
    yearlyDate,
    yearlyMonth,
    yearlyOrdinal,
    yearlyPattern,
    yearlyWeekday,
  ]);
  const preview = getTaskRecurrencePreviewDates({
    startDate: scheduleDate,
    frequency,
    intervalCount,
    ruleConfig,
    endMode,
    endAfterCount,
    endOnDate,
    limit: 3,
  });
  const alignedCadenceDate = useMemo(() => (
    ruleMode === 'calendar' && (frequency === 'monthly' || frequency === 'yearly')
      ? getTaskRecurrencePreviewDates({
          startDate: scheduleDate,
          frequency,
          intervalCount,
          ruleConfig,
          limit: 1,
        })[0] ?? null
      : null
  ), [frequency, intervalCount, ruleConfig, ruleMode, scheduleDate]);
  const effectiveScheduleDate = alignedCadenceDate ?? scheduleDate;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || mode !== 'connected') return;
    setPending(true);
    try {
      const result = editing
        ? await (onEdit ?? recurrenceService.edit.bind(recurrenceService))({
            definition,
            revision,
            name: definition.name,
            ruleMode,
            frequency,
            intervalCount,
            scheduleDate: effectiveScheduleDate,
            ruleConfig,
            endMode,
            endAfterCount: endMode === 'after' ? endAfterCount : null,
            endOnDate: endMode === 'on_date' ? endOnDate : null,
            reminderLocalTime: addReminder ? reminderTime : null,
            deadlineOffsetDays: addDeadline ? deadlineOffsetDays : null,
          })
        : task
          ? await recurrenceService.createFromTask({
              taskId: task.id,
              name: task.title,
              ruleMode,
              frequency,
              intervalCount,
              scheduleDate: effectiveScheduleDate,
              ruleConfig,
              endMode,
              endAfterCount: endMode === 'after' ? endAfterCount : null,
              endOnDate: endMode === 'on_date' ? endOnDate : null,
              reminderLocalTime: addReminder ? reminderTime : null,
              deadlineOffsetDays: addDeadline ? deadlineOffsetDays : null,
            })
          : null;
      if (!result) throw new Error('The recurrence is unavailable');
      if (ruleMode === 'calendar') {
        for (const offset of [90, 180, 270, 365]) {
          await recurrenceService.evaluate(
            result.definition.id,
            addTaskCalendarDays(planningDate, offset),
          );
        }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{editing ? 'Edit Repeat' : 'Repeat Task'}</DialogTitle></DialogHeader>
        <DialogBody>
          <form
            id={`task-repeat-form-${task?.id ?? definition?.id ?? 'unavailable'}`}
            onSubmit={save}
            className="space-y-4"
          >
            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
              <span className="text-sm font-medium">Repeat</span>
              <Select
                value={ruleMode}
                onValueChange={(value) => setRuleMode(value as TaskRecurrenceRuleMode)}
              >
                <SelectTrigger aria-label="Repeat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="after_completion">After Completion</SelectItem>
                  <SelectItem value="calendar">On a Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-foreground/[0.04] p-4">
              <div className="grid grid-cols-[auto_5rem_1fr] items-center gap-2">
                <span className="text-sm">Every</span>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={intervalCount}
                  onChange={(event) => setIntervalCount(Math.max(1, Number(event.target.value)))}
                />
                <Select
                  value={frequency}
                  onValueChange={(value) => setFrequency(value as TaskRecurrenceFrequency)}
                >
                  <SelectTrigger aria-label="Frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Days</SelectItem>
                    <SelectItem value="weekly">Weeks</SelectItem>
                    <SelectItem value="monthly">Months</SelectItem>
                    <SelectItem value="yearly">Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {ruleMode === 'calendar' && frequency === 'weekly' ? (
                <div className="mt-3 flex justify-between gap-1" aria-label="Repeat Weekdays">
                  {weekdayLabels.map(([day, label], index) => (
                    <Button
                      key={day}
                      type="button"
                      variant={selectedWeekdays.includes(day) ? 'outline-success' : 'outline'}
                      size="icon"
                      className="h-9 w-9"
                      aria-label={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index]}
                      aria-pressed={selectedWeekdays.includes(day)}
                      onClick={() => setSelectedWeekdays((current) => (
                        current.includes(day)
                          ? current.length === 1 ? current : current.filter((value) => value !== day)
                          : [...current, day].sort()
                      ))}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              ) : null}
              {ruleMode === 'calendar' && frequency === 'monthly' ? (
                <div className="mt-3 grid gap-3" data-task-monthly-cadence>
                  <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                    <span className="text-sm">On</span>
                    <Select
                      value={monthlyPattern}
                      onValueChange={(value) => setMonthlyPattern(value as MonthlyPattern)}
                    >
                      <SelectTrigger aria-label="Monthly Pattern">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Calendar Date</SelectItem>
                        <SelectItem value="last_day">Last Day</SelectItem>
                        <SelectItem value="weekday_position">Weekday Position</SelectItem>
                        <SelectItem value="day_type_position">Day-Type Position</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {monthlyPattern === 'date' ? (
                    <Select
                      value={String(monthlyDate)}
                      onValueChange={(value) => setMonthlyDate(
                        value === 'last' ? 'last' : Number(value),
                      )}
                    >
                      <SelectTrigger aria-label="Monthly Date">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                          <SelectItem key={day} value={String(day)}>
                            {ordinalNumber(day)}
                          </SelectItem>
                        ))}
                        <SelectItem value="last">Last Day</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={String(monthlyOrdinal)}
                        onValueChange={(value) => setMonthlyOrdinal(Number(value) as MonthlyOrdinal)}
                      >
                        <SelectTrigger aria-label="Monthly Ordinal">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {monthlyOrdinals.map(([ordinal, label]) => (
                            <SelectItem key={ordinal} value={String(ordinal)}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {monthlyPattern === 'weekday_position' ? (
                        <Select
                          value={String(monthlyWeekday)}
                          onValueChange={(value) => setMonthlyWeekday(Number(value))}
                        >
                          <SelectTrigger aria-label="Monthly Weekday">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {weekdays.map(([day, label]) => (
                              <SelectItem key={day} value={String(day)}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select
                          value={monthlyDayType}
                          onValueChange={(value) => setMonthlyDayType(
                            value as 'weekday' | 'weekend_day',
                          )}
                        >
                          <SelectTrigger aria-label="Monthly Day Type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekday">Weekday</SelectItem>
                            <SelectItem value="weekend_day">Weekend Day</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
              {ruleMode === 'calendar' && frequency === 'yearly' ? (
                <div className="mt-3 grid gap-3" data-task-yearly-cadence>
                  <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                    <span className="text-sm">On</span>
                    <Select
                      value={yearlyPattern}
                      onValueChange={(value) => setYearlyPattern(value as YearlyPattern)}
                    >
                      <SelectTrigger aria-label="Yearly Pattern">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Calendar Date</SelectItem>
                        <SelectItem value="weekday_position">Weekday Position</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={String(yearlyMonth)}
                      onValueChange={(value) => setYearlyMonth(Number(value))}
                    >
                      <SelectTrigger aria-label="Yearly Month">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map(([month, label]) => (
                          <SelectItem key={month} value={String(month)}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {yearlyPattern === 'date' ? (
                      <Select
                        value={String(yearlyDate)}
                        onValueChange={(value) => setYearlyDate(Number(value))}
                      >
                        <SelectTrigger aria-label="Yearly Date">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                            <SelectItem key={day} value={String(day)}>
                              {ordinalNumber(day)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : yearlyPattern === 'last_day' ? (
                      <div
                        className="flex min-h-10 items-center px-3 text-sm text-muted-foreground"
                        aria-label="Yearly Last Day"
                      >
                        Last Day
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={String(yearlyOrdinal)}
                          onValueChange={(value) => setYearlyOrdinal(Number(value) as MonthlyOrdinal)}
                        >
                          <SelectTrigger aria-label="Yearly Ordinal">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {monthlyOrdinals.map(([ordinal, label]) => (
                              <SelectItem key={ordinal} value={String(ordinal)}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(yearlyWeekday)}
                          onValueChange={(value) => setYearlyWeekday(Number(value))}
                        >
                          <SelectTrigger aria-label="Yearly Weekday">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {weekdays.map(([day, label]) => (
                              <SelectItem key={day} value={String(day)}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>
                  {ruleMode === 'after_completion'
                    ? 'Next Occurrence'
                    : addDeadline
                      ? 'Next Deadline'
                      : 'Next Start'}
                </span>
                <DatePickerField
                  value={effectiveScheduleDate}
                  onValueChange={setScheduleDate}
                  todayDate={planningDate}
                />
              </label>
              <div className="space-y-1 text-sm">
                <span>Ends</span>
                <Select
                  value={endMode}
                  onValueChange={(value) => setEndMode(value as TaskRecurrenceEndMode)}
                >
                  <SelectTrigger aria-label="Ends">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="after">After</SelectItem>
                    <SelectItem value="on_date">On Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {endMode === 'after' ? (
                <Input
                  type="number"
                  min={1}
                  value={endAfterCount}
                  aria-label="Number of Occurrences"
                  onChange={(event) => setEndAfterCount(Math.max(1, Number(event.target.value)))}
                />
              ) : endMode === 'on_date' ? (
                <DatePickerField
                  value={endOnDate}
                  onValueChange={setEndOnDate}
                  todayDate={planningDate}
                  aria-label="End Date"
                />
              ) : null}
            </div>
            {ruleMode === 'calendar' && preview.length > 0 ? (
              <div
                className="space-y-1 text-sm text-muted-foreground"
                aria-label="Next Three Occurrences"
              >
                <span className="font-medium text-foreground">Next</span>
                <ol className="space-y-1">
                  {preview.map((date) => (
                    <li key={date}>
                      {addDeadline ? (
                        <>
                          <span className="text-foreground">Start</span>{' '}
                          {formatTaskDateControlLabel(
                            addTaskCalendarDays(date, -deadlineOffsetDays),
                            planningDate,
                          )}
                          <span aria-hidden="true"> · </span>
                          <span className="text-foreground">Deadline</span>{' '}
                          {formatTaskDateControlLabel(date, planningDate)}
                        </>
                      ) : (
                        <>
                          <span className="text-foreground">Start</span>{' '}
                          {formatTaskDateControlLabel(date, planningDate)}
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            <OptionSwitch
              label="Add Reminders"
              checked={addReminder}
              onCheckedChange={setAddReminder}
            >
              {addReminder ? (
                <Input
                  type="time"
                  value={reminderTime}
                  aria-label="Reminder Time"
                  onChange={(event) => setReminderTime(event.target.value)}
                />
              ) : null}
            </OptionSwitch>
            <OptionSwitch
              label="Add Deadlines"
              checked={addDeadline}
              onCheckedChange={setAddDeadline}
            >
              {addDeadline ? (
                <label className="flex items-center gap-2 text-sm">
                  <span>Start</span>
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={deadlineOffsetDays}
                    aria-label="Start Days Earlier"
                    onChange={(event) => setDeadlineOffsetDays(
                      Math.max(0, Number(event.target.value)),
                    )}
                  />
                  <span>Days Earlier</span>
                </label>
              ) : null}
            </OptionSwitch>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={`task-repeat-form-${task?.id ?? definition?.id ?? 'unavailable'}`}
            data-bathos-form-submit="true"
            disabled={pending || mode !== 'connected'}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function recurrenceRuleConfigRecord(
  value: TaskRecurrenceRuleConfig | null | undefined,
): Record<string, unknown> {
  return value && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recurrenceOrdinal(value: unknown, date: string): MonthlyOrdinal {
  return value === -1 || value === 1 || value === 2 || value === 3
    || value === 4 || value === 5
    ? value
    : ordinalInMonth(date);
}

function recurrenceWeekday(value: unknown, date: string): number {
  return typeof value === 'number' && value >= 1 && value <= 7
    ? value
    : isoWeekday(date);
}

function OptionSwitch({
  label,
  checked,
  onCheckedChange,
  children,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function isoWeekday(value: string): number {
  const day = new Date(`${value}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function ordinalInMonth(value: string): -1 | 1 | 2 | 3 | 4 | 5 {
  const day = Number(value.slice(8, 10));
  const ordinal = Math.ceil(day / 7) as 1 | 2 | 3 | 4 | 5;
  const nextSameWeekday = day + 7;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return nextSameWeekday > lastDay ? -1 : ordinal;
}

function ordinalNumber(value: number): string {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}
