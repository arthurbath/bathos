import { describe, expect, it } from 'vitest';

import {
  generateChecklistMoveOrderKey,
  generateChecklistOrderKey,
  planChecklistBatchInsertionOrderKeys,
  planChecklistGroupMove,
} from './taskChecklistOrder';

describe('generateChecklistOrderKey', () => {
  it('inserts between legacy fixed-width numeric ranks', () => {
    const key = generateChecklistOrderKey('000000001024', '000000002048');

    expect(key > '000000001024').toBe(true);
    expect(key < '000000002048').toBe(true);
  });

  it('continues inserting between a numeric rank and an earlier compatibility rank', () => {
    const later = generateChecklistOrderKey('000000001024', '000000002048');
    const earlier = generateChecklistOrderKey('000000001024', later);

    expect(earlier > '000000001024').toBe(true);
    expect(earlier < later).toBe(true);
  });

  it('moves an existing legacy-ranked item to the end', () => {
    const key = generateChecklistMoveOrderKey([
      { id: 'first', orderKey: '000000001024' },
      { id: 'second', orderKey: '000000002048' },
      { id: 'third', orderKey: '000000003072' },
    ], 'first', 2);

    expect(key > '000000003072').toBe(true);
  });
});

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

  it('plans multiple inserts inside a legacy numeric checklist', () => {
    const keys = planChecklistBatchInsertionOrderKeys([
      { id: 'before', orderKey: '000000001024' },
      { id: 'after', orderKey: '000000002048' },
    ], 1, 3);

    expect(keys).toHaveLength(3);
    expect(keys[0] > '000000001024').toBe(true);
    expect(keys[1] > keys[0]).toBe(true);
    expect(keys[2] > keys[1]).toBe(true);
    expect(keys[2] < '000000002048').toBe(true);
  });
});
