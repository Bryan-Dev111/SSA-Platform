/**
 * Tracks application database connection state (Super user can disconnect/reconnect).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../api/client';
import { notifyDatabaseDisconnected } from '../api/databaseDisconnected';
import { useAuth } from './AuthContext';
import { isSuperUserEmail } from '../config/superUser';

type DatabaseConnectionContextValue = {
  connected: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isSuperUser: boolean;
};

const DatabaseConnectionContext = createContext<DatabaseConnectionContextValue | null>(null);

export function DatabaseConnectionProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const isSuperUser = isSuperUserEmail(user?.email);

  const refresh = useCallback(async () => {
    try {
      const data = await apiJson<{ connected: boolean }>('/super/database/status', {
        token: token ?? undefined,
      });
      setConnected(data.connected !== false);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const connect = useCallback(async () => {
    await apiJson<{ connected: boolean }>('/super/database/connect', {
      method: 'POST',
      token,
    });
    setConnected(true);
  }, [token]);

  const disconnect = useCallback(async () => {
    await apiJson<{ connected: boolean }>('/super/database/disconnect', {
      method: 'POST',
      token,
    });
    setConnected(false);
    notifyDatabaseDisconnected();
  }, [token]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const handler = () => setConnected(false);
    window.addEventListener('db:disconnected', handler);
    return () => window.removeEventListener('db:disconnected', handler);
  }, []);

  const value = useMemo(
    () => ({
      connected,
      loading,
      refresh,
      connect,
      disconnect,
      isSuperUser,
    }),
    [connected, loading, refresh, connect, disconnect, isSuperUser]
  );

  return (
    <DatabaseConnectionContext.Provider value={value}>{children}</DatabaseConnectionContext.Provider>
  );
}

export function useDatabaseConnection(): DatabaseConnectionContextValue {
  const ctx = useContext(DatabaseConnectionContext);
  if (!ctx) {
    throw new Error('useDatabaseConnection must be used within DatabaseConnectionProvider');
  }
  return ctx;
}
