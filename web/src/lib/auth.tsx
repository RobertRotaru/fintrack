import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@ft/core';
import { ApiError, api, getToken, setToken, setUnauthorizedHandler } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; country: string; baseCurrency: string }) => Promise<void>;
  logout: () => void;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!getToken());

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    // Only a 401 ends the session; network errors (API restarting, offline)
    // keep the token and retry instead of signing the user out.
    const check = () =>
      api<User>('/auth/me')
        .then((u) => {
          if (cancelled) return;
          setUser(u);
          setLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          if (e instanceof ApiError && e.status === 401) {
            logout();
            setLoading(false);
          } else timer = setTimeout(check, 2000);
        });
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [logout]);

  const login = async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/login', { body: { email, password } });
    setToken(res.token);
    setUser(res.user);
  };

  const register: AuthState['register'] = async (data) => {
    const res = await api<{ token: string; user: User }>('/auth/register', { body: data });
    setToken(res.token);
    setUser(res.user);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** The signed-in user; only call inside authenticated routes. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUser without a signed-in user');
  return user;
}
