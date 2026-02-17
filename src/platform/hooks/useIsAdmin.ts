import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useIsAdmin(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setIsAdmin(false); setLoading(false); return; }

    const check = async () => {
      const { data } = await supabase
        .from('bathos_user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!data);
      setLoading(false);
    };

    check();
  }, [userId]);

  return { isAdmin, loading };
}
