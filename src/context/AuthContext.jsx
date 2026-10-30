import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('driveaway_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('driveaway_token');
      if (storedToken) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data);
          setToken(storedToken);
        } catch {
          localStorage.removeItem('driveaway_token');
          localStorage.removeItem('driveaway_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };
    restoreSession();
  }, []);

  const login = (newToken, userData) => {
    localStorage.setItem('driveaway_token', newToken);
    localStorage.setItem('driveaway_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('driveaway_token');
    localStorage.removeItem('driveaway_user');
    setToken(null);
    setUser(null);
  };

  const updateUser = (data) => {
    setUser(prev => ({ ...prev, ...data }));
    localStorage.setItem('driveaway_user', JSON.stringify({ ...user, ...data }));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default AuthContext;
