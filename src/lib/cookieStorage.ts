/**
 * Cookie-based storage adapter for Supabase auth.
 * Shares the session across all *.bath.garden subdomains
 * by setting cookies with domain=.bath.garden.
 *
 * Falls back to localStorage when not on a .bath.garden domain
 * (dev/preview environments).
 */

const COOKIE_DOMAIN = '.bath.garden';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function isProductionDomain(): boolean {
  const hostname = window.location.hostname;
  return hostname === 'bath.garden' || hostname.endsWith('.bath.garden');
}

function setCookie(name: string, value: string): void {
  const encoded = encodeURIComponent(name);
  const encodedValue = encodeURIComponent(value);
  document.cookie = `${encoded}=${encodedValue}; domain=${COOKIE_DOMAIN}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

function getCookie(name: string): string | null {
  const encoded = encodeURIComponent(name);
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === encoded) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function removeCookie(name: string): void {
  const encoded = encodeURIComponent(name);
  document.cookie = `${encoded}=; domain=${COOKIE_DOMAIN}; path=/; max-age=0; SameSite=Lax; Secure`;
}

/**
 * Returns a storage adapter compatible with Supabase's auth.storage option.
 * Uses cookies on production domains, localStorage elsewhere.
 */
export function createAuthStorage(): Storage {
  if (!isProductionDomain()) {
    return localStorage;
  }

  return {
    get length() {
      // Not used by Supabase auth, but required by Storage interface
      return document.cookie.split('; ').length;
    },
    key(_index: number): string | null {
      return null;
    },
    getItem(key: string): string | null {
      return getCookie(key);
    },
    setItem(key: string, value: string): void {
      setCookie(key, value);
    },
    removeItem(key: string): void {
      removeCookie(key);
    },
    clear(): void {
      // Only clear Supabase-related cookies
      const cookies = document.cookie.split('; ');
      for (const cookie of cookies) {
        const key = decodeURIComponent(cookie.split('=')[0]);
        if (key.startsWith('sb-')) {
          removeCookie(key);
        }
      }
    },
  };
}
