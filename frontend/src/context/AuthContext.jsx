import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import { clearOfflineCache } from '../utils/offlineQueue';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('stocksentry_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('stocksentry_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          localStorage.setItem('stocksentry_user', JSON.stringify(res.data));
        } catch (err) {
          console.error("Session verification failed", err);
          logout();
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, refresh_token, ...userData } = res.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('stocksentry_token', access_token);
    if (refresh_token) localStorage.setItem('stocksentry_refresh_token', refresh_token);
    localStorage.setItem('stocksentry_user', JSON.stringify(userData));
    return userData;
  };

  const logout = async () => {
    try {
      if (localStorage.getItem('stocksentry_token')) {
        await api.post('/auth/logout').catch(() => {});
      }
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('stocksentry_token');
      localStorage.removeItem('stocksentry_refresh_token');
      localStorage.removeItem('stocksentry_user');
      clearOfflineCache();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
