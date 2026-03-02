import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  displayName: string;
  loading: boolean;
  isSigningOut: boolean;
  setDisplayName: (nextDisplayName: string) => void;
  signUp: (email: string, password: string, displayName: string, termsVersion?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayNameState] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const isSigningOutRef = useRef(false);
  const hasSeenAuthenticatedSessionRef = useRef(false);

  const readUserDisplayName = (nextUser: User | null) => {
    const raw = nextUser?.user_metadata?.display_name;
    return typeof raw === 'string' ? raw.trim() : '';
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const isSigningOut = isSigningOutRef.current;
        if (isSigningOut && event !== 'SIGNED_OUT') return;

        // During HMR and refresh churn, Supabase can emit TOKEN_REFRESHED with null
        // before auth state settles. Ignore this transient event to prevent route jumps.
        if (event === 'TOKEN_REFRESHED' && !session) return;

        if (event === 'SIGNED_OUT') {
          const hadAuthenticatedSession = hasSeenAuthenticatedSessionRef.current;
          hasSeenAuthenticatedSessionRef.current = false;

          setSession(null);
          setUser(null);
          setDisplayNameState('');
          setLoading(false);
          isSigningOutRef.current = false;
          setIsSigningOut(false);

          // Ignore startup SIGNED_OUT events when no authenticated session has been observed.
          if (isSigningOut || hadAuthenticatedSession) {
            window.location.href = '/';
          }
          return;
        }

        setSession(session);
        const nextUser = session?.user ?? null;
        if (nextUser) {
          hasSeenAuthenticatedSessionRef.current = true;
        }
        setDisplayNameState((current) => current || readUserDisplayName(nextUser));
        // Only update user state if the identity actually changed,
        // preventing a full re-render cascade on routine token refreshes.
        setUser(prev => {
          const next = nextUser;
          if (prev?.id === next?.id) return prev;
          return next;
        });
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isSigningOutRef.current) return;
      const nextUser = session?.user ?? null;
      setSession(session);
      setUser(nextUser);
      setDisplayNameState(readUserDisplayName(nextUser));
      hasSeenAuthenticatedSessionRef.current = !!nextUser;
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setDisplayNameState('');
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('bathos_profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled || error) return;
      setDisplayNameState(data?.display_name?.trim() || '');
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const signUp = async (email: string, password: string, displayName: string, termsVersion?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: displayName,
          ...(termsVersion ? { terms_version_accepted: termsVersion } : {}),
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    if (isSigningOutRef.current) return;

    isSigningOutRef.current = true;
    setIsSigningOut(true);

    // Immediately reflect signed-out state in UI while Supabase completes logout.
    setSession(null);
    setUser(null);
    setDisplayNameState('');
    setLoading(false);

    try {
      await supabase.auth.signOut();
    } finally {
      isSigningOutRef.current = false;
      setIsSigningOut(false);
      window.location.href = '/';
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const setDisplayName = (nextDisplayName: string) => {
    setDisplayNameState(nextDisplayName.trim());
  };

  return (
    <AuthContext.Provider value={{ user, session, displayName, loading, isSigningOut, setDisplayName, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
