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
