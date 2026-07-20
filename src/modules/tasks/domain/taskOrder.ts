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

  return generateTaskOrderKey(
    remaining[destinationIndex - 1]?.orderKey ?? null,
    remaining[destinationIndex]?.orderKey ?? null,
  );
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
