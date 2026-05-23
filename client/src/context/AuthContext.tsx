/**
 * Auth context: user, token, login, logout
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { setRuntimePathRoles } from '../config/rolePageAccess';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  roleNames: string[];
  pathRoles?: Record<string, string[]>;
  supplierId?: string;
  buyerId?: string;
  /** Static Super account (not in database). */
  isSuper?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setAuth: (user: AuthUser, token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'sentinel_auth';

function loadStored(): { user: AuthUser; token: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { user: AuthUser; token: string };
    if (data?.user?.id && data?.token) return data;
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  const setAuth = useCallback((user: AuthUser, token: string) => {
    setRuntimePathRoles(user.pathRoles ?? null);
    setState({ user, token, loading: false });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
  }, []);

  const logout = useCallback(() => {
    setRuntimePathRoles(null);
    setState({ user: null, token: null, loading: false });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const base = import.meta.env.VITE_API_URL || '/api';
    const res = await fetch(`${base}/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Login failed');
    setAuth(data.user, data.token);
  }, [setAuth]);

  useEffect(() => {
    const stored = loadStored();
    if (stored) {
      setRuntimePathRoles(stored.user.pathRoles ?? null);
      setState((s) => ({ ...s, user: stored.user, token: stored.token, loading: false }));
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    setAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
