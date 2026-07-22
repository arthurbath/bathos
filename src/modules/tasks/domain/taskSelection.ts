export type TaskSelectionState = {
  active: boolean;
  anchorId: string | null;
  selectedIds: Set<string>;
};

export type TaskSelectionGesture = {
  taskId: string;
  visibleTaskIds: readonly string[];
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  macLikePlatform: boolean;
};

export function applyTaskSelectionGesture(
  current: TaskSelectionState,
  gesture: TaskSelectionGesture,
): TaskSelectionState | null {
  const platformModifier = gesture.macLikePlatform ? gesture.metaKey : gesture.ctrlKey;
  if (!current.active && !platformModifier && !gesture.shiftKey) {
    return null;
  }

  const anchorId = current.anchorId ?? gesture.taskId;
  if (gesture.shiftKey) {
    const anchorIndex = gesture.visibleTaskIds.indexOf(anchorId);
    const taskIndex = gesture.visibleTaskIds.indexOf(gesture.taskId);
    if (anchorIndex >= 0 && taskIndex >= 0) {
      const start = Math.min(anchorIndex, taskIndex);
      const end = Math.max(anchorIndex, taskIndex);
      return {
        active: true,
        anchorId,
        selectedIds: new Set(gesture.visibleTaskIds.slice(start, end + 1)),
      };
    }
  }

  const selectedIds = new Set(current.selectedIds);
  if (selectedIds.has(gesture.taskId)) {
    selectedIds.delete(gesture.taskId);
  } else {
    selectedIds.add(gesture.taskId);
  }
  return { active: true, anchorId, selectedIds };
}

export function isMacLikeTaskPlatform(platform: string): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}
