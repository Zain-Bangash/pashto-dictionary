import { useState, useEffect, useCallback } from 'react';

export const MY_PAGE_SIZE = 5;

const EMPTY = { total: 0, limit: MY_PAGE_SIZE };

// Loads one page of a list; `params` drop empty values. Loading is derived: the stored result belongs to an
// older request until its key matches the current one.
export default function usePagedList(fetchPage, params, errorMessage) {
  const [refreshKey, setRefreshKey] = useState(0);
  const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== false));
  const key = `${JSON.stringify(query)}|${refreshKey}`;
  const [result, setResult] = useState({ key: null, items: [], meta: EMPTY, error: null });

  useEffect(() => {
    let cancelled = false;
    fetchPage(query)
      .then((res) => {
        if (!cancelled) setResult({ key, items: res.data.data || [], meta: { total: res.data.meta?.total ?? 0, limit: res.data.meta?.limit ?? MY_PAGE_SIZE }, error: null });
      })
      .catch(() => { if (!cancelled) setResult((r) => ({ ...r, key, error: errorMessage })); });
    return () => { cancelled = true; };
    // fetchPage and errorMessage are fixed per list; the key carries every input that matters, including query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setItems = useCallback((update) => setResult((r) => ({ ...r, items: update(r.items) })), []);
  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);
  const current = result.key === key;

  return {
    items: result.items,
    setItems,
    total: result.meta.total,
    totalPages: Math.max(1, Math.ceil(result.meta.total / result.meta.limit)),
    loading: !current,
    loaded: result.key !== null,
    error: current ? result.error : null,
    reload,
  };
}
