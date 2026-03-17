/**
 * Auth context: user, token, login, logout
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  roleNames: string[];
  supplierId?: string;
  buyerId?: string;
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
    setState({ user, token, loading: false });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
  }, []);

  const logout = useCallback(() => {
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
