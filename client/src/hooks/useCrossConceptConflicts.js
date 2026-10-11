import { useState, useEffect } from 'react';
import { loadConflicts } from '../utils/entryQueue';

// Maps each queued variant id to the other concepts already holding the same Pashto word.
export default function useCrossConceptConflicts(groups) {
  const [conflicts, setConflicts] = useState({});

  useEffect(() => {
    let cancelled = false;
    loadConflicts(groups).then((result) => { if (!cancelled) setConflicts(result); });
    return () => { cancelled = true; };
  }, [groups]);

  return conflicts;
}
