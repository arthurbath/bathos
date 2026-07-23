import { describe, expect, it } from 'vitest';

import {
  formatTaskReminderTimeDisplay,
  parseTaskReminderTimeInput,
  resolveTaskReminderTimeInput,
} from './taskReminderTimeInput';

describe('task reminder time input', () => {
  it.each([
    ['1p', '13:00', '1:00 pm'],
    ['1pm', '13:00', '1:00 pm'],
    ['1 pm', '13:00', '1:00 pm'],
    ['1:3p', '13:30', '1:30 pm'],
    ['1:30p', '13:30', '1:30 pm'],
    ['1:30pm', '13:30', '1:30 pm'],
    ['1:30 pm', '13:30', '1:30 pm'],
    ['130p', '13:30', '1:30 pm'],
    ['930P', '21:30', '9:30 pm'],
    ['12a', '00:00', '12:00 am'],
    ['12 PM', '12:00', '12:00 pm'],
  ])('normalizes meridiem form %s', (input, localTime, displayTime) => {
    expect(parseTaskReminderTimeInput(input)).toMatchObject({
      primary: { localTime, displayTime },
      alternate: null,
      interpretation: 'meridiem',
    });
  });

  it.each([
    ['1', '01:00', '13:00'],
    ['09', '09:00', '21:00'],
    ['11', '11:00', '23:00'],
    ['12', '00:00', '12:00'],
    ['1:3', '01:30', '13:30'],
    ['130', '01:30', '13:30'],
    ['930', '09:30', '21:30'],
  ])('retains both interpretations for ambiguous form %s', (input, primary, alternate) => {
    expect(parseTaskReminderTimeInput(input)).toMatchObject({
      primary: { localTime: primary },
      alternate: { localTime: alternate },
      interpretation: 'ambiguous',
    });
  });

  it.each([
    ['0', '00:00'],
    ['00', '00:00'],
    ['13', '13:00'],
    ['23', '23:00'],
    ['0000', '00:00'],
    ['1300', '13:00'],
    ['2359', '23:59'],
    ['13:3', '13:30'],
    ['13:03', '13:03'],
  ])('normalizes twenty-four-hour form %s', (input, localTime) => {
    expect(parseTaskReminderTimeInput(input)).toMatchObject({
      primary: { localTime },
      alternate: null,
      interpretation: 'twenty-four-hour',
    });
  });

  it.each([
    '',
    ' ',
    '25',
    '2400',
    '24:00',
    '1:60',
    '1:300',
    '1300p',
    '0p',
    'asdf',
    '1ppm',
    '1.30p',
    '-1',
  ])('rejects unsupported form %j', (input) => {
    expect(parseTaskReminderTimeInput(input)).toBeNull();
  });

  it('uses the AM interpretation for future work', () => {
    expect(resolveTaskReminderTimeInput('11', {
      today: false,
      timeZone: 'America/Los_Angeles',
      now: new Date('2026-07-20T21:00:00Z'),
    })).toMatchObject({
      localTime: '11:00',
      displayTime: '11:00 am',
    });
  });

  it('uses the remaining PM interpretation for Today after AM has elapsed', () => {
    expect(resolveTaskReminderTimeInput('11', {
      today: true,
      timeZone: 'America/Los_Angeles',
      now: new Date('2026-07-20T21:00:00Z'),
    })).toMatchObject({
      localTime: '23:00',
      displayTime: '11:00 pm',
    });
  });

  it('rejects explicit and fully ambiguous elapsed Today times', () => {
    const options = {
      today: true,
      timeZone: 'America/Los_Angeles',
      now: new Date('2026-07-21T06:30:00Z'),
    };
    expect(resolveTaskReminderTimeInput('10pm', options)).toBeNull();
    expect(resolveTaskReminderTimeInput('10', options)).toBeNull();
    expect(resolveTaskReminderTimeInput('2230', options)).toBeNull();
  });

  it('treats the current owner-local minute as elapsed', () => {
    expect(resolveTaskReminderTimeInput('2p', {
      today: true,
      timeZone: 'America/Los_Angeles',
      now: new Date('2026-07-20T21:00:30Z'),
    })).toBeNull();
  });

  it('uses the planning time zone instead of the runtime time zone', () => {
    const now = new Date('2026-07-20T18:00:00Z');
    expect(resolveTaskReminderTimeInput('11', {
      today: true,
      timeZone: 'America/Los_Angeles',
      now,
    })?.localTime).toBe('23:00');
    expect(resolveTaskReminderTimeInput('11', {
      today: true,
      timeZone: 'Pacific/Honolulu',
      now,
    })?.localTime).toBe('11:00');
  });

  it('formats synchronized reminder values for the text field', () => {
    expect(formatTaskReminderTimeDisplay('00:00:00')).toBe('12:00 am');
    expect(formatTaskReminderTimeDisplay('09:30:00.123456789')).toBe('9:30 am');
    expect(formatTaskReminderTimeDisplay('13:30')).toBe('1:30 pm');
    expect(formatTaskReminderTimeDisplay('25:00')).toBeNull();
  });
});
