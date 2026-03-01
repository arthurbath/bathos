import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches the current user's display_name from bathos_profiles.
 * Falls back to email, then 'You'.
 */
export function useProfileDisplayName(userId: string | undefined, email: string | undefined): string {
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfileName(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('bathos_profiles')
          .select('display_name')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled || error) return;
        setProfileName(data?.display_name?.trim() || null);
      } catch {
        // Fallback keeps email-based display name.
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return profileName ?? email ?? 'You';
}
