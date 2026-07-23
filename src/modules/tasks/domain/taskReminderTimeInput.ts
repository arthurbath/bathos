type TaskReminderTimeCandidate = {
  localTime: string;
  displayTime: string;
};

export type ParsedTaskReminderTimeInput = {
  primary: TaskReminderTimeCandidate;
  alternate: TaskReminderTimeCandidate | null;
  interpretation: 'ambiguous' | 'meridiem' | 'twenty-four-hour';
};

export type ResolveTaskReminderTimeInputOptions = {
  today: boolean;
  timeZone: string;
  now?: Date;
};

export type ResolvedTaskReminderTimeInput = TaskReminderTimeCandidate & {
  interpretation: ParsedTaskReminderTimeInput['interpretation'];
};

const inputPattern = /^(\d{1,4})(?::(\d{1,2}))?([ap](?:m)?)?$/;

export function parseTaskReminderTimeInput(
  value: string,
): ParsedTaskReminderTimeInput | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  const match = inputPattern.exec(normalized);
  if (!match) return null;

  const [, digits, minuteDigits, suffix] = match;
  if (minuteDigits !== undefined && digits.length > 2) return null;

  const hasMeridiem = suffix !== undefined;
  const parsed = minuteDigits === undefined
    ? parseCompactTime(digits, hasMeridiem)
    : parseColonTime(digits, minuteDigits, hasMeridiem);
  if (!parsed) return null;

  const { hour, minute, ambiguous } = parsed;
  if (hasMeridiem) {
    const meridiem = suffix.startsWith('p') ? 'pm' : 'am';
    const hour24 = meridiem === 'pm'
      ? (hour % 12) + 12
      : hour % 12;
    return {
      primary: makeCandidate(hour24, minute),
      alternate: null,
      interpretation: 'meridiem',
    };
  }

  if (ambiguous) {
    return {
      primary: makeCandidate(hour % 12, minute),
      alternate: makeCandidate((hour % 12) + 12, minute),
      interpretation: 'ambiguous',
    };
  }

  return {
    primary: makeCandidate(hour, minute),
    alternate: null,
    interpretation: 'twenty-four-hour',
  };
}

export function resolveTaskReminderTimeInput(
  value: string,
  options: ResolveTaskReminderTimeInputOptions,
): ResolvedTaskReminderTimeInput | null {
  const parsed = parseTaskReminderTimeInput(value);
  if (!parsed) return null;

  if (!options.today) {
    return {
      ...parsed.primary,
      interpretation: parsed.interpretation,
    };
  }

  const currentSeconds = getTimeOfDaySeconds(options.now ?? new Date(), options.timeZone);
  if (currentSeconds === null) return null;

  const candidates = [parsed.primary, parsed.alternate].filter(
    (candidate): candidate is TaskReminderTimeCandidate => candidate !== null,
  );
  const futureCandidate = candidates.find(
    (candidate) => localTimeSeconds(candidate.localTime) > currentSeconds,
  );
  if (!futureCandidate) return null;

  return {
    ...futureCandidate,
    interpretation: parsed.interpretation,
  };
}

export function formatTaskReminderTimeDisplay(localTime: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d{1,9})?)?$/.exec(localTime);
  if (!match) return null;
  return makeCandidate(Number(match[1]), Number(match[2])).displayTime;
}

function parseColonTime(
  hourDigits: string,
  minuteDigits: string,
  hasMeridiem: boolean,
): { hour: number; minute: number; ambiguous: boolean } | null {
  const hour = Number(hourDigits);
  const minute = minuteDigits.length === 1
    ? Number(minuteDigits) * 10
    : Number(minuteDigits);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return null;
  if (hasMeridiem) {
    if (hour < 1 || hour > 12) return null;
    return { hour, minute, ambiguous: false };
  }
  if (hour < 0 || hour > 23) return null;
  return { hour, minute, ambiguous: hour >= 1 && hour <= 12 };
}

function parseCompactTime(
  digits: string,
  hasMeridiem: boolean,
): { hour: number; minute: number; ambiguous: boolean } | null {
  if (hasMeridiem) {
    if (digits.length > 4) return null;
    const hourDigits = digits.length <= 2 ? digits : digits.slice(0, -2);
    const minuteDigits = digits.length <= 2 ? '0' : digits.slice(-2);
    const hour = Number(hourDigits);
    const minute = Number(minuteDigits);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    return { hour, minute, ambiguous: false };
  }

  if (digits.length <= 2) {
    const hour = Number(digits);
    if (hour < 0 || hour > 23) return null;
    return { hour, minute: 0, ambiguous: hour >= 1 && hour <= 12 };
  }

  if (digits.length === 3) {
    const hour = Number(digits.slice(0, 1));
    const minute = Number(digits.slice(1));
    if (hour < 1 || minute > 59) return null;
    return { hour, minute, ambiguous: true };
  }

  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2));
  if (hour > 23 || minute > 59) return null;
  return { hour, minute, ambiguous: false };
}

function makeCandidate(hour: number, minute: number): TaskReminderTimeCandidate {
  const localTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const displayHour = hour % 12 || 12;
  return {
    localTime,
    displayTime: `${displayHour}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'pm' : 'am'}`,
  };
}

function localTimeSeconds(localTime: string): number {
  const [hours, minutes] = localTime.split(':').map(Number);
  return (hours * 60 * 60) + (minutes * 60);
}

function getTimeOfDaySeconds(now: Date, timeZone: string): number | null {
  if (Number.isNaN(now.valueOf()) || !timeZone.trim()) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(now);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type === 'hour' || part.type === 'minute' || part.type === 'second')
        .map((part) => [part.type, Number(part.value)]),
    );
    if (
      !Number.isInteger(values.hour)
      || !Number.isInteger(values.minute)
      || !Number.isInteger(values.second)
    ) {
      return null;
    }
    return (values.hour * 60 * 60) + (values.minute * 60) + values.second;
  } catch {
    return null;
  }
}
