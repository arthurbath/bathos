import { describe, expect, it } from 'vitest';

import {
  normalizeClipboardLineBreaks,
  planChecklistMultilinePaste,
  splitPlainTextTaskTitles,
} from './taskMultilinePaste';

describe('task multiline paste', () => {
  it('normalizes LF, CRLF, and bare CR line endings', () => {
    expect(normalizeClipboardLineBreaks('One\r\nTwo\rThree\nFour'))
      .toBe('One\nTwo\nThree\nFour');
  });

  it('returns trimmed nonempty task titles in source order', () => {
    expect(splitPlainTextTaskTitles(' First \r\n\r\nSecond\r  \nThird '))
      .toEqual(['First', 'Second', 'Third']);
  });

  it('plans checklist lines as a textarea-style selection replacement', () => {
    expect(planChecklistMultilinePaste(
      'Prefix selected suffix',
      7,
      15,
      'First\r\nMiddle\rLast',
    )).toEqual({
      titles: ['Prefix First', 'Middle', 'Last suffix'],
      finalCaretOffset: 4,
    });
  });

  it('leaves single-line checklist paste to the native input', () => {
    expect(planChecklistMultilinePaste('Existing', 8, 8, ' addition')).toBeNull();
  });
});
