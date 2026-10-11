import { useState, useEffect } from 'react';
import api from '../services/api';

const EMPTY_META = { page: 1, limit: 20, total: 0 };

function urlFor({ q, domain, region, page }) {
  const params = new URLSearchParams({ page });
  if (q) params.set('q', q);
  if (domain) params.set('domain', domain);
  if (region) params.set('region', region);
  return q ? `/api/concepts/search?${params.toString()}` : `/api/concepts?${params.toString()}`;
}

// Browse results for the URL filters. Loading is derived (the stored result belongs to an older URL), so the
// previous page stays on screen while the next one loads.
export default function useConceptList(filters) {
  const url = urlFor(filters);
  const [result, setResult] = useState({ url: null, concepts: [], meta: EMPTY_META, error: null });

  useEffect(() => {
    let current = true;
    api.get(url)
      .then((res) => { if (current) setResult({ url, concepts: res.data.data, meta: res.data.meta, error: null }); })
      .catch(() => { if (current) setResult((r) => ({ ...r, url, error: 'Failed to load concepts.' })); });
    return () => { current = false; };
  }, [url]);

  const fresh = result.url === url;
  return {
    concepts: result.concepts,
    meta: result.meta,
    loading: !fresh,
    loaded: result.url !== null && !result.error,
    error: fresh ? result.error : null,
  };
}
