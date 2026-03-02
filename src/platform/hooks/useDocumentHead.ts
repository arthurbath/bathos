import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useHostModule } from '@/platform/hooks/useHostModule';
import { getModuleById, type PlatformModuleId } from '@/platform/modules';

const DEFAULT_TITLE = 'BathOS';
const DEFAULT_ICON = '/favicon.png';
const DEFAULT_APPLE_ICON = '/apple-touch-icon.png';

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const MANIFEST_FN_BASE = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/manifest`;

function setLinkHref(rel: string, href: string) {
  const link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (link) {
    link.href = href;
  }
}

function setManifestLink(href: string) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (link) {
    link.href = href;
  }
}

export function useDocumentHead() {
  const moduleId = useHostModule();
  const location = useLocation();

  useEffect(() => {
    const firstSegment = location.pathname.split('/')[1];
    const effectiveId = firstSegment === 'admin' ? 'admin' : moduleId;
    const mod = effectiveId ? getModuleById(effectiveId as PlatformModuleId) : undefined;

    if (mod) {
      document.title = mod.name;
      const icon = mod.iconPath ?? DEFAULT_ICON;
      setLinkHref('icon', icon);
      setLinkHref('apple-touch-icon', icon);
      setManifestLink(`${MANIFEST_FN_BASE}?module=${mod.id}&origin=${encodeURIComponent(window.location.origin)}`);
    } else {
      document.title = DEFAULT_TITLE;
      setLinkHref('icon', DEFAULT_ICON);
      setLinkHref('apple-touch-icon', DEFAULT_APPLE_ICON);
      setManifestLink(`${MANIFEST_FN_BASE}?origin=${encodeURIComponent(window.location.origin)}`);
    }
  }, [moduleId, location.pathname]);
}
