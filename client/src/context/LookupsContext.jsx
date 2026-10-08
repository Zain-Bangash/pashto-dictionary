import { useState, useEffect, useCallback, useMemo } from 'react';
import { getLookups } from '../services/api';
import { LookupsContext, buildLookupsValue } from './lookupsValue';

export function LookupsProvider({ children }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRows = useCallback(() => (
    getLookups()
      .then((res) => { setRows(res.data.data ?? []); setError(null); })
      .catch(() => setError('Could not load list options'))
      .finally(() => setLoading(false))
  ), []);

  const reload = useCallback(() => {
    setLoading(true);
    return fetchRows();
  }, [fetchRows]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const value = useMemo(() => buildLookupsValue({ rows, loading, error, reload }), [rows, loading, error, reload]);
  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>;
}
