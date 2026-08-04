import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseAuthLock } from './authLock';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const companionAuthLock = resolveSupabaseAuthLock();

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database, 'public'>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: {
    retry: true,
  },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    ...(companionAuthLock ? { lock: companionAuthLock } : {}),
  },
});
