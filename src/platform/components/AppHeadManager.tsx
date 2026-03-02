import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveBrandingForPath } from '@/platform/metadata/appMetadata';

function upsertMetaByName(name: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertMetaByProperty(property: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertLink(rel: string, href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

export default function AppHeadManager() {
  const location = useLocation();

  useEffect(() => {
    const branding = resolveBrandingForPath(location.pathname);

    document.title = branding.title;
    upsertMetaByName('apple-mobile-web-app-title', branding.appName);
    upsertMetaByName('application-name', branding.appName);
    upsertMetaByProperty('og:title', branding.title);
    upsertLink('icon', branding.iconHref);
    upsertLink('apple-touch-icon', branding.appleTouchIconHref);
    upsertLink('manifest', branding.manifestHref);
  }, [location.pathname]);

  return null;
}
