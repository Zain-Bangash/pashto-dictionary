import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const EMPTY_META = { page: 1, limit: 20, total: 0, needsCompletionCount: 0 };

// Calls api.get directly so tests that mock the default export cover it.
// loading is derived: the stored result belongs to an older request until its key matches.
export default function useMyVariants({ completion, missing, region, page }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const key = `${completion}|${missing}|${region}|${page}|${refreshKey}`;
  const [result, setResult] = useState({ key: null, variants: [], meta: EMPTY_META, error: null });

  useEffect(() => {
    let cancelled = false;
    const params = {
      ...(page > 1 && { page }),
      ...(region && { region }),
      ...(completion && { needs: 'completion', ...(missing && { missing }) }),
    };
    api.get('/api/variants/my-submissions', { params })
      .then((res) => {
        if (!cancelled) setResult({ key, variants: res.data.data || [], meta: { ...EMPTY_META, ...res.data.meta }, error: null });
      })
      .catch(() => { if (!cancelled) setResult((r) => ({ ...r, key, error: 'Failed to load submissions' })); });
    return () => { cancelled = true; };
  }, [key, completion, missing, region, page]);

  const setVariants = useCallback((update) => setResult((r) => ({ ...r, variants: update(r.variants) })), []);
  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);
  const current = result.key === key;

  return {
    variants: result.variants,
    setVariants,
    meta: result.meta,
    loading: !current,
    loaded: result.key !== null,
    error: current ? result.error : null,
    reload,
  };
}
