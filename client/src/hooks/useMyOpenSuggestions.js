import { useState, useEffect } from 'react';
import { getMySuggestions } from '../services/api';

// Ids of the words on one concept where the signed-in user already has an open suggestion
export default function useMyOpenSuggestions(conceptId, signedIn) {
  const [variantIds, setVariantIds] = useState(() => new Set());

  useEffect(() => {
    if (!signedIn || !conceptId) return undefined;
    let cancelled = false;
    getMySuggestions({ status: 'open', concept: conceptId, limit: 50 })
      .then((res) => {
        if (!cancelled) setVariantIds(new Set((res.data.data || []).map((s) => String(s.variant?._id))));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conceptId, signedIn]);

  const markOpen = (id) => setVariantIds((ids) => new Set(ids).add(String(id)));

  return { openVariantIds: variantIds, markOpen };
}
