import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// Counts per status for each kind of submission; null until loaded, and stays null if the request fails
// (the sections still work, they just show no counts)
export default function useSubmissionSummary() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/submissions/summary')
      .then((res) => {
        const data = res.data?.data;
        if (!cancelled && data && !Array.isArray(data)) setSummary(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { summary, refresh };
}
