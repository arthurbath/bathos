import { isMacLikePlatform } from "@/lib/platform";

export type TaskSelectionState = {
  active: boolean;
  anchorId: string | null;
  focusedId: string | null;
  selectedIds: Set<string>;
};

export type TaskSelectionGesture = {
  taskId: string;
  visibleTaskIds: readonly string[];
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  macLikePlatform: boolean;
  includeFocusedOnActivation?: boolean;
};

export function applyTaskSelectionGesture(
  current: TaskSelectionState,
  gesture: TaskSelectionGesture,
): TaskSelectionState | null {
  const platformModifier = gesture.macLikePlatform
    ? gesture.metaKey || gesture.ctrlKey
    : gesture.ctrlKey;
  if (!current.active && !platformModifier && !gesture.shiftKey) {
    return null;
  }

  const normalize = (
    selectedIds: Set<string>,
    anchorId: string | null,
  ): TaskSelectionState => {
    if (selectedIds.size === 0) {
      return {
        active: false,
        anchorId: null,
        focusedId: null,
        selectedIds,
      };
    }

    return {
      active: true,
      anchorId,
      focusedId: null,
      selectedIds,
    };
  };

  if (!current.active && gesture.includeFocusedOnActivation && current.focusedId) {
    const anchorId = current.anchorId ?? current.focusedId;
    if (gesture.shiftKey) {
      const anchorIndex = gesture.visibleTaskIds.indexOf(anchorId);
      const taskIndex = gesture.visibleTaskIds.indexOf(gesture.taskId);
      if (anchorIndex >= 0 && taskIndex >= 0) {
        const start = Math.min(anchorIndex, taskIndex);
        const end = Math.max(anchorIndex, taskIndex);
        return normalize(
          new Set(gesture.visibleTaskIds.slice(start, end + 1)),
          anchorId,
        );
      }
    }

    const selectedIds = new Set([current.focusedId]);
    selectedIds.add(gesture.taskId);
    return normalize(selectedIds, anchorId);
  }

  if (!current.active) {
    return normalize(new Set([gesture.taskId]), gesture.taskId);
  }

  const anchorId = current.anchorId ?? current.focusedId ?? gesture.taskId;
  if (gesture.shiftKey) {
    const anchorIndex = gesture.visibleTaskIds.indexOf(anchorId);
    const taskIndex = gesture.visibleTaskIds.indexOf(gesture.taskId);
    if (anchorIndex >= 0 && taskIndex >= 0) {
      const start = Math.min(anchorIndex, taskIndex);
      const end = Math.max(anchorIndex, taskIndex);
      return normalize(
        new Set(gesture.visibleTaskIds.slice(start, end + 1)),
        anchorId,
      );
    }
  }

  const selectedIds = current.active
    ? new Set(current.selectedIds)
    : new Set(current.focusedId ? [current.focusedId] : []);
  if (selectedIds.has(gesture.taskId)) {
    selectedIds.delete(gesture.taskId);
  } else {
    selectedIds.add(gesture.taskId);
  }
  return normalize(selectedIds, anchorId);
}

export function isMacControlTaskSelectionPointer(input: {
  macLikePlatform: boolean;
  ctrlKey: boolean;
  button: number;
}): boolean {
  return input.macLikePlatform && input.ctrlKey && input.button === 0;
}

export function isMacLikeTaskPlatform(platform: string): boolean {
  return isMacLikePlatform(platform);
}
