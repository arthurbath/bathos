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
  const paintedElements = typeof document.elementsFromPoint === 'function'
    ? document.elementsFromPoint(point.clientX, point.clientY)
    : [];
  for (const hit of paintedElements) {
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

  if (scope !== 'tasks') return;
  const candidates = Array.from(registry, ([element, callback]) => ({
    element,
    callback,
    bounds: element.getBoundingClientRect(),
  })).filter(({ element, bounds }) => (
    element.isConnected && (bounds.width > 0 || bounds.height > 0)
  ));
  if (candidates.length === 0) return;

  const surface = candidates[0].element.closest<HTMLElement>(
    '[data-task-space-entry-surface]',
  );
  const surfaceBounds = surface?.getBoundingClientRect();
  if (
    surfaceBounds
    && (surfaceBounds.width > 0 || surfaceBounds.height > 0)
    && (
      point.clientX < surfaceBounds.left
      || point.clientX > surfaceBounds.right
      || point.clientY < surfaceBounds.top
      || point.clientY > surfaceBounds.bottom
    )
  ) return;

  const axisDistance = (value: number, start: number, end: number) => (
    value < start ? start - value : value > end ? value - end : 0
  );
  candidates.sort((left, right) => {
    const leftVertical = axisDistance(point.clientY, left.bounds.top, left.bounds.bottom);
    const rightVertical = axisDistance(point.clientY, right.bounds.top, right.bounds.bottom);
    if (leftVertical !== rightVertical) return leftVertical - rightVertical;
    const leftHorizontal = axisDistance(point.clientX, left.bounds.left, left.bounds.right);
    const rightHorizontal = axisDistance(point.clientX, right.bounds.left, right.bounds.right);
    if (leftHorizontal !== rightHorizontal) return leftHorizontal - rightHorizontal;
    return left.bounds.height - right.bounds.height;
  });
  candidates[0].callback(point);
}
