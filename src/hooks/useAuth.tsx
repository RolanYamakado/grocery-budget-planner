import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { clearSync, initSyncForUser } from '../lib/storage';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authError: string | null;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  // Tracks which user id we've already hydrated sync for. Supabase re-fires
  // onAuthStateChange (e.g. a token refresh when the tab regains focus after
  // being backgrounded) with the *same* signed-in user — without this guard,
  // that re-fire would flip `loading` back to true, which unmounts the whole
  // authenticated subtree (including PlanProvider) below and wipes any
  // in-progress wizard state. A ref (not state) survives across the effect's
  // single run without retriggering it.
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      if (sessionUser) {
        await initSyncForUser(sessionUser.id);
        syncedUserIdRef.current = sessionUser.id;
      }
      if (!cancelled) {
        setUser(sessionUser);
        setLoading(false);
      }
    }
    bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      const nextUser = session?.user ?? null;
      if (nextUser) {
        if (syncedUserIdRef.current === nextUser.id) {
          setUser(nextUser);
          return;
        }
        setLoading(true);
        await initSyncForUser(nextUser.id);
        if (cancelled) return;
        syncedUserIdRef.current = nextUser.id;
        setUser(nextUser);
        setLoading(false);
      } else {
        syncedUserIdRef.current = null;
        clearSync();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    // If email confirmation is required, Supabase returns no session yet.
    return { needsEmailConfirmation: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user, loading, authError, signUp, signIn, signOut }),
    [user, loading, authError, signUp, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
