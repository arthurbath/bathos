const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export class InvalidTaskCalendarRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskCalendarRangeError';
  }
}

export function normalizeTaskCalendarDate(
  value: string | null | undefined,
  fieldLabel: string,
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const normalized = value.trim();
  if (normalized === '') {
    return null;
  }
  if (!isTaskCalendarDate(normalized)) {
    throw new InvalidTaskCalendarRangeError(`${fieldLabel} must be a valid calendar date`);
  }
  return normalized;
}

export function assertTaskCalendarRange(
  startDate: string | null,
  deadline: string | null,
): void {
  if (startDate !== null && deadline !== null && deadline < startDate) {
    throw new InvalidTaskCalendarRangeError('Deadline cannot be earlier than the start date');
  }
}

export function isTaskCalendarDate(value: string): boolean {
  const match = calendarDatePattern.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function resolveTaskPlanningTimeZone(): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isTaskPlanningTimeZone(timeZone) ? timeZone : 'UTC';
}

export function isTaskPlanningTimeZone(value: string): boolean {
  if (!value.trim() || value !== value.trim()) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function taskCalendarDateInTimeZone(
  timeZone: string,
  instant: Date = new Date(),
): string {
  if (!isTaskPlanningTimeZone(timeZone) || Number.isNaN(instant.valueOf())) {
    throw new InvalidTaskCalendarRangeError('A valid planning time zone and instant are required');
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addTaskCalendarDays(value: string, days: number): string {
  const normalized = normalizeTaskCalendarDate(value, 'Calendar date');
  if (normalized === undefined || normalized === null || !Number.isSafeInteger(days)) {
    throw new InvalidTaskCalendarRangeError('A calendar date and whole-day offset are required');
  }
  const [year, month, day] = normalized.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [
    shifted.getUTCFullYear().toString().padStart(4, '0'),
    (shifted.getUTCMonth() + 1).toString().padStart(2, '0'),
    shifted.getUTCDate().toString().padStart(2, '0'),
  ].join('-');
}

export function formatTaskRelativeCalendarDate(
  value: string,
  planningDate: string,
  locale?: string,
): string {
  if (!isTaskCalendarDate(value) || !isTaskCalendarDate(planningDate)) return value;
  const offset = calendarEpochDay(value) - calendarEpochDay(planningDate);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  if (offset === -1) return 'one day ago';
  if (offset > 1 && offset <= 10) return `${offset} days left`;
  if (offset < -1 && offset >= -10) return `${Math.abs(offset)} days ago`;

  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function calendarEpochDay(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Math.trunc(Date.UTC(year, month - 1, day) / 86_400_000);
}
