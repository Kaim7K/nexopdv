import { useCallback, useEffect, useRef } from 'react';
import { nexoApi } from '@/api/nexoApi';
import { useAuth } from '@/lib/AuthContext';

const RELOAD_TOKEN_KEY = 'nexo:system-reload-token';
const POLL_INTERVAL_MS = 60_000;
const ERROR_RETRY_MS = 5 * 60_000;

export default function SystemReloadWatcher() {
  const { user } = useAuth();
  const checkingRef = useRef(false);
  const reloadTimerRef = useRef(null);
  const retryAfterRef = useRef(0);

  const checkForReload = useCallback(async () => {
    if (
      !user ||
      checkingRef.current ||
      reloadTimerRef.current ||
      Date.now() < retryAfterRef.current
    )
      return;
    checkingRef.current = true;

    try {
      const status = await nexoApi.system.reloadStatus();
      retryAfterRef.current = 0;
      const nextToken = String(status?.reload_token || '0');
      const currentToken = window.sessionStorage.getItem(RELOAD_TOKEN_KEY);

      if (!currentToken) {
        window.sessionStorage.setItem(RELOAD_TOKEN_KEY, nextToken);
        return;
      }
      if (currentToken === nextToken) return;

      window.sessionStorage.setItem(RELOAD_TOKEN_KEY, nextToken);
      reloadTimerRef.current = window.setTimeout(() => {
        window.location.reload();
      }, 1_000);
    } catch {
      retryAfterRef.current = Date.now() + ERROR_RETRY_MS;
    } finally {
      checkingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    checkForReload();
    const interval = window.setInterval(checkForReload, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkForReload();
    };
    window.addEventListener('focus', checkForReload);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
      window.removeEventListener('focus', checkForReload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForReload, user]);

  return null;
}
