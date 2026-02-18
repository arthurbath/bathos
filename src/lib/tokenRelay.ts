/**
 * Token relay for cross-subdomain auth.
 *
 * When navigating from one subdomain to another (e.g., bath.garden → budget.bath.garden),
 * the current session tokens are passed via a URL hash fragment. The receiving page
 * picks them up, sets the Supabase session, and cleans the URL.
 *
 * Hash fragment is used (not query params) so tokens are never sent to the server.
 */

import { supabase } from '@/integrations/supabase/client';

const TOKEN_HASH_PREFIX = 'token_relay=';

/**
 * Build a URL with the current session tokens relayed via hash fragment.
 * Returns the plain URL if no session is active.
 */
export async function buildRelayUrl(targetUrl: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return targetUrl;

  const payload = btoa(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  }));

  // Append to hash
  const url = new URL(targetUrl, window.location.origin);
  url.hash = TOKEN_HASH_PREFIX + payload;
  return url.toString();
}

/**
 * Check the current URL for a relayed token and, if found,
 * set the Supabase session and clean the hash.
 * Should be called once on app startup.
 */
export async function consumeRelayToken(): Promise<boolean> {
  const hash = window.location.hash;
  if (!hash.startsWith('#' + TOKEN_HASH_PREFIX)) return false;

  try {
    const payload = hash.slice(1 + TOKEN_HASH_PREFIX.length);
    const { access_token, refresh_token } = JSON.parse(atob(payload));

    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });

      // Clean the hash without triggering a navigation
      history.replaceState(null, '', window.location.pathname + window.location.search);
      return true;
    }
  } catch {
    // Malformed relay token — ignore
  }

  // Clean invalid hash
  history.replaceState(null, '', window.location.pathname + window.location.search);
  return false;
}
