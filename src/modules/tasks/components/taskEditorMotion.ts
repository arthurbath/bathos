import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

export const TASK_EDITOR_EXPANSION_DURATION_MS = 220;

export function getTaskEditorMotionClassName({
  expanded,
  interactive,
  topPadding = true,
}: {
  expanded: boolean;
  interactive: boolean;
  topPadding?: boolean;
}): string {
  return [
    'grid overflow-hidden transition-[grid-template-rows,opacity,padding-top] ease-out motion-reduce:transition-none',
    expanded
      ? `grid-rows-[1fr] opacity-100 ${topPadding ? 'pt-[6px]' : 'pt-0'}`
      : 'grid-rows-[0fr] pt-0 opacity-0',
    interactive ? '' : 'pointer-events-none',
  ].filter(Boolean).join(' ');
}

export function useTaskEditorMotion({
  disabled = false,
  immediate = false,
  open,
  regionRef,
  rowRef,
}: {
  disabled?: boolean;
  immediate?: boolean;
  open: boolean;
  regionRef: RefObject<HTMLElement | null>;
  rowRef: RefObject<HTMLElement | null>;
}): {
  collapseImmediately: () => void;
  expanded: boolean;
  mounted: boolean;
  restoreImmediately: () => void;
} {
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);
  const animationFrameRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const unmountTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const cancelScheduledMotion = () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      if (unmountTimerRef.current !== null) {
        window.clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
    };
    cancelScheduledMotion();

    if (disabled) {
      setExpanded(false);
      setMounted(false);
      return cancelScheduledMotion;
    }

    const reducedMotion = immediate
      || (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true);
    if (open) {
      setMounted(true);
      if (reducedMotion) {
        setExpanded(true);
        scrollFrameRef.current = window.requestAnimationFrame(() => {
          scrollFrameRef.current = null;
          alignOpenedTaskToVisibleContent(rowRef.current, 'auto');
        });
        return cancelScheduledMotion;
      }

      setExpanded(false);
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = window.requestAnimationFrame(() => {
          animationFrameRef.current = null;
          setExpanded(true);
          revealTimerRef.current = window.setTimeout(() => {
            revealTimerRef.current = null;
            scrollFrameRef.current = window.requestAnimationFrame(() => {
              scrollFrameRef.current = null;
              alignOpenedTaskToVisibleContent(rowRef.current, 'smooth');
            });
          }, TASK_EDITOR_EXPANSION_DURATION_MS);
        });
      });
      return cancelScheduledMotion;
    }

    setExpanded(false);
    if (reducedMotion) {
      setMounted(false);
      return cancelScheduledMotion;
    }
    unmountTimerRef.current = window.setTimeout(() => {
      unmountTimerRef.current = null;
      setMounted(false);
    }, TASK_EDITOR_EXPANSION_DURATION_MS);
    return cancelScheduledMotion;
  }, [disabled, immediate, open, rowRef]);

  useLayoutEffect(() => {
    const region = regionRef.current;
    if (region === null) return;
    if (open) region.removeAttribute('inert');
    else region.setAttribute('inert', '');
  }, [mounted, open, regionRef]);

  return {
    collapseImmediately: () => setExpanded(false),
    expanded,
    mounted,
    restoreImmediately: () => {
      setMounted(true);
      setExpanded(true);
    },
  };
}

export function alignOpenedTaskToVisibleContent(
  taskRow: HTMLElement | null,
  behavior: ScrollBehavior,
): void {
  const summaryRow = taskRow?.querySelector<HTMLElement>('[data-task-row-header]') ?? taskRow;
  if (summaryRow === null) return;
  const stickyBoundary = document.querySelector<HTMLElement>('[data-topline-header]')
    ?.getBoundingClientRect().bottom ?? 0;
  const targetTop = Math.max(0, stickyBoundary) + 44;
  const scrollDelta = summaryRow.getBoundingClientRect().top - targetTop;
  if (!Number.isFinite(scrollDelta) || Math.abs(scrollDelta) < 1) return;
  window.scrollBy({
    top: scrollDelta,
    left: 0,
    behavior,
  });
}
