import {
  addTaskCalendarDays,
  isTaskCalendarDate,
} from '@/modules/tasks/domain/taskDates';
import type {
  TaskRecurrenceDateBasis,
  TaskRecurrenceDayType,
  TaskRecurrenceEndMode,
  TaskRecurrenceFrequency,
  TaskRecurrenceRuleConfig,
} from '@/modules/tasks/types/tasks';

export type TaskRecurrenceDatePair = {
  startDate: string;
  deadline: string | null;
};

export function getTaskRecurrenceDatePair(
  anchorDate: string,
  dateBasis: TaskRecurrenceDateBasis,
  deadlineAfterStartDays: number | null,
): TaskRecurrenceDatePair | null {
  if (!isTaskCalendarDate(anchorDate)) return null;
  if (deadlineAfterStartDays === null) {
    return { startDate: anchorDate, deadline: null };
  }
  if (!Number.isInteger(deadlineAfterStartDays) || deadlineAfterStartDays < 0) return null;
  if (dateBasis === 'deadline') {
    return {
      startDate: addTaskCalendarDays(anchorDate, -deadlineAfterStartDays),
      deadline: anchorDate,
    };
  }
  return {
    startDate: anchorDate,
    deadline: addTaskCalendarDays(anchorDate, deadlineAfterStartDays),
  };
}

export function getTaskRecurrenceAnchorFromNextStart(
  nextStartDate: string,
  dateBasis: TaskRecurrenceDateBasis,
  deadlineAfterStartDays: number | null,
): string | null {
  if (!isTaskCalendarDate(nextStartDate)) return null;
  if (dateBasis === 'deadline' && deadlineAfterStartDays !== null) {
    if (!Number.isInteger(deadlineAfterStartDays) || deadlineAfterStartDays < 0) return null;
    return addTaskCalendarDays(nextStartDate, deadlineAfterStartDays);
  }
  return nextStartDate;
}

export function getTaskRecurrencePositionedDate(
  year: number,
  month: number,
  position: number | 'last',
  dayType: TaskRecurrenceDayType,
): string | null {
  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || month < 1
    || month > 12
    || (position !== 'last' && (!Number.isInteger(position) || position < 1))
  ) return null;
  return positionedDateInMonth(formatDate(year, month, 1), position, dayType);
}

export function isTaskRecurrenceAnchorDate(
  date: string,
  frequency: TaskRecurrenceFrequency,
  ruleConfig: TaskRecurrenceRuleConfig,
): boolean {
  if (!isTaskCalendarDate(date)) return false;
  if (frequency === 'daily') return true;
  if (frequency === 'weekly') {
    return (ruleConfig.weekdays ?? []).includes(isoWeekday(date));
  }
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (frequency === 'yearly' && !(ruleConfig.months ?? []).includes(month)) return false;
  return getTaskRecurrencePositionedDate(
    year,
    month,
    ruleConfig.position ?? Number(date.slice(8, 10)),
    ruleConfig.day_type ?? 'day',
  ) === date;
}

