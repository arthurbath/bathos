import { useLayoutEffect, type RefObject } from 'react';

export type TaskImmediateDragPoint = { clientX: number; clientY: number };
type DragTargetCallback = (point: TaskImmediateDragPoint) => void;

const targetRegistries = new Map<string, Map<HTMLElement, DragTargetCallback>>();

function registryFor(scope: string): Map<HTMLElement, DragTargetCallback> {
  const existing = targetRegistries.get(scope);
  if (existing) return existing;
  const created = new Map<HTMLElement, DragTargetCallback>();
  targetRegistries.set(scope, created);
  return created;
}

export function useTaskImmediateDragTarget(
  scope: string | null,
  elementRef: RefObject<HTMLElement | null>,
  onTarget: DragTargetCallback | null,
): void {
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (scope === null || element === null || onTarget === null) return undefined;
    const registry = registryFor(scope);
    registry.set(element, onTarget);
    return () => {
      registry.delete(element);
      if (registry.size === 0) targetRegistries.delete(scope);
    };
  }, [elementRef, onTarget, scope]);
}

export function dispatchToTaskImmediateDragTarget(
  scope: string,
  point: TaskImmediateDragPoint,
): void {
  const registry = targetRegistries.get(scope);
  if (!registry) return;
  for (const hit of document.elementsFromPoint(point.clientX, point.clientY)) {
    let current: Element | null = hit;
    while (current) {
      if (current instanceof HTMLElement) {
        const callback = registry.get(current);
        if (callback) {
          callback(point);
          return;
        }
      }
      current = current.parentElement;
    }
  }
}
