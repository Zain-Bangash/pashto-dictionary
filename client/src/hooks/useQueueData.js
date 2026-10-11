import { useState, useEffect, useRef, useCallback } from 'react';

const EMPTY_META = { total: 0, limit: 20, pendingCount: 0, approvedCount: 0 };

// Loads one queue page whenever `key` changes. `loaded` turns true after the first response so a reload
// keeps the old list on screen; `loading` is derived from whether the stored result matches the key.
export default function useQueueData(load, key, errorMessage) {
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], meta: EMPTY_META, error: null });
  const fullKey = `${key}|${refreshKey}`;

  useEffect(() => {
    let cancelled = false;
    loadRef.current()
      .then((res) => {
        if (!cancelled) setResult({ key: fullKey, items: res.data.data || [], meta: { ...EMPTY_META, ...res.data.meta }, error: null });
      })
      .catch(() => { if (!cancelled) setResult((r) => ({ ...r, key: fullKey, error: errorMessage })); });
    return () => { cancelled = true; };
  }, [fullKey, errorMessage]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const loading = result.key !== fullKey;
  return {
    items: result.items,
    setItems: (update) => setResult((r) => ({ ...r, items: typeof update === 'function' ? update(r.items) : update })),
    meta: result.meta,
    loaded: result.key !== null && !result.error,
    loading,
    error: loading ? null : result.error,
    refresh,
  };
}