export type TaskRecurrencePreviewInput = {
  startDate: string;
  frequency: TaskRecurrenceFrequency;
  intervalCount: number;
  ruleConfig?: TaskRecurrenceRuleConfig;
  endMode?: TaskRecurrenceEndMode;
  endAfterCount?: number | null;
  endOnDate?: string | null;
  afterDateExclusive?: string | null;
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
    if (input.afterDateExclusive && date <= input.afterDateExclusive) continue;
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
    return yearlyDateForStep(input, step);
  }
  if (input.frequency === 'monthly') {
    const config = input.ruleConfig ?? {};
    let found = -1;
    for (let monthStep = 0; monthStep < 1_200; monthStep += 1) {
      const month = addMonthsClamped(
        input.startDate.slice(0, 8) + '01',
        input.intervalCount * monthStep,
      );
      const candidate = monthlyDateForMonth(month, input.startDate, config);
      if (!candidate || candidate < input.startDate) continue;
      found += 1;
      if (found === step) return candidate;
    }
    return null;
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

function yearlyDateForStep(
  input: TaskRecurrencePreviewInput,
  step: number,
): string | null {
  const config = input.ruleConfig ?? {};
  const startYear = Number(input.startDate.slice(0, 4));
  let found = -1;
  for (let yearStep = 0; yearStep < 1_200; yearStep += 1) {
    const year = startYear + (input.intervalCount * yearStep);
    const months = config.version === 2
      ? normalizeMonths(config.months, Number(input.startDate.slice(5, 7)))
      : [config.month ?? Number(input.startDate.slice(5, 7))];
    for (const month of months) {
      let candidate: string | null;
      if (config.version === 2) {
        candidate = positionedDateInMonth(
          formatDate(year, month, 1),
          config.position ?? Number(input.startDate.slice(8, 10)),
          config.day_type ?? 'day',
        );
      } else if (config.yearly_kind === 'ordinal_weekday') {
        candidate = ordinalWeekdayInMonth(
          formatDate(year, month, 1),
          config.ordinal ?? 1,
          config.weekday ?? isoWeekday(input.startDate),
        );
      } else if (config.yearly_kind === 'last_day') {
        candidate = setClampedMonthDay(formatDate(year, month, 1), 31);
      } else {
        candidate = setClampedMonthDay(
          formatDate(year, month, 1),
          config.month_day ?? Number(input.startDate.slice(8, 10)),
        );
      }
      if (!candidate || candidate < input.startDate) continue;
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

function monthlyDateForMonth(
  month: string,
  startDate: string,
  config: TaskRecurrenceRuleConfig,
): string | null {
  if (config.version === 2) {
    return positionedDateInMonth(
      month,
      config.position ?? Number(startDate.slice(8, 10)),
      config.day_type ?? 'day',
    );
  }
  if (config.monthly_kind === 'last_day') {
    return lastDayInMonth(month);
  }
  if (config.monthly_kind === 'ordinal_weekday') {
    return ordinalWeekdayInMonth(
      month,
      config.ordinal ?? 1,
      config.weekday ?? isoWeekday(startDate),
    );
  }
  if (config.monthly_kind === 'ordinal_day_type') {
    return ordinalDayTypeInMonth(
      month,
      config.ordinal ?? 1,
      config.day_type === 'weekend_day' ? 'weekend_day' : 'weekday',
    );
  }
  return setClampedMonthDay(
    month,
    config.month_day ?? Number(startDate.slice(8, 10)),
  );
}

function positionedDateInMonth(
  monthStart: string,
  position: number | 'last',
  dayType: TaskRecurrenceDayType,
): string | null {
  if (dayType === 'day') {
    return position === 'last'
      ? lastDayInMonth(monthStart)
      : setClampedMonthDay(monthStart, position);
  }
  const ordinal = position === 'last' ? -1 : position;
  if (dayType === 'weekday' || dayType === 'weekend_day') {
    return ordinalDayTypeInMonth(monthStart, ordinal, dayType);
  }
  return ordinalWeekdayInMonth(monthStart, ordinal, namedWeekday(dayType));
}

function normalizeMonths(months: number[] | undefined, fallback: number): number[] {
  const normalized = [...new Set(
    (months ?? []).filter((month) => Number.isInteger(month) && month >= 1 && month <= 12),
  )].sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : [fallback];
}

function namedWeekday(dayType: Exclude<TaskRecurrenceDayType, 'day' | 'weekday' | 'weekend_day'>): number {
  return {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 7,
  }[dayType];
}

function lastDayInMonth(monthStart: string): string {
  const year = Number(monthStart.slice(0, 4));
  const month = Number(monthStart.slice(5, 7));
  return formatDate(
    year,
    month,
    new Date(Date.UTC(year, month, 0)).getUTCDate(),
  );
}

function ordinalWeekdayInMonth(
  monthStart: string,
  ordinal: number,
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

function ordinalDayTypeInMonth(
  monthStart: string,
  ordinal: number,
  dayType: 'weekday' | 'weekend_day',
): string | null {
  const year = Number(monthStart.slice(0, 4));
  const month = Number(monthStart.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const matches = (date: string) => (
    dayType === 'weekend_day'
      ? isoWeekday(date) >= 6
      : isoWeekday(date) <= 5
  );
  if (ordinal === -1) {
    for (let day = lastDay; day >= 1; day -= 1) {
      const date = formatDate(year, month, day);
      if (matches(date)) return date;
    }
    return null;
  }
  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const date = formatDate(year, month, day);
    if (!matches(date)) continue;
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
