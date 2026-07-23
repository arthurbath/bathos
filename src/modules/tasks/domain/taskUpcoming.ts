import type { TaskProject, TaskTodo } from '@/modules/tasks/types/tasks';

type UpcomingDatedItem = Pick<TaskTodo, 'start_date' | 'deadline'>
  | Pick<TaskProject, 'start_date' | 'deadline'>;

export type TaskUpcomingGroup = {
  key: string;
  label: string;
  kind: 'day' | 'month' | 'year';
  date: string;
};

export type TaskUpcomingEntry =
  | {
    kind: 'project';
    item: TaskProject;
    controllingDate: string;
    sourceIndex: number;
  }
  | {
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

export function compareTaskUpcomingDates(
  left: UpcomingDatedItem,
  right: UpcomingDatedItem,
  planningDate: string,
): number {
  return (getTaskUpcomingDate(left, planningDate) ?? '')
    .localeCompare(getTaskUpcomingDate(right, planningDate) ?? '');
}

export function getTaskUpcomingSections(
  projects: readonly TaskProject[],
  tasks: readonly TaskTodo[],
  planningDate: string,
  locale?: string,
): TaskUpcomingSection[] {
  const groups = new Map<string, TaskUpcomingSection>();
  const entries: TaskUpcomingEntry[] = [
    ...projects.flatMap((project, sourceIndex): TaskUpcomingEntry[] => {
      const controllingDate = getTaskUpcomingDate(project, planningDate);
      return controllingDate === null
        ? []
        : [{ kind: 'project', item: project, controllingDate, sourceIndex }];
    }),
    ...tasks.flatMap((task, sourceIndex): TaskUpcomingEntry[] => {
      const controllingDate = getTaskUpcomingDate(task, planningDate);
      return controllingDate === null
        ? []
        : [{ kind: 'task', item: task, controllingDate, sourceIndex }];
    }),
  ];

  for (const entry of entries) {
    const group = getTaskUpcomingGroup(entry.controllingDate, planningDate, locale);
    const current = groups.get(group.key);
    if (current) current.entries.push(entry);
    else groups.set(group.key, { ...group, entries: [entry] });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      entries: group.entries.sort(compareTaskUpcomingEntries),
    }))
    .sort((left, right) => (
      left.entries[0].controllingDate.localeCompare(right.entries[0].controllingDate)
    ));
}

function compareTaskUpcomingEntries(
  left: TaskUpcomingEntry,
  right: TaskUpcomingEntry,
): number {
  return left.controllingDate.localeCompare(right.controllingDate)
    || (left.kind === right.kind ? left.sourceIndex - right.sourceIndex : left.kind === 'project' ? -1 : 1);
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
