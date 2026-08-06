import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const TOUCH_SCROLL_INTENT_THRESHOLD_PX = 8;

type TouchPointerOrigin = {
  pointerId: number;
  startX: number;
  startY: number;
};

export function useTouchScrollDismissMenu(
  onScrollIntent: () => void,
): (event: ReactPointerEvent<HTMLElement>) => void {
  const onScrollIntentRef = useRef(onScrollIntent);
  const cleanupGestureRef = useRef<() => void>(() => undefined);
  onScrollIntentRef.current = onScrollIntent;

  useEffect(() => () => cleanupGestureRef.current(), []);

  return useCallback((event: ReactPointerEvent<HTMLElement>) => {
    cleanupGestureRef.current();
    if (event.pointerType !== 'touch') return;
    const origin: TouchPointerOrigin = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    const cleanup = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', clearPointer);
      document.removeEventListener('pointercancel', clearPointer);
      cleanupGestureRef.current = () => undefined;
    };
    const clearPointer = (pointerEvent: PointerEvent) => {
      if (origin.pointerId === pointerEvent.pointerId) cleanup();
    };
    const handlePointerMove = (pointerEvent: PointerEvent) => {
      if (origin.pointerId !== pointerEvent.pointerId) return;
      const horizontalMovement = Math.abs(pointerEvent.clientX - origin.startX);
      const verticalMovement = Math.abs(pointerEvent.clientY - origin.startY);
      if (
        verticalMovement < TOUCH_SCROLL_INTENT_THRESHOLD_PX
        || verticalMovement <= horizontalMovement
      ) return;
      cleanup();
      onScrollIntentRef.current();
    };

    cleanupGestureRef.current = cleanup;
    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerup', clearPointer, { passive: true });
    document.addEventListener('pointercancel', clearPointer, { passive: true });
  }, []);
}
