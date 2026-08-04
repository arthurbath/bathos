import {
  compareTaskOrder,
  generateTaskOrderKey,
  InvalidTaskOrderError,
  type OrderedTask,
} from './taskOrder';

export type ChecklistGroupMove = {
  movingIds: string[];
  remainingIds: string[];
  insertionIndex: number;
  orderedIds: string[];
};

/**
 * Checklist rows created by earlier Tasks versions use fixed-width numeric
 * ranks (for example, `000000001024`). Recurrence snapshots can legitimately
 * keep producing those ranks, so checklist ordering must remain compatible
 * with them even though the shared fractional-indexing package rejects them.
 *
 * Prefer the shared generator for native fractional ranks. When either
 * boundary is a legacy rank, fall back to a printable ordinal key that sorts
 * strictly between the two raw database values.
 */
export function generateChecklistOrderKey(
  previousKey: string | null,
  nextKey: string | null,
): string {
  if (previousKey !== null && nextKey !== null && previousKey >= nextKey) {
    throw new InvalidTaskOrderError(
      'The previous checklist order key must sort before the next order key',
    );
  }

  try {
    return generateTaskOrderKey(previousKey, nextKey);
  } catch (error) {
    if (!(error instanceof InvalidTaskOrderError)) throw error;
    return generateLegacyChecklistOrderKey(previousKey, nextKey);
  }
}

export function generateChecklistMoveOrderKey(
  items: readonly OrderedTask[],
  movingItemId: string,
  destinationIndex: number,
): string {
  const ordered = [...items].sort(compareTaskOrder);
  const movingIndex = ordered.findIndex(({ id }) => id === movingItemId);
  if (movingIndex === -1) {
    throw new InvalidTaskOrderError(
      'The moving checklist item is not present in the ordered collection',
    );
  }

  const remaining = ordered.filter(({ id }) => id !== movingItemId);
  if (
    !Number.isInteger(destinationIndex)
    || destinationIndex < 0
    || destinationIndex > remaining.length
  ) {
    throw new InvalidTaskOrderError(
      'The checklist destination index is outside the ordered collection',
    );
  }

  return checklistInsertionOrderKey(remaining, destinationIndex);
}

export function planChecklistBatchInsertionOrderKeys(
  items: readonly OrderedTask[],
  destinationIndex: number,
  count: number,
): string[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('The checklist insertion count must be a nonnegative integer');
  }
  const workingItems = [...items].sort(compareTaskOrder);
  let insertionIndex = Math.max(0, Math.min(destinationIndex, workingItems.length));
  const orderKeys: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const orderKey = checklistInsertionOrderKey(workingItems, insertionIndex);
    const syntheticId = `multiline-paste-${index}`;
    orderKeys.push(orderKey);
    workingItems.push({ id: syntheticId, orderKey });
    workingItems.sort(compareTaskOrder);
    insertionIndex = workingItems.findIndex(({ id }) => id === syntheticId) + 1;
  }

  return orderKeys;
}

function checklistInsertionOrderKey(
  items: readonly OrderedTask[],
  destinationIndex: number,
): string {
  const previousKey = items[destinationIndex - 1]?.orderKey ?? null;
  const nextKey = items[destinationIndex]?.orderKey ?? null;
  if (previousKey === null || nextKey === null || previousKey !== nextKey) {
    return generateChecklistOrderKey(previousKey, nextKey);
  }

  let firstTiedIndex = destinationIndex - 1;
  while (firstTiedIndex > 0 && items[firstTiedIndex - 1].orderKey === nextKey) {
    firstTiedIndex -= 1;
  }
  return generateChecklistOrderKey(
    items[firstTiedIndex - 1]?.orderKey ?? null,
    nextKey,
  );
}

function generateLegacyChecklistOrderKey(
  previousKey: string | null,
  nextKey: string | null,
): string {
  if (previousKey === null && nextKey === null) return 'a0';
  if (nextKey === null) return `${previousKey ?? ''}V`;
  if (previousKey === null) return printablePrefixBefore(nextKey);

  if (!nextKey.startsWith(previousKey)) {
    return `${previousKey}V`;
  }

  const nextCharacter = nextKey.charCodeAt(previousKey.length);
  if (!Number.isFinite(nextCharacter) || nextCharacter <= 32) {
    throw new InvalidTaskOrderError(
      'Unable to generate a checklist order key between adjacent legacy ranks',
    );
  }
  return `${previousKey}${String.fromCharCode(Math.floor((32 + nextCharacter) / 2))}`;
}

function printablePrefixBefore(nextKey: string): string {
  const firstCharacter = nextKey.charCodeAt(0);
  if (!Number.isFinite(firstCharacter) || firstCharacter <= 32) {
    throw new InvalidTaskOrderError(
      'Unable to generate a checklist order key before the first legacy rank',
    );
  }
  return String.fromCharCode(Math.floor((32 + firstCharacter) / 2));
}

export function planChecklistGroupMove(
  visibleIds: readonly string[],
  requestedMovingIds: readonly string[],
  destinationIndex: number,
): ChecklistGroupMove {
  const requested = new Set(requestedMovingIds);
  const movingIds = visibleIds.filter((id) => requested.has(id));
  const movingSet = new Set(movingIds);
  const boundedDestination = Math.max(0, Math.min(destinationIndex, visibleIds.length));
  const insertionIndex = visibleIds
    .slice(0, boundedDestination)
    .filter((id) => !movingSet.has(id))
    .length;
  const remainingIds = visibleIds.filter((id) => !movingSet.has(id));
  return {
    movingIds,
    remainingIds,
    insertionIndex,
    orderedIds: [
      ...remainingIds.slice(0, insertionIndex),
      ...movingIds,
      ...remainingIds.slice(insertionIndex),
    ],
  };
}
