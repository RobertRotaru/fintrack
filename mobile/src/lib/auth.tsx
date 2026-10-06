import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@ft/core';
import { ApiError, api, loadToken, setToken, setUnauthorizedHandler } from './api';

type Session = { token: string; user: User };

interface AuthValue {
  user: User | null;
  /** Still reading the saved session. */
  loading: boolean;
  /** The saved session couldn't be checked because the server is unreachable. */
  offline: boolean;
  retry: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  register: (body: { name: string; email: string; password: string; country: string }) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const signOut = useCallback(async () => {
    await setToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => setUnauthorizedHandler(() => void signOut()), [signOut]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadToken();
      if (!saved) return setLoading(false);
      try {
        const me = await api<User>('/auth/me');
        if (!cancelled) {
          setUser(me);
          setOffline(false);
        }
      } catch (e) {
        // A dead session signs out (the 401 handler); an unreachable server keeps it for a retry.
        if (!cancelled && e instanceof ApiError && e.status === 0) setOffline(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const start = useCallback(async (s: Session) => {
    await setToken(s.token);
    setUser(s.user);
    setOffline(false);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      offline,
      retry: () => {
        setLoading(true);
        setAttempt((n) => n + 1);
      },
      signIn: async (email, password) => start(await api<Session>('/auth/login', { body: { email, password } })),
      register: async (body) => start(await api<Session>('/auth/register', { body })),
      signOut,
      setUser,
    }),
    [user, loading, offline, start, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** The signed-in person; only used inside the signed-in part of the app. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUser without a session');
  return user;
}
