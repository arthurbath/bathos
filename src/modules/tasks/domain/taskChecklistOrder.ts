export type ChecklistGroupMove = {
  movingIds: string[];
  remainingIds: string[];
  insertionIndex: number;
  orderedIds: string[];
};

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
