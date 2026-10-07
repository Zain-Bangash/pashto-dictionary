import { useState, useEffect } from 'react';
import { getConcept } from '../services/api';

export default function usePublishedConcept(id) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let cancelled = false;
    getConcept(id)
      .then((res) => { if (!cancelled) setVariants(res.data.data.variants ?? []); })
      .catch(() => { if (!cancelled) setError('Failed to load variants'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  return { variants, setVariants, loading, error };
}
