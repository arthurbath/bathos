import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://rsqfokyqntmtdejfwmjs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcWZva3lxbnRtdGRlamZ3bWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwODI3NDgsImV4cCI6MjA4NjY1ODc0OH0.ZkKDk1yZ24Bu8m5b6uHYJr0MBykMi7h4LivY_KHhn6A";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});