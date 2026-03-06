import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export const PULL_TO_REFRESH_TRIGGER_DISTANCE = 120;
const PULL_RESISTANCE = 0.4;
const MAX_PULL = 200;

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

/**
 * Pull-to-refresh wrapper that only activates in standalone (PWA) mode.
 * Triggers a full page reload when the user pulls down from the top.
 */
export function PullToRefresh({
  children,
  disabled,
  onRefresh,
}: {
  children: ReactNode;
  disabled?: boolean;
  onRefresh?: () => void;
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  useEffect(() => {
    const standalone =
      (window.navigator as StandaloneNavigator).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);
  }, []);

  const isOverlayOpen = useCallback(() => {
    if (disabled) return true;
    return !!document.querySelector(
      '[role="dialog"], [data-radix-portal], [data-vaul-drawer]',
    );
  }, [disabled]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing || isOverlayOpen()) return;
      if (window.scrollY <= 0) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    },
    [refreshing, isOverlayOpen],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling.current || refreshing) return;
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > 0) {
        setPullDistance(Math.min(delta * PULL_RESISTANCE, MAX_PULL));
      } else {
        isPulling.current = false;
        setPullDistance(0);
      }
    },
    [refreshing],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= PULL_TO_REFRESH_TRIGGER_DISTANCE && !refreshing) {
      setRefreshing(true);
      onRefresh?.();
      if (!onRefresh) {
        window.location.reload();
      }
    } else {
      setPullDistance(0);
    }
  }, [onRefresh, pullDistance, refreshing]);

  if (!isStandalone) {
    return <>{children}</>;
  }

  const progress = Math.min(pullDistance / PULL_TO_REFRESH_TRIGGER_DISTANCE, 1);
  const showIndicator = pullDistance > 5 || refreshing;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          paddingTop: showIndicator || refreshing ? 'env(safe-area-inset-top, 0px)' : '0px',
          height: refreshing
            ? 'calc(40px + env(safe-area-inset-top, 0px))'
            : showIndicator
              ? `calc(${pullDistance}px + env(safe-area-inset-top, 0px))`
              : '0px',
          transition: isPulling.current || refreshing ? 'none' : 'height 0.15s ease-out',
        }}
      >
        <Loader2
          className="h-5 w-5 text-muted-foreground"
          style={{
            opacity: refreshing ? 1 : Math.min(progress, 1),
            animation: refreshing ? 'spin 0.6s linear infinite' : 'none',
            transform: refreshing ? undefined : `rotate(${pullDistance * 3}deg)`,
          }}
        />
      </div>
      {children}
    </div>
  );
}
