/**
 * Auth store — lightweight, no Zustand dependency (matches the rest of
 * the codebase). Persists token to localStorage; subscribes can re-render
 * on login/logout.
 */
import { useEffect, useState } from 'react';
import { getAccessToken, setAccessToken } from '../api/client';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l();
}

export function getCurrentToken(): string | null {
  return getAccessToken();
}

export function loginToken(token: string): void {
  setAccessToken(token);
  notify();
}

export function logoutToken(): void {
  setAccessToken(null);
  notify();
}

/** React hook — returns the current token; re-renders on change. */
export function useAuth(): {
  token: string | null;
  isAuthenticated: boolean;
  logout: () => void;
} {
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  useEffect(() => {
    const l = () => setToken(getAccessToken());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return {
    token,
    isAuthenticated: Boolean(token),
    logout: logoutToken,
  };
}
