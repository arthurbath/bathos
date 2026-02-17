/**
 * Detects the active module based on the current hostname.
 * 
 * In production:
 *   - budget.bath.garden → 'budget'
 *   - bath.garden / www.bath.garden → null (platform root)
 * 
 * In development/preview (Lovable preview, localhost):
 *   Falls back to path-based detection:
 *   - /budget/* → 'budget'
 *   - everything else → null (platform root)
 */

const SUBDOMAIN_MODULE_MAP: Record<string, string> = {
  budget: 'budget',
};

const KNOWN_ROOTS = ['bath.garden', 'www.bath.garden'];

export type ModuleId = 'budget' | null;

export function useHostModule(): ModuleId {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  // Check subdomain-based routing (production)
  for (const [subdomain, moduleId] of Object.entries(SUBDOMAIN_MODULE_MAP)) {
    if (hostname === `${subdomain}.bath.garden`) {
      return moduleId as ModuleId;
    }
  }

  // If on a known root domain, this is the platform root
  if (KNOWN_ROOTS.includes(hostname)) {
    return null;
  }

  // Fallback: path-based routing for dev/preview environments
  const firstSegment = pathname.split('/')[1];
  if (firstSegment && SUBDOMAIN_MODULE_MAP[firstSegment]) {
    return SUBDOMAIN_MODULE_MAP[firstSegment] as ModuleId;
  }

  return null;
}

/**
 * Returns the base path prefix for the current module.
 * In subdomain mode, returns ''. In path-based fallback, returns '/budget'.
 */
export function useModuleBasePath(): string {
  const hostname = window.location.hostname;

  for (const subdomain of Object.keys(SUBDOMAIN_MODULE_MAP)) {
    if (hostname === `${subdomain}.bath.garden`) {
      return '';
    }
  }

  // Path-based fallback
  const pathname = window.location.pathname;
  const firstSegment = pathname.split('/')[1];
  if (firstSegment && SUBDOMAIN_MODULE_MAP[firstSegment]) {
    return `/${firstSegment}`;
  }

  return '';
}

/**
 * Returns the URL for a specific module.
 * In production, returns the subdomain URL.
 * In dev/preview, returns the path-based URL.
 */
export function getModuleUrl(moduleId: string): string {
  const hostname = window.location.hostname;

  if (KNOWN_ROOTS.includes(hostname) || hostname.endsWith('.bath.garden')) {
    return `https://${moduleId}.bath.garden`;
  }

  // Dev/preview: use path-based routing
  return `/${moduleId}`;
}
