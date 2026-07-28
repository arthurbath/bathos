import { describe, expect, it } from 'vitest';

import { getNextTaskAreaId } from './taskAreaCycle';

describe('getNextTaskAreaId', () => {
  const orderedAreaIds = ['work', 'home'];

  it('cycles one task through No Area and configured Area order', () => {
    expect(getNextTaskAreaId(orderedAreaIds, [null])).toBe('work');
    expect(getNextTaskAreaId(orderedAreaIds, ['work'])).toBe('home');
    expect(getNextTaskAreaId(orderedAreaIds, ['home'])).toBeNull();
  });

  it('normalizes mixed bulk Areas before advancing them together', () => {
    expect(getNextTaskAreaId(orderedAreaIds, ['work', 'home'])).toBeNull();
    expect(getNextTaskAreaId(orderedAreaIds, [null, null])).toBe('work');
    expect(getNextTaskAreaId(orderedAreaIds, ['work', 'work'])).toBe('home');
  });

  it('normalizes stale Area values and performs no mutation without Areas', () => {
    expect(getNextTaskAreaId(orderedAreaIds, ['removed-area'])).toBeNull();
    expect(getNextTaskAreaId([], [null])).toBeUndefined();
    expect(getNextTaskAreaId(orderedAreaIds, [])).toBeUndefined();
  });
});
