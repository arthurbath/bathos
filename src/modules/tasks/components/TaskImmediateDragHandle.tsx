import {
  useCallback,
  useEffect,
  useRef,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  dispatchToTaskImmediateDragTarget,
  type TaskImmediateDragPoint,
} from '@/modules/tasks/components/TaskImmediateDragTarget';
import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import { cn } from '@/lib/utils';

function createDragPreview(source: HTMLElement, point: TaskImmediateDragPoint): HTMLElement {
  const bounds = source.getBoundingClientRect();
  const preview = source.cloneNode(true) as HTMLElement;
  preview.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  preview.querySelectorAll('[data-task-drop-indicator], [data-checklist-drop-indicator]')
    .forEach((element) => element.remove());
  preview.setAttribute('aria-hidden', 'true');
  preview.style.position = 'fixed';
  preview.style.left = `${bounds.left}px`;
  preview.style.top = `${point.clientY - Math.min(bounds.height / 2, 24)}px`;
  preview.style.width = `${bounds.width}px`;
  preview.style.height = `${bounds.height}px`;
  preview.style.margin = '0';
  preview.style.pointerEvents = 'none';
  preview.style.opacity = '0.88';
  preview.style.zIndex = '1000';
  preview.style.transition = 'none';
  preview.style.overflow = 'hidden';
  document.body.append(preview);
  return preview;
}

export function TaskImmediateDragHandle({
  label,
  scope,
  previewRef,
  onStart,
  onDrop,
  onCancel,
  nativeDraggable = false,
  onNativeDragStart,
  onNativeDragEnd,
  className,
}: {
  label: string;
  scope: string;
  previewRef: RefObject<HTMLElement | null>;
  onStart: () => void;
  onDrop: () => void;
  onCancel: () => void;
  nativeDraggable?: boolean;
  onNativeDragStart?: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onNativeDragEnd?: (event: ReactDragEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  const gestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    latestX: number;
    latestY: number;
    moved: boolean;
    preview: HTMLElement | null;
    frame: number | null;
  } | null>(null);

  const stopAutoScroll = useCallback(() => {
    const gesture = gestureRef.current;
    if (gesture?.frame !== null && gesture?.frame !== undefined) {
      cancelAnimationFrame(gesture.frame);
      gesture.frame = null;
    }
  }, []);

  const clearGesture = useCallback(() => {
    stopAutoScroll();
    gestureRef.current?.preview?.remove();
    gestureRef.current = null;
  }, [stopAutoScroll]);

  const updateGesture = useCallback((point: TaskImmediateDragPoint) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gesture.latestX = point.clientX;
    gesture.latestY = point.clientY;
    if (!gesture.moved && Math.hypot(
      point.clientX - gesture.startX,
      point.clientY - gesture.startY,
    ) >= 3) {
      gesture.moved = true;
      if (previewRef.current) {
        gesture.preview = createDragPreview(previewRef.current, point);
      }
    }
    if (!gesture.moved) return;
    if (gesture.preview) {
      const bounds = gesture.preview.getBoundingClientRect();
      gesture.preview.style.top = `${point.clientY - Math.min(bounds.height / 2, 24)}px`;
    }
    dispatchToTaskImmediateDragTarget(scope, point);
  }, [previewRef, scope]);

  useEffect(() => clearGesture, [clearGesture]);

  const beginAutoScroll = useCallback(() => {
    const tick = () => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      const edge = 72;
      const topVelocity = gesture.latestY < edge
        ? -Math.ceil((edge - gesture.latestY) / 8)
        : 0;
      const bottomVelocity = gesture.latestY > window.innerHeight - edge
        ? Math.ceil((gesture.latestY - (window.innerHeight - edge)) / 8)
        : 0;
      const velocity = topVelocity || bottomVelocity;
      if (gesture.moved && velocity !== 0) {
        window.scrollBy({ top: velocity, behavior: 'auto' });
        dispatchToTaskImmediateDragTarget(scope, {
          clientX: gesture.latestX,
          clientY: gesture.latestY,
        });
      }
      gesture.frame = requestAnimationFrame(tick);
    };
    const gesture = gestureRef.current;
    if (gesture && gesture.frame === null) gesture.frame = requestAnimationFrame(tick);
  }, [scope]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (nativeDraggable && event.pointerType === 'mouse') return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      latestX: event.clientX,
      latestY: event.clientY,
      moved: false,
      preview: null,
      frame: null,
    };
    onStart();
    beginAutoScroll();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    updateGesture(event);
  };

  const finishGesture = (event: ReactPointerEvent<HTMLButtonElement>, canceled: boolean) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const shouldDrop = gesture.moved && !canceled;
    clearGesture();
    if (shouldDrop) onDrop();
    else onCancel();
  };

  return (
    <Button
      type="button"
      variant="clear"
      size="icon"
      aria-label={label}
      data-task-drag-handle-control
      draggable={nativeDraggable}
      className={cn(
        'h-8 w-8 shrink-0 cursor-grab touch-none select-none text-muted-foreground active:cursor-grabbing',
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishGesture(event, false)}
      onPointerCancel={(event) => finishGesture(event, true)}
      onLostPointerCapture={(event) => {
        if (gestureRef.current?.pointerId === event.pointerId) finishGesture(event, true);
      }}
      onDragStart={onNativeDragStart}
      onDragEnd={onNativeDragEnd}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <TASK_ICONS.DragHandle className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
