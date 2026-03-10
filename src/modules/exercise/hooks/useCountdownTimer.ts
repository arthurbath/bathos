import { useCallback, useEffect, useRef, useState } from 'react';

export function useCountdownTimer(durationSeconds: number | null | undefined, onComplete: () => void) {
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, (durationSeconds ?? 0) * 1000));
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    setDeadlineAt(null);
    setRemainingMs(Math.max(0, (durationSeconds ?? 0) * 1000));
  }, [durationSeconds]);

  useEffect(() => {
    if (deadlineAt == null) return undefined;

    const tick = () => {
      const nextRemainingMs = Math.max(0, deadlineAt - Date.now());
      setRemainingMs(nextRemainingMs);

      if (nextRemainingMs === 0) {
        setDeadlineAt(null);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete();
        }
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 200);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [deadlineAt, onComplete]);

  const start = useCallback(() => {
    if (!durationSeconds || deadlineAt != null) return;
    const nextRemainingMs = remainingMs > 0 ? remainingMs : durationSeconds * 1000;
    completedRef.current = false;
    setRemainingMs(nextRemainingMs);
    setDeadlineAt(Date.now() + nextRemainingMs);
  }, [deadlineAt, durationSeconds, remainingMs]);

  const pause = useCallback(() => {
    if (deadlineAt == null) return;
    setRemainingMs(Math.max(0, deadlineAt - Date.now()));
    setDeadlineAt(null);
  }, [deadlineAt]);

  const reset = useCallback(() => {
    completedRef.current = false;
    setDeadlineAt(null);
    setRemainingMs(Math.max(0, (durationSeconds ?? 0) * 1000));
  }, [durationSeconds]);

  return {
    isRunning: deadlineAt != null,
    remainingMs,
    pause,
    reset,
    start,
  };
}
