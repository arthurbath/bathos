import { describe, expect, it } from 'vitest';

import {
  planChecklistBatchInsertionOrderKeys,
  planChecklistGroupMove,
} from './taskChecklistOrder';

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

  it('plans distinct sequential order keys for a multiline insertion', () => {
    const keys = planChecklistBatchInsertionOrderKeys([
      { id: 'before', orderKey: 'a0' },
      { id: 'after', orderKey: 'a2' },
    ], 1, 3);

    expect(keys).toHaveLength(3);
    expect(keys[0] > 'a0').toBe(true);
    expect(keys[1] > keys[0]).toBe(true);
    expect(keys[2] > keys[1]).toBe(true);
    expect(keys[2] < 'a2').toBe(true);
  });

  it('plans a multiline insertion safely beside concurrently tied keys', () => {
    const keys = planChecklistBatchInsertionOrderKeys([
      { id: 'first-tied', orderKey: 'a1' },
      { id: 'second-tied', orderKey: 'a1' },
    ], 1, 2);

    expect(keys[0] < 'a1').toBe(true);
    expect(keys[1] > keys[0]).toBe(true);
    expect(keys[1] < 'a1').toBe(true);
  });
});
