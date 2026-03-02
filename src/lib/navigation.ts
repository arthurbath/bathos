import type { MouseEvent } from 'react';
import type { NavigateFunction } from 'react-router-dom';

export function shouldHandleWithBrowser(event: MouseEvent<HTMLElement>): boolean {
  if (event.defaultPrevented) return true;
  if (event.button !== 0) return true;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return true;
  return false;
}

function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent;
  return /Safari\//.test(userAgent) && !/(Chrome|CriOS|EdgiOS|EdgA|FxiOS|OPR|OPT|Android)/.test(userAgent);
}

function shouldPreferBrowserNavigationForSafari(href: string): boolean {
  if (!isSafariBrowser()) return false;
  return href.startsWith('/');
}

export function handleClientSideLinkNavigation(
  event: MouseEvent<HTMLElement>,
  navigate: NavigateFunction,
  href: string,
) {
  if (shouldHandleWithBrowser(event)) return;
  if (shouldPreferBrowserNavigationForSafari(href)) return;
  event.preventDefault();
  navigate(href);
}
