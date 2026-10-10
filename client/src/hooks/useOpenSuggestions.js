import { useState, useEffect } from 'react';
import { getSuggestionQueue } from '../services/api';

// Open suggestions on one concept's variants: variant id → list of suggestions (several people may suggest)
export default function useOpenSuggestions(conceptId) {
  const [byVariant, setByVariant] = useState({});

  useEffect(() => {
    if (!conceptId) return undefined;
    let cancelled = false;
    getSuggestionQueue({ concept: conceptId, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setByVariant(Object.fromEntries((res.data.data || []).map((g) => [String(g.variant?._id), g.suggestions])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conceptId]);

  return byVariant;
}
