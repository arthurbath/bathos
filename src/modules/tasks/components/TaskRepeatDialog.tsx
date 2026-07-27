import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

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
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { getTaskRecurrencePreviewDates } from '@/modules/tasks/domain/taskRecurrenceDates';
import {
  addTaskCalendarDays,
  formatTaskDateControlLabel,
} from '@/modules/tasks/domain/taskDates';
import { useTasksRuntime } from '@/modules/tasks/runtime/tasksRuntimeContext';
import type {
  TaskRecurrenceEndMode,
  TaskRecurrenceFrequency,
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

export function TaskRepeatDialog({
  task,
  planningDate,
  open,
  onOpenChange,
}: {
  task: TaskTodo;
  planningDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { mode, recurrenceService } = useTasksRuntime();
  const [ruleMode, setRuleMode] = useState<TaskRecurrenceRuleMode>('calendar');
  const [frequency, setFrequency] = useState<TaskRecurrenceFrequency>('weekly');
  const [intervalCount, setIntervalCount] = useState(1);
  const [scheduleDate, setScheduleDate] = useState(
    task.deadline ?? task.start_date ?? planningDate,
  );
  const [weekdays, setWeekdays] = useState<number[]>([
    isoWeekday(task.deadline ?? task.start_date ?? planningDate),
  ]);
  const [monthlyKind, setMonthlyKind] = useState<'day_of_month' | 'ordinal_weekday'>(
    'day_of_month',
  );
  const [endMode, setEndMode] = useState<TaskRecurrenceEndMode>('never');
  const [endAfterCount, setEndAfterCount] = useState(10);
  const [endOnDate, setEndOnDate] = useState(scheduleDate);
  const [addReminder, setAddReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('12:00');
  const [addDeadline, setAddDeadline] = useState(task.deadline !== null);
  const [deadlineOffsetDays, setDeadlineOffsetDays] = useState(0);
  const [pending, setPending] = useState(false);

  const ruleConfig = useMemo<TaskRecurrenceRuleConfig>(() => (
    frequency === 'weekly'
      ? { weekdays }
      : frequency === 'monthly'
        ? monthlyKind === 'day_of_month'
          ? { monthly_kind: monthlyKind, month_day: Number(scheduleDate.slice(8, 10)) }
          : {
              monthly_kind: monthlyKind,
              ordinal: ordinalInMonth(scheduleDate),
              weekday: isoWeekday(scheduleDate),
            }
        : {}
  ), [frequency, monthlyKind, scheduleDate, weekdays]);
  const preview = getTaskRecurrencePreviewDates({
    startDate: scheduleDate,
    frequency,
    intervalCount,
    ruleConfig,
    endMode,
    endAfterCount,
    endOnDate,
    limit: 5,
  });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || mode !== 'connected') return;
    setPending(true);
    try {
      const result = await recurrenceService.createFromTask({
        taskId: task.id,
        name: task.title,
        ruleMode,
        frequency,
        intervalCount,
        scheduleDate,
        ruleConfig,
        endMode,
        endAfterCount: endMode === 'after' ? endAfterCount : null,
        endOnDate: endMode === 'on_date' ? endOnDate : null,
        reminderLocalTime: addReminder ? reminderTime : null,
        deadlineOffsetDays: addDeadline ? deadlineOffsetDays : null,
      });
      if (ruleMode === 'calendar') {
        for (const offset of [90, 180, 270, 365]) {
          await recurrenceService.evaluate(
            result.definition.id,
            addTaskCalendarDays(planningDate, offset),
          );
        }
      }
      toast({ title: 'Repeat Saved' });
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
        <DialogHeader><DialogTitle>Repeat Task</DialogTitle></DialogHeader>
        <DialogBody>
          <form id={`task-repeat-form-${task.id}`} onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
              <span className="text-sm font-medium">Repeat</span>
              <select
                value={ruleMode}
                onChange={(event) => setRuleMode(event.target.value as TaskRecurrenceRuleMode)}
                className={selectClassName}
              >
                <option value="after_completion">After Completion</option>
                <option value="calendar">On a Schedule</option>
              </select>
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
                <select
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as TaskRecurrenceFrequency)}
                  className={selectClassName}
                >
                  <option value="daily">Days</option>
                  <option value="weekly">Weeks</option>
                  <option value="monthly">Months</option>
                  <option value="yearly">Years</option>
                </select>
              </div>
              {ruleMode === 'calendar' && frequency === 'weekly' ? (
                <div className="mt-3 flex justify-between gap-1" aria-label="Repeat Weekdays">
                  {weekdayLabels.map(([day, label], index) => (
                    <Button
                      key={day}
                      type="button"
                      variant={weekdays.includes(day) ? 'outline-success' : 'outline'}
                      size="icon"
                      className="h-9 w-9"
                      aria-label={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index]}
                      aria-pressed={weekdays.includes(day)}
                      onClick={() => setWeekdays((current) => (
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
                <select
                  value={monthlyKind}
                  onChange={(event) => setMonthlyKind(
                    event.target.value as 'day_of_month' | 'ordinal_weekday',
                  )}
                  className={`${selectClassName} mt-3`}
                >
                  <option value="day_of_month">Same Day of Month</option>
                  <option value="ordinal_weekday">Same Weekday Position</option>
                </select>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>{addDeadline ? 'Next Deadline' : 'Next Start'}</span>
                <DatePickerField
                  value={scheduleDate}
                  onValueChange={setScheduleDate}
                  todayDate={planningDate}
                />
              </label>
              <div className="space-y-1 text-sm">
                <span>Ends</span>
                <select
                  aria-label="Ends"
                  value={endMode}
                  onChange={(event) => setEndMode(event.target.value as TaskRecurrenceEndMode)}
                  className={selectClassName}
                >
                  <option value="never">Never</option>
                  <option value="after">After</option>
                  <option value="on_date">On Date</option>
                </select>
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
              <p className="text-sm text-muted-foreground">
                Next: {preview.map((date) => formatTaskDateControlLabel(
                  date,
                  planningDate,
                )).join(', ')}
              </p>
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
            form={`task-repeat-form-${task.id}`}
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

const selectClassName = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
