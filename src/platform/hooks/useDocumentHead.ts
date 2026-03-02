import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useHostModule } from '@/platform/hooks/useHostModule';
import { getModuleById } from '@/platform/modules';

const DEFAULT_TITLE = 'BathOS';
const DEFAULT_ICON = '/favicon.png';
const DEFAULT_APPLE_ICON = '/apple-touch-icon.png';

function setLinkHref(rel: string, href: string) {
  const link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (link) {
    link.href = href;
  }
}

export function useDocumentHead() {
  const moduleId = useHostModule();
  const location = useLocation();

  useEffect(() => {
    // Admin path is a module in the registry but useHostModule doesn't return it;
    // detect it from the path directly.
    const firstSegment = location.pathname.split('/')[1];
    const effectiveId = firstSegment === 'admin' ? 'admin' : moduleId;
    const mod = effectiveId ? getModuleById(effectiveId as any) : undefined;

    if (mod) {
      document.title = mod.name;
      const icon = mod.iconPath ?? DEFAULT_ICON;
      setLinkHref('icon', icon);
      setLinkHref('apple-touch-icon', icon);
    } else {
      document.title = DEFAULT_TITLE;
      setLinkHref('icon', DEFAULT_ICON);
      setLinkHref('apple-touch-icon', DEFAULT_APPLE_ICON);
    }
  }, [moduleId, location.pathname]);
}
