export function getNextTaskAreaId(
  orderedAreaIds: readonly string[],
  currentAreaIds: readonly (string | null)[],
): string | null | undefined {
  if (orderedAreaIds.length === 0 || currentAreaIds.length === 0) return undefined;

  const firstAreaId = currentAreaIds[0];
  if (!currentAreaIds.every((areaId) => areaId === firstAreaId)) return null;

  if (firstAreaId === null) return orderedAreaIds[0];

  const currentIndex = orderedAreaIds.indexOf(firstAreaId);
  if (currentIndex < 0 || currentIndex === orderedAreaIds.length - 1) return null;
  return orderedAreaIds[currentIndex + 1];
}
