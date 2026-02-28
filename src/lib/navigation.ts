import type { MouseEvent } from 'react';
import type { NavigateFunction } from 'react-router-dom';

export function shouldHandleWithBrowser(event: MouseEvent<HTMLElement>): boolean {
  if (event.defaultPrevented) return true;
  if (event.button !== 0) return true;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return true;
  return false;
}

export function handleClientSideLinkNavigation(
  event: MouseEvent<HTMLElement>,
  navigate: NavigateFunction,
  href: string,
) {
  if (shouldHandleWithBrowser(event)) return;
  event.preventDefault();
  navigate(href);
}
