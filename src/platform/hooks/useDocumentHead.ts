import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useHostModule } from '@/platform/hooks/useHostModule';
import { getModuleById } from '@/platform/modules';

const DEFAULT_TITLE = 'BathOS';
const DEFAULT_DESCRIPTION = 'A bunch of hyper-specific apps for Art and his friends';
const DEFAULT_ICON = '/favicon.png';
const DEFAULT_APPLE_ICON = '/apple-touch-icon.png';

function setLinkHref(rel: string, href: string) {
  const link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (link) {
    link.href = href;
  }
}

let currentManifestBlobUrl: string | null = null;

function setManifest(name: string, startUrl: string, iconPath: string) {
  const manifest = {
    name,
    short_name: name,
    description: DEFAULT_DESCRIPTION,
    start_url: startUrl,
    display: 'standalone' as const,
    background_color: '#fcfcfc',
    theme_color: '#1f1f1f',
    icons: [
      { src: iconPath, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: iconPath, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };

  if (currentManifestBlobUrl) {
    URL.revokeObjectURL(currentManifestBlobUrl);
  }

  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  currentManifestBlobUrl = URL.createObjectURL(blob);

  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (link) {
    link.href = currentManifestBlobUrl;
  }
}

export function useDocumentHead() {
  const moduleId = useHostModule();
  const location = useLocation();

  useEffect(() => {
    const firstSegment = location.pathname.split('/')[1];
    const effectiveId = firstSegment === 'admin' ? 'admin' : moduleId;
    const mod = effectiveId ? getModuleById(effectiveId as any) : undefined;

    if (mod) {
      document.title = mod.name;
      const icon = mod.iconPath ?? DEFAULT_ICON;
      setLinkHref('icon', icon);
      setLinkHref('apple-touch-icon', icon);
      // Point manifest start_url to the current path so "Add to Home Screen"
      // captures this exact URL with the module name and icon.
      setManifest(mod.name, location.pathname, icon);
    } else {
      document.title = DEFAULT_TITLE;
      setLinkHref('icon', DEFAULT_ICON);
      setLinkHref('apple-touch-icon', DEFAULT_APPLE_ICON);
      setManifest(DEFAULT_TITLE, '/', '/icon-192.png');
    }
  }, [moduleId, location.pathname]);
}
