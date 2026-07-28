import { describe, expect, it } from 'vitest';

import { planChecklistGroupMove } from './taskChecklistOrder';

describe('planChecklistGroupMove', () => {
  it('conglomerates a noncontiguous selection at the requested boundary in visual order', () => {
    expect(planChecklistGroupMove(
      ['a', 'b', 'c', 'd', 'e'],
      ['d', 'b'],
      5,
    )).toEqual({
      movingIds: ['b', 'd'],
      remainingIds: ['a', 'c', 'e'],
      insertionIndex: 3,
      orderedIds: ['a', 'c', 'e', 'b', 'd'],
    });
  });

  it('translates a boundary containing selected rows into the remaining list', () => {
    expect(planChecklistGroupMove(
      ['a', 'b', 'c', 'd'],
      ['b', 'c'],
      2,
    ).orderedIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores unavailable and repeated moving identifiers', () => {
    expect(planChecklistGroupMove(
      ['a', 'b', 'c'],
      ['missing', 'c', 'c'],
      -4,
    )).toEqual({
      movingIds: ['c'],
      remainingIds: ['a', 'b'],
      insertionIndex: 0,
      orderedIds: ['c', 'a', 'b'],
    });
  });
});
