import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

const TOKEN_KEY = 'driveaway_token';
const USER_KEY = 'driveaway_user';
// When /auth/me cannot reach the server (cold start, network drop), try again after these waits
const RETRY_DELAYS = [5000, 10000, 20000, 30000, 60000];

// Only what the navbar and route guards need stays on the device: never licence, ID, address, DOB or phone
const minimalUser = (u) => (u && u._id ? { _id: u._id, name: u.name || '', email: u.email || '', role: u.role || 'user' } : null);

const storeUser = (u) => {
  const m = minimalUser(u);
  if (m) localStorage.setItem(USER_KEY, JSON.stringify(m));
};

const clearStoredAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// The saved identity, trimmed to the minimal shape (older versions saved the whole profile)
const readStoredUser = () => {
  if (!localStorage.getItem(TOKEN_KEY)) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
  try {
    const u = minimalUser(JSON.parse(localStorage.getItem(USER_KEY) || 'null'));
    if (u) storeUser(u);
    else localStorage.removeItem(USER_KEY);
    return u;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  // Until /auth/me answers, the saved identity keeps the navbar and guarded pages signed in
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));
  const retryTimer = useRef(null);

  const stopRetrying = useCallback(() => {
    clearTimeout(retryTimer.current);
    retryTimer.current = null;
  }, []);

  // Never rejects. Only a 401 ends the session (the axios interceptor clears storage and fires
  // driveaway:auth-expired); timeouts, network errors and 5xx keep it.
  const fetchMe = useCallback(async () => {
    const sentToken = localStorage.getItem(TOKEN_KEY);
    if (!sentToken) return { stale: true };
    try {
      const { data } = await api.get('/auth/me');
      // Signed out or signed in as someone else while this was in flight
      if (localStorage.getItem(TOKEN_KEY) !== sentToken) return { stale: true };
      setUser(data);
      storeUser(data);
      return { data };
    } catch (err) {
      return { error: err, unauthorized: err.response?.status === 401 };
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return undefined;
    let cancelled = false;
    let failures = 0;
    let confirmed = false;

    const attempt = async () => {
      stopRetrying();
      const result = await fetchMe();
      if (cancelled) return;
      setLoading(false);
      if (result.data || result.unauthorized || result.stale) {
        confirmed = true;
        if (result.unauthorized) {
          setUser(null);
          setToken(null);
        }
        return;
      }
      // Could not reach the server: keep the saved session and try again later
      if (failures < RETRY_DELAYS.length) {
        retryTimer.current = setTimeout(attempt, RETRY_DELAYS[failures]);
        failures += 1;
      }
    };

    const onOnline = () => {
      if (confirmed || !localStorage.getItem(TOKEN_KEY)) return;
      failures = 0;
      attempt();
    };

    attempt();
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      stopRetrying();
      window.removeEventListener('online', onOnline);
    };
  }, [fetchMe, stopRetrying]);

  // If any API call returns 401 (expired/invalid token), sign the user out everywhere
  useEffect(() => {
    const onExpired = () => {
      stopRetrying();
      setUser(null);
      setToken(null);
      setLoading(false);
    };
    window.addEventListener('driveaway:auth-expired', onExpired);
    return () => window.removeEventListener('driveaway:auth-expired', onExpired);
  }, [stopRetrying]);

  const login = useCallback((newToken, userData) => {
    stopRetrying();
    localStorage.setItem(TOKEN_KEY, newToken);
    storeUser(userData);
    setToken(newToken);
    setUser(userData);
    setLoading(false);
  }, [stopRetrying]);

  const logout = useCallback(() => {
    stopRetrying();
    clearStoredAuth();
    setToken(null);
    setUser(null);
    setLoading(false);
  }, [stopRetrying]);

  const updateUser = useCallback((data) => {
    setUser((prev) => {
      const next = { ...prev, ...data };
      storeUser(next);
      return next;
    });
  }, []);

  // A password change issues a fresh token (older ones stop working); keep the session on it
  const updateToken = useCallback((newToken) => {
    if (!newToken) return;
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }, []);

  // Re-fetch the profile (loyalty points change with every booking). Resolves to the user, or
  // null when the server could not be reached; never signs out except on a 401.
  const refreshUser = useCallback(async () => {
    const { data } = await fetchMe();
    return data || null;
  }, [fetchMe]);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, updateUser, updateToken, refreshUser }),
    [user, token, loading, login, logout, updateUser, updateToken, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default AuthContext;
