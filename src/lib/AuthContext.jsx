import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { nexoApi } from '@/api/nexoApi';

const AuthContext = createContext(null);
const USER_CACHE_KEY = 'nexo:session-user';
const USER_CACHE_TTL = 60_000;

function readCachedUser() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(USER_CACHE_KEY) || 'null');
    return cached && cached.expiresAt > Date.now() ? cached.user : null;
  } catch {
    return null;
  }
}

function cacheUser(user) {
  try {
    if (user) sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify({ user, expiresAt: Date.now() + USER_CACHE_TTL }));
    else sessionStorage.removeItem(USER_CACHE_KEY);
  } catch { /* cache opcional */ }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readCachedUser());
  const initialUserRef = useRef(user);
  const [isLoadingAuth, setLoading] = useState(!user);
  const [authChecked, setChecked] = useState(Boolean(user));

  const checkUserAuth = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const authenticated = await nexoApi.auth.me();
      setUser(authenticated);
      cacheUser(authenticated);
      return authenticated;
    } catch {
      setUser(null);
      cacheUser(null);
      return null;
    } finally {
      setLoading(false);
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth({ silent: Boolean(initialUserRef.current) });
  }, [checkUserAuth]);

  useEffect(() => {
    const expireSession = () => {
      setUser(null);
      cacheUser(null);
      setLoading(false);
      setChecked(true);
    };
    window.addEventListener('nexo:session-expired', expireSession);
    return () => window.removeEventListener('nexo:session-expired', expireSession);
  }, []);

  const logout = async () => {
    try { await nexoApi.auth.logout(); } finally {
      setUser(null);
      cacheUser(null);
      window.location.href = '/';
    }
  };

  return <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isLoadingAuth, authChecked, checkUserAuth, logout, navigateToLogin: () => { window.location.href = '/login'; } }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
