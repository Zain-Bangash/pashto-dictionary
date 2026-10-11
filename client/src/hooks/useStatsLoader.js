import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export default function useStatsLoader(enabled = true) {
  const [state, setState] = useState({ stats: null, loading: enabled, error: null });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/moderation/stats');
        if (!cancelled) setState({ stats: res.data.data, loading: false, error: null });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: 'Failed to load stats' }));
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { ...state, refresh };
}
