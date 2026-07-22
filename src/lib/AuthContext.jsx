import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const [user, setUser] = useState(() => readCachedUser());
  const initialUserRef = useRef(user);
  const validationRef = useRef(false);
  const authRequestRef = useRef(null);
  const isPrivateRoute =
    location.pathname !== '/' && location.pathname !== '/login';
  const [isLoadingAuth, setLoading] = useState(() =>
    isPrivateRoute ? !user : false,
  );
  const [authChecked, setChecked] = useState(Boolean(user));

  const checkUserAuth = useCallback(async ({ silent = false } = {}) => {
    if (authRequestRef.current) return authRequestRef.current;
    if (!silent) setLoading(true);
    authRequestRef.current = nexoApi.auth
      .me()
      .then((authenticated) => {
        setUser(authenticated);
        cacheUser(authenticated);
        return authenticated;
      })
      .catch(() => {
        setUser(null);
        cacheUser(null);
        return null;
      })
      .finally(() => {
        setLoading(false);
        setChecked(true);
        authRequestRef.current = null;
      });
    return authRequestRef.current;
  }, []);

  useEffect(() => {
    if (!isPrivateRoute || validationRef.current) {
      if (!isPrivateRoute) setLoading(false);
      return;
    }
    validationRef.current = true;
    checkUserAuth({ silent: Boolean(initialUserRef.current) });
  }, [checkUserAuth, isPrivateRoute]);

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

  const logout = useCallback(async () => {
    try { await nexoApi.auth.logout(); } finally {
      setUser(null);
      cacheUser(null);
      window.location.href = '/';
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoadingAuth,
      authChecked,
      checkUserAuth,
      logout,
      navigateToLogin,
    }),
    [
      user,
      isLoadingAuth,
      authChecked,
      checkUserAuth,
      logout,
      navigateToLogin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
