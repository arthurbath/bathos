import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { shouldHandleWithBrowser } from '@/lib/navigation';
import { isInstalledApp } from '@/platform/installedApp';

interface MobileBottomNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface MobileBottomNavProps {
  items: readonly MobileBottomNavItem[];
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
  hrefForPath?: (path: string) => string;
  overflowItems?: readonly MobileBottomNavItem[];
  overflowLabel?: string;
  overflowIcon?: LucideIcon;
}

function isIosDevice(targetWindow: Window): boolean {
  const { maxTouchPoints, platform, userAgent } = targetWindow.navigator;
  return /iPhone|iPad|iPod/i.test(`${platform} ${userAgent}`)
    || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function MobileBottomNav({
  items,
  isActive,
  onNavigate,
  hrefForPath = (path) => path,
  overflowItems = [],
  overflowLabel = 'More',
  overflowIcon: OverflowIcon = MoreHorizontal,
}: MobileBottomNavProps) {
  const [mounted, setMounted] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
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

  const hasOverflow = overflowItems.length > 0;
  const overflowActive = overflowItems.some(({ path }) => isActive(path));
  const installedIos = isInstalledApp(window) && isIosDevice(window);
  const itemClassName = (active: boolean) => (
    `inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-foreground/[0.12] text-foreground' : 'text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground'}`
  );

  const nav = (
    <div
      data-mobile-bottom-nav-viewport
      data-installed-ios={installedIos ? 'true' : undefined}
      className={`pointer-events-none fixed left-0 z-40 md:hidden ${
        installedIos
          ? 'bottom-[calc(env(safe-area-inset-bottom)+0.25rem)]'
          : 'bottom-[calc(env(safe-area-inset-bottom)+0.5rem)]'
      }`}
      style={viewportStyle ? {
        left: `${viewportStyle.left}px`,
        width: `${viewportStyle.width}px`,
        transform: `scale(${1 / viewportStyle.zoom})`,
        transformOrigin: 'bottom left',
      } : { right: 0 }}
    >
      <nav
        aria-label="Mobile navigation"
        className="pointer-events-auto mx-auto grid w-[calc(100%-2rem)] max-w-[calc(64rem-2rem)] gap-1 rounded-full border border-secondary bg-secondary/90 p-1.5 backdrop-blur-sm supports-[backdrop-filter]:bg-secondary/85"
        style={{ gridTemplateColumns: `repeat(${items.length + (hasOverflow ? 1 : 0)}, minmax(0, 1fr))` }}
      >
        {items.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          const href = hrefForPath(path);

          return (
            <a
              key={path}
              href={href}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={(event) => {
                if (shouldHandleWithBrowser(event)) return;
                event.preventDefault();
                onNavigate(path);
              }}
              className={itemClassName(active)}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{label}</span>
            </a>
          );
        })}
        {hasOverflow ? (
          <DropdownMenu open={overflowOpen} onOpenChange={setOverflowOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={overflowLabel}
                aria-current={overflowActive ? 'page' : undefined}
                className={itemClassName(overflowActive)}
              >
                <OverflowIcon className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{overflowLabel}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="end"
              sideOffset={8}
              className="min-w-48"
            >
              {overflowItems.map(({ path, label, icon: Icon }) => {
                const active = isActive(path);
                const href = hrefForPath(path);
                return (
                  <DropdownMenuItem key={path} onSelect={() => setOverflowOpen(false)} asChild>
                    <a
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      onClick={(event) => {
                        setOverflowOpen(false);
                        if (shouldHandleWithBrowser(event)) return;
                        event.preventDefault();
                        onNavigate(path);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{label}</span>
                    </a>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </nav>
    </div>
  );

  return createPortal(nav, document.body);
}
