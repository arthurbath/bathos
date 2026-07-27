import {
  addTaskCalendarDays,
  isTaskCalendarDate,
} from '@/modules/tasks/domain/taskDates';
import type {
  TaskRecurrenceEndMode,
  TaskRecurrenceFrequency,
  TaskRecurrenceRuleConfig,
} from '@/modules/tasks/types/tasks';

export type TaskRecurrencePreviewInput = {
  startDate: string;
  frequency: TaskRecurrenceFrequency;
  intervalCount: number;
  ruleConfig?: TaskRecurrenceRuleConfig;
  endMode?: TaskRecurrenceEndMode;
  endAfterCount?: number | null;
  endOnDate?: string | null;
  limit?: number;
};

export function getTaskRecurrencePreviewDates(
  input: TaskRecurrencePreviewInput,
): string[] {
  if (
    !isTaskCalendarDate(input.startDate)
    || !Number.isInteger(input.intervalCount)
    || input.intervalCount < 1
  ) return [];
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
  const dates: string[] = [];
  for (let step = 0; step < 10_000 && dates.length < limit; step += 1) {
    if (
      input.endMode === 'after'
      && step >= (input.endAfterCount ?? 0)
    ) break;
    const date = recurrenceDateForStep(input, step);
    if (!date) break;
    if (input.endMode === 'on_date' && input.endOnDate && date > input.endOnDate) break;
    dates.push(date);
  }
  return dates;
}

function recurrenceDateForStep(
  input: TaskRecurrencePreviewInput,
  step: number,
): string | null {
  if (input.frequency === 'daily') {
    return addTaskCalendarDays(input.startDate, input.intervalCount * step);
  }
  if (input.frequency === 'yearly') {
    return addMonthsClamped(input.startDate, input.intervalCount * step * 12);
  }
  if (input.frequency === 'monthly') {
    const month = addMonthsClamped(input.startDate.slice(0, 8) + '01', input.intervalCount * step);
    const config = input.ruleConfig ?? {};
    if (config.monthly_kind === 'ordinal_weekday') {
      return ordinalWeekdayInMonth(
        month,
        config.ordinal ?? 1,
        config.weekday ?? isoWeekday(input.startDate),
      );
    }
    const day = config.month_day ?? Number(input.startDate.slice(8, 10));
    return setClampedMonthDay(month, day);
  }

  const weekdays = [...new Set(
    input.ruleConfig?.weekdays?.filter((day) => day >= 1 && day <= 7)
      ?? [isoWeekday(input.startDate)],
  )].sort((left, right) => left - right);
  let candidate = addTaskCalendarDays(input.startDate, -1);
  let found = -1;
  for (let guard = 0; guard < 366_000; guard += 1) {
    candidate = addTaskCalendarDays(candidate, 1);
    const weekOffset = Math.floor(
      (utcDay(candidate) - utcDay(startOfIsoWeek(input.startDate))) / 7,
    );
    if (
      weekOffset % input.intervalCount === 0
      && weekdays.includes(isoWeekday(candidate))
    ) {
      found += 1;
      if (found === step) return candidate;
    }
  }
  return null;
}

function addMonthsClamped(value: string, months: number): string {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const targetMonthIndex = year * 12 + month - 1 + months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return formatDate(targetYear, targetMonth + 1, Math.min(day, lastDay));
}

function setClampedMonthDay(monthStart: string, day: number): string {
  const year = Number(monthStart.slice(0, 4));
  const month = Number(monthStart.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return formatDate(year, month, Math.min(Math.max(day, 1), lastDay));
}

function ordinalWeekdayInMonth(
  monthStart: string,
  ordinal: -1 | 1 | 2 | 3 | 4 | 5,
  weekday: number,
): string | null {
  const year = Number(monthStart.slice(0, 4));
  const month = Number(monthStart.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (ordinal === -1) {
    for (let day = lastDay; day >= 1; day -= 1) {
      const date = formatDate(year, month, day);
      if (isoWeekday(date) === weekday) return date;
    }
    return null;
  }
  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const date = formatDate(year, month, day);
    if (isoWeekday(date) !== weekday) continue;
    count += 1;
    if (count === ordinal) return date;
  }
  return null;
}

function startOfIsoWeek(value: string): string {
  return addTaskCalendarDays(value, 1 - isoWeekday(value));
}

function isoWeekday(value: string): number {
  const day = new Date(`${value}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function utcDay(value: string): number {
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000);
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
