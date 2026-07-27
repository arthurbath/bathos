import type { TaskTodo } from '@/modules/tasks/types/tasks';

type UpcomingDatedItem = Pick<TaskTodo, 'start_date' | 'deadline'>;

export type TaskUpcomingGroup = {
  key: string;
  label: string;
  kind: 'day' | 'month' | 'year';
  date: string;
};

export type TaskUpcomingEntry = {
    kind: 'task';
    item: TaskTodo;
    controllingDate: string;
    sourceIndex: number;
};

export type TaskUpcomingSection = TaskUpcomingGroup & {
  entries: TaskUpcomingEntry[];
};

export function getTaskUpcomingDate(
  item: UpcomingDatedItem,
  planningDate: string,
): string | null {
  if (item.start_date !== null && item.start_date > planningDate) {
    return item.start_date;
  }
  if (item.deadline !== null && item.deadline > planningDate) {
    return item.deadline;
  }
  return null;
}

export function getTaskUpcomingGroup(
  itemDate: string,
  planningDate: string,
  locale?: string,
): TaskUpcomingGroup {
  const sevenDayBoundary = addCalendarDays(planningDate, 7);
  const twelveMonthBoundary = addCalendarMonths(planningDate, 12);
  const date = parseCalendarDate(itemDate);

  if (itemDate <= sevenDayBoundary) {
    return {
      key: `day:${itemDate}`,
      label: new Intl.DateTimeFormat(locale, {
        timeZone: 'UTC',
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(date),
      kind: 'day',
      date: itemDate,
    };
  }

  if (itemDate <= twelveMonthBoundary) {
    return {
      key: `month:${itemDate.slice(0, 7)}`,
      label: new Intl.DateTimeFormat(locale, {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric',
      }).format(date),
      kind: 'month',
      date: `${itemDate.slice(0, 7)}-01`,
    };
  }

  return {
    key: `year:${itemDate.slice(0, 4)}`,
    label: itemDate.slice(0, 4),
    kind: 'year',
    date: `${itemDate.slice(0, 4)}-01-01`,
  };
}

export function getTaskUpcomingCanonicalStart(
  group: TaskUpcomingGroup,
  planningDate: string,
): string {
  if (group.kind === 'day') return group.date;
  if (group.kind === 'month') {
    const firstGroupedMonthDate = addCalendarDays(planningDate, 8);
    return group.date > firstGroupedMonthDate ? group.date : firstGroupedMonthDate;
  }
  const firstGroupedYearDate = addCalendarDays(
    addCalendarMonths(planningDate, 12),
    1,
  );
  return group.date > firstGroupedYearDate ? group.date : firstGroupedYearDate;
}

export function compareTaskUpcomingDates(
  left: UpcomingDatedItem,
  right: UpcomingDatedItem,
  planningDate: string,
): number {
  return (getTaskUpcomingDate(left, planningDate) ?? '')
    .localeCompare(getTaskUpcomingDate(right, planningDate) ?? '');
}

export function getTaskUpcomingSections(
  tasks: readonly TaskTodo[],
  planningDate: string,
  locale?: string,
): TaskUpcomingSection[] {
  const groups = new Map<string, TaskUpcomingSection>();
  const entries: TaskUpcomingEntry[] = tasks.flatMap((task, sourceIndex): TaskUpcomingEntry[] => {
      const controllingDate = getTaskUpcomingDate(task, planningDate);
      return controllingDate === null
        ? []
        : [{ kind: 'task', item: task, controllingDate, sourceIndex }];
    });

  for (const entry of entries) {
    const group = getTaskUpcomingGroup(entry.controllingDate, planningDate, locale);
    const current = groups.get(group.key);
    if (current) current.entries.push(entry);
    else groups.set(group.key, { ...group, entries: [entry] });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      date: getTaskUpcomingCanonicalStart(group, planningDate),
      entries: orderTaskUpcomingSectionEntries(group.entries),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function orderTaskUpcomingSectionEntries(
  entries: readonly TaskUpcomingEntry[],
): TaskUpcomingEntry[] {
  return [...entries].sort((left, right) => left.sourceIndex - right.sourceIndex);
}

function addCalendarDays(value: string, days: number): string {
  const date = parseCalendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatCalendarDate(date);
}

function addCalendarMonths(value: string, months: number): string {
  const date = parseCalendarDate(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return formatCalendarDate(date);
}

function parseCalendarDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatCalendarDate(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
