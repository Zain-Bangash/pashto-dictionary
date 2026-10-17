import { useState, useEffect } from 'react';

const EMPTY = { key: null, items: [], meta: { page: 1, limit: 20, total: 0 }, error: null };

// One page of a Wanted list; waits for a region. Loading is derived: the stored result belongs to an older request until its key matches
export default function useWantedList(fetchPage, params, errorMessage) {
  const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined));
  const key = JSON.stringify(query);
  const [result, setResult] = useState(EMPTY);

  useEffect(() => {
    if (!query.region) return undefined;
    let cancelled = false;
    fetchPage(query)
      .then((res) => { if (!cancelled) setResult({ key, items: res.data.data, meta: res.data.meta, error: null }); })
      .catch(() => { if (!cancelled) setResult({ ...EMPTY, key, error: errorMessage }); });
    return () => { cancelled = true; };
    // fetchPage and errorMessage are fixed per page; the key carries every input that matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = result.key === key;
  return {
    items: current ? result.items : [],
    total: result.meta.total,
    totalPages: Math.max(1, Math.ceil(result.meta.total / result.meta.limit)),
    loading: !current,
    error: current ? result.error : null,
  };
}
