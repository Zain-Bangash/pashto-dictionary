import { useState, useEffect, useCallback } from 'react';
import { getAllFields } from '../services/api';

export default function useAllFields(enabled) {
  const [defs, setDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDefs = useCallback(() => (
    getAllFields()
      .then((res) => { setDefs(res.data.data ?? []); setError(null); })
      .catch(() => setError('Could not load fields'))
      .finally(() => setLoading(false))
  ), []);

  const reload = useCallback(() => {
    setLoading(true);
    return fetchDefs();
  }, [fetchDefs]);

  useEffect(() => { if (enabled) fetchDefs(); }, [enabled, fetchDefs]);

  return { defs, loading, error, reload };
}
