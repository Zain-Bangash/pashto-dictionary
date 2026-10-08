import { useState, useEffect } from 'react';
import { getSuggestionQueue } from '../services/api';

// Open suggestions on one concept's variants, keyed by variant id
export default function useOpenSuggestions(conceptId) {
  const [byVariant, setByVariant] = useState({});

  useEffect(() => {
    let cancelled = false;
    getSuggestionQueue({ concept: conceptId, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setByVariant(Object.fromEntries((res.data.data || []).map((s) => [String(s.variant?._id ?? s.variant), s])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conceptId]);

  return byVariant;
}
