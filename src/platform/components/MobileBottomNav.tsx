import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

interface MobileBottomNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface MobileBottomNavProps {
  items: readonly MobileBottomNavItem[];
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
}

export function MobileBottomNav({ items, isActive, onNavigate }: MobileBottomNavProps) {
  const [mounted, setMounted] = useState(false);
  const [viewportStyle, setViewportStyle] = useState<{ left: number; width: number; zoom: number } | null>(null);
  const baseDprRef = useRef(1);

  useEffect(() => {
    baseDprRef.current = window.devicePixelRatio || 1;
    setMounted(true);
  }, []);

  useEffect(() => {
    const updateViewportStyle = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setViewportStyle(null);
        return;
      }

      const baseDpr = baseDprRef.current || 1;
      const dprZoom = (window.devicePixelRatio || 1) / baseDpr;
      const viewportZoom = vv.scale || 1;
      // Counter both page zoom (desktop DPR changes) and visual viewport scale.
      const zoom = Math.max(1, dprZoom, viewportZoom);
      const left = vv.offsetLeft;
      const width = vv.width * zoom;
      setViewportStyle({ left, width, zoom });
    };

    const vv = window.visualViewport;
    updateViewportStyle();
    vv?.addEventListener('resize', updateViewportStyle);
    vv?.addEventListener('scroll', updateViewportStyle);
    window.addEventListener('resize', updateViewportStyle);

    return () => {
      vv?.removeEventListener('resize', updateViewportStyle);
      vv?.removeEventListener('scroll', updateViewportStyle);
      window.removeEventListener('resize', updateViewportStyle);
    };
  }, []);

  if (!mounted) return null;

  const nav = (
    <div
      className="fixed bottom-0 left-0 z-40 border-t border-[hsl(var(--grid-sticky-line))] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/90 md:hidden"
      style={viewportStyle ? {
        left: `${viewportStyle.left}px`,
        width: `${viewportStyle.width}px`,
        transform: `scale(${1 / viewportStyle.zoom})`,
        transformOrigin: 'bottom left',
      } : { right: 0 }}
    >
      <nav
        aria-label="Mobile navigation"
        className="mx-auto grid max-w-5xl gap-1 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);

          return (
            <button
              key={path}
              type="button"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(path)}
              className={`inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-primary/20 hover:text-foreground'}`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  return createPortal(nav, document.body);
}
