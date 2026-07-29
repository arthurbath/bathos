import { useEffect } from 'react';
import { shouldOpenInstalledHrefExternally } from '@/platform/installedApp';

function findAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
}

export function InstalledAppNavigationBoundary() {
  useEffect(() => {
    const handleInstalledLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.altKey
        || event.shiftKey
      ) return;

      const anchor = findAnchor(event.target);
      if (
        !anchor
        || anchor.hasAttribute('download')
        || (anchor.target && anchor.target.toLowerCase() !== '_self')
        || !shouldOpenInstalledHrefExternally(anchor.href)
      ) return;

      event.preventDefault();
      event.stopPropagation();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    };

    document.addEventListener('click', handleInstalledLink, true);
    return () => document.removeEventListener('click', handleInstalledLink, true);
  }, []);

  return null;
}
