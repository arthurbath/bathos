import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useHostModule } from '@/platform/hooks/useHostModule';
import { getModuleById, type PlatformModuleId } from '@/platform/modules';

const DEFAULT_TITLE = 'BathOS';
const DEFAULT_ICON = '/favicon.png';
const DEFAULT_APPLE_ICON = '/apple-touch-icon.png';

function setLinkHref(rel: string, href: string) {
  const link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (link) {
    link.href = href;
  }
}

function setAllAppleTouchIcons(href: string) {
  document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((link) => {
    link.href = href;
  });
}

let currentManifestBlobUrl: string | null = null;

function updateManifest(name: string, startUrl: string, iconPath: string) {
  const manifest = {
    name,
    short_name: name,
    description: 'A bunch of hyper-specific apps for Art and his friends',
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

  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  currentManifestBlobUrl = URL.createObjectURL(blob);

  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (link) {
    link.href = currentManifestBlobUrl;
  }
}

function setAppleWebAppTitle(title: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (meta) {
    meta.content = title;
  }
}

/**
 * Keeps document head metadata in sync during SPA navigation.
 * The initial page load is handled by a synchronous script in index.html
 * (critical for iOS "Add to Home Screen"), this hook handles subsequent
 * client-side route changes.
 */
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
      setAllAppleTouchIcons(icon);
      setAppleWebAppTitle(mod.name);
      updateManifest(mod.name, location.pathname, icon);
    } else {
      document.title = DEFAULT_TITLE;
      setLinkHref('icon', DEFAULT_ICON);
      setAllAppleTouchIcons(DEFAULT_APPLE_ICON);
      setAppleWebAppTitle(DEFAULT_TITLE);
      updateManifest(DEFAULT_TITLE, '/', '/icon-192.png');
    }
  }, [moduleId, location.pathname]);
}
