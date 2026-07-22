import { generateKeyBetween } from 'fractional-indexing';

export type OrderedTask = {
  id: string;
  orderKey: string;
};

export class InvalidTaskOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskOrderError';
  }
}

export function compareTaskOrder(left: OrderedTask, right: OrderedTask): number {
  const keyComparison = compareOrdinalText(left.orderKey, right.orderKey);
  return keyComparison === 0 ? compareOrdinalText(left.id, right.id) : keyComparison;
}

export function generateTaskOrderKey(
  previousKey: string | null,
  nextKey: string | null,
): string {
  if (previousKey !== null && nextKey !== null && previousKey >= nextKey) {
    throw new InvalidTaskOrderError('The previous order key must sort before the next order key');
  }

  try {
    return generateKeyBetween(previousKey, nextKey);
  } catch (error) {
    throw new InvalidTaskOrderError(
      error instanceof Error ? error.message : 'Unable to generate a task order key',
    );
  }
}

export function generateTaskMoveOrderKey(
  tasks: readonly OrderedTask[],
  movingTaskId: string,
  destinationIndex: number,
): string {
  const ordered = [...tasks].sort(compareTaskOrder);
  const movingIndex = ordered.findIndex((task) => task.id === movingTaskId);

  if (movingIndex === -1) {
    throw new InvalidTaskOrderError('The moving task is not present in the ordered collection');
  }

  const remaining = ordered.filter((task) => task.id !== movingTaskId);
  if (!Number.isInteger(destinationIndex) || destinationIndex < 0 || destinationIndex > remaining.length) {
    throw new InvalidTaskOrderError('The destination index is outside the ordered collection');
  }

  const previousKey = remaining[destinationIndex - 1]?.orderKey ?? null;
  const nextKey = remaining[destinationIndex]?.orderKey ?? null;
  if (previousKey === null || nextKey === null || previousKey !== nextKey) {
    return generateTaskOrderKey(previousKey, nextKey);
  }

  // Concurrent inserts may legitimately share a fractional key. A one-row
  // mutation cannot place another item inside that tied block because stable
  // identifiers provide the total-order tie-breaker, so cross the complete
  // block in the requested direction.
  if (destinationIndex < movingIndex) {
    let firstTiedIndex = destinationIndex - 1;
    while (firstTiedIndex > 0 && remaining[firstTiedIndex - 1].orderKey === nextKey) {
      firstTiedIndex -= 1;
    }
    return generateTaskOrderKey(
      remaining[firstTiedIndex - 1]?.orderKey ?? null,
      nextKey,
    );
  }

  let lastTiedIndex = destinationIndex;
  while (
    lastTiedIndex + 1 < remaining.length
    && remaining[lastTiedIndex + 1].orderKey === previousKey
  ) {
    lastTiedIndex += 1;
  }
  return generateTaskOrderKey(
    previousKey,
    remaining[lastTiedIndex + 1]?.orderKey ?? null,
  );
}

export function generateTaskDropOrderKey(
  tasks: readonly OrderedTask[],
  targetTaskId: string,
  placement: 'before' | 'after',
): string {
  const ordered = [...tasks].sort(compareTaskOrder);
  const targetIndex = ordered.findIndex((task) => task.id === targetTaskId);
  if (targetIndex === -1) {
    throw new InvalidTaskOrderError('The target task is not present in the ordered collection');
  }

  const targetKey = ordered[targetIndex].orderKey;
  if (placement === 'before') {
    let firstTiedIndex = targetIndex;
    while (firstTiedIndex > 0 && ordered[firstTiedIndex - 1].orderKey === targetKey) {
      firstTiedIndex -= 1;
    }
    return generateTaskOrderKey(ordered[firstTiedIndex - 1]?.orderKey ?? null, targetKey);
  }

  let lastTiedIndex = targetIndex;
  while (
    lastTiedIndex + 1 < ordered.length
    && ordered[lastTiedIndex + 1].orderKey === targetKey
  ) {
    lastTiedIndex += 1;
  }
  return generateTaskOrderKey(targetKey, ordered[lastTiedIndex + 1]?.orderKey ?? null);
}

function compareOrdinalText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
