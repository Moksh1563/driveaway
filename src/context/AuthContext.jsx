import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

const clearStoredAuth = () => {
  localStorage.removeItem('driveaway_token');
  localStorage.removeItem('driveaway_user');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('driveaway_token'));
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('driveaway_token')));

  useEffect(() => {
    const storedToken = localStorage.getItem('driveaway_token');
    if (!storedToken) return;
    let cancelled = false;
    api.get('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data);
        setToken(storedToken);
      })
      .catch(() => {
        if (cancelled) return;
        clearStoredAuth();
        setUser(null);
        setToken(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  // If any API call returns 401 (expired/invalid token), sign the user out everywhere
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('driveaway:auth-expired', onExpired);
    return () => window.removeEventListener('driveaway:auth-expired', onExpired);
  }, []);

  const login = useCallback((newToken, userData) => {
    localStorage.setItem('driveaway_token', newToken);
    localStorage.setItem('driveaway_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((data) => {
    setUser((prev) => {
      const next = { ...prev, ...data };
      localStorage.setItem('driveaway_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, updateUser }),
    [user, token, loading, login, logout, updateUser]
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
