import { describe, expect, it } from 'vitest';

import {
  compareTaskOrder,
  generateTaskDropOrderKey,
  generateTaskMoveOrderKey,
  generateTaskOrderKey,
  InvalidTaskOrderError,
} from './taskOrder';

describe('task ordering', () => {
  it('generates sortable keys at the beginning, middle, and end', () => {
    const first = generateTaskOrderKey(null, null);
    const before = generateTaskOrderKey(null, first);
    const after = generateTaskOrderKey(first, null);
    const middle = generateTaskOrderKey(first, after);

    expect(before < first).toBe(true);
    expect(first < middle).toBe(true);
    expect(middle < after).toBe(true);
  });

  it('generates a move key after removing the moving task from the sequence', () => {
    const tasks = [
      { id: 'task-a', orderKey: 'a0' },
      { id: 'task-b', orderKey: 'a1' },
      { id: 'task-c', orderKey: 'a2' },
    ];

    const movedKey = generateTaskMoveOrderKey(tasks, 'task-a', 1);

    expect(movedKey > 'a1').toBe(true);
    expect(movedKey < 'a2').toBe(true);
  });

  it('converges concurrent same-gap inserts through the identifier tie-breaker', () => {
    const firstClientKey = generateTaskOrderKey('a0', 'a1');
    const secondClientKey = generateTaskOrderKey('a0', 'a1');
    const firstReplica = [
      { id: 'task-z', orderKey: firstClientKey },
      { id: 'task-a', orderKey: secondClientKey },
    ].sort(compareTaskOrder);
    const secondReplica = [...firstReplica].reverse().sort(compareTaskOrder);

    expect(firstClientKey).toBe(secondClientKey);
    expect(firstReplica.map(({ id }) => id)).toEqual(['task-a', 'task-z']);
    expect(secondReplica).toEqual(firstReplica);
  });

  it('crosses a complete equal-key block in the requested direction', () => {
    const tasks = [
      { id: 'task-a', orderKey: 'a0' },
      { id: 'task-b', orderKey: 'a1' },
      { id: 'task-c', orderKey: 'a1' },
      { id: 'task-d', orderKey: 'a2' },
    ];

    const movedUp = generateTaskMoveOrderKey(tasks, 'task-d', 1);
    const movedDown = generateTaskMoveOrderKey(tasks, 'task-a', 1);

    expect(movedUp > 'a0').toBe(true);
    expect(movedUp < 'a1').toBe(true);
    expect(movedDown > 'a1').toBe(true);
    expect(movedDown < 'a2').toBe(true);
  });

  it('generates direct-drop keys before or after the complete target tie block', () => {
    const tasks = [
      { id: 'task-a', orderKey: 'a0' },
      { id: 'task-b', orderKey: 'a1' },
      { id: 'task-c', orderKey: 'a1' },
      { id: 'task-d', orderKey: 'a2' },
    ];

    const before = generateTaskDropOrderKey(tasks, 'task-c', 'before');
    const after = generateTaskDropOrderKey(tasks, 'task-b', 'after');

    expect(before > 'a0').toBe(true);
    expect(before < 'a1').toBe(true);
    expect(after > 'a1').toBe(true);
    expect(after < 'a2').toBe(true);
  });

  it('rejects invalid ranges and destinations', () => {
    expect(() => generateTaskOrderKey('a1', 'a0')).toThrow(InvalidTaskOrderError);
    expect(() =>
      generateTaskMoveOrderKey([{ id: 'task-a', orderKey: 'a0' }], 'missing', 0),
    ).toThrow(InvalidTaskOrderError);
    expect(() =>
      generateTaskMoveOrderKey([{ id: 'task-a', orderKey: 'a0' }], 'task-a', 2),
    ).toThrow(InvalidTaskOrderError);
  });
});
