import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

export type SystemState = {
  ready: boolean;
  session: Session | null;
  error: string | null;
};

export const SystemContext = createContext<SystemState>({ ready: false, session: null, error: null });

export const useSystem = () => useContext(SystemContext);
