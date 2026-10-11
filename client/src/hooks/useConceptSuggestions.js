import { useState, useEffect } from 'react';
import { suggestConcepts } from '../services/api';
import useDebouncedValue from './useDebouncedValue';

// Existing concepts whose English gloss matches what the user is typing
export default function useConceptSuggestions(query) {
  const debounced = useDebouncedValue(query.trim(), 300);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!debounced) return undefined;
    let current = true;
    suggestConcepts(debounced)
      .then((res) => { if (current) setSuggestions(res.data.data || []); })
      .catch(() => { if (current) setSuggestions([]); });
    return () => { current = false; };
  }, [debounced]);

  return query.trim() ? suggestions : [];
}
