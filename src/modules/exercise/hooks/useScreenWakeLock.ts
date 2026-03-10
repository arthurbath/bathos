import { useCallback, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
}

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

export function useScreenWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const warnedRef = useRef(false);

  const warn = useCallback(() => {
    if (warnedRef.current) return;
    warnedRef.current = true;
    toast({
      title: 'Keep-Awake Unavailable',
      description: 'This browser may still dim or sleep during a run.',
      variant: 'destructive',
    });
  }, []);

  useEffect(() => {
    const navigatorWithWakeLock = window.navigator as WakeLockNavigator;
    if (!enabled) {
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
      return undefined;
    }

    let cancelled = false;

    const requestWakeLock = async () => {
      if (!navigatorWithWakeLock.wakeLock?.request) {
        warn();
        return;
      }

      try {
        if (wakeLockRef.current && !wakeLockRef.current.released) return;
        const sentinel = await navigatorWithWakeLock.wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
      } catch {
        warn();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [enabled, warn]);
}
