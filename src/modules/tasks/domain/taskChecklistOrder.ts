import {
  compareTaskOrder,
  generateTaskOrderKey,
  type OrderedTask,
} from './taskOrder';

export type ChecklistGroupMove = {
  movingIds: string[];
  remainingIds: string[];
  insertionIndex: number;
  orderedIds: string[];
};

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
    return generateTaskOrderKey(previousKey, nextKey);
  }

  let firstTiedIndex = destinationIndex - 1;
  while (firstTiedIndex > 0 && items[firstTiedIndex - 1].orderKey === nextKey) {
    firstTiedIndex -= 1;
  }
  return generateTaskOrderKey(
    items[firstTiedIndex - 1]?.orderKey ?? null,
    nextKey,
  );
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
