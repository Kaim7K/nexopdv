import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';

export function useMediaQuery(query, beforeChange) {
  const media = useMemo(() => typeof window === 'undefined' ? null : window.matchMedia(query), [query]);
  const subscribe = useCallback(listener => {
    if (!media) return () => {};
    const change = () => { beforeChange?.(); listener(); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [media, beforeChange]);
  return useSyncExternalStore(subscribe, () => media?.matches || false, () => false);
}

export function useContainerMinWidth(minWidth) {
  const [element, ref] = useState(null);
  const [matches, setMatches] = useState(false);
  useLayoutEffect(() => {
    if (!element) return;
    setMatches(element.clientWidth >= minWidth);
    const observer = new ResizeObserver(([entry]) => setMatches(entry.contentRect.width >= minWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, minWidth]);
  return { ref, matches };
}
