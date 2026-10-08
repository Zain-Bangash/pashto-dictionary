import { useState, useEffect } from 'react';
import { getWanted } from '../services/api';

const EMPTY = { key: null, concepts: [], meta: { page: 1, limit: 20, total: 0 }, error: null };

// loading is derived: the stored result belongs to an older request until its key matches
export default function useWantedConcepts({ region, q, page }) {
  const key = `${region}|${q}|${page}`;
  const [result, setResult] = useState(EMPTY);

  useEffect(() => {
    if (!region) return undefined;
    let cancelled = false;
    getWanted({ region, page, ...(q && { q }) })
      .then((res) => { if (!cancelled) setResult({ key, concepts: res.data.data, meta: res.data.meta, error: null }); })
      .catch(() => { if (!cancelled) setResult({ ...EMPTY, key, error: 'Failed to load wanted words.' }); });
    return () => { cancelled = true; };
  }, [key, region, q, page]);

  const current = result.key === key;
  return { concepts: result.concepts, meta: result.meta, loading: !current, error: current ? result.error : null };
}
