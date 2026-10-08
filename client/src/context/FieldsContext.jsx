import { useState, useEffect, useCallback, useMemo } from 'react';
import { getFields } from '../services/api';
import { FieldsContext, buildFieldsValue } from './fieldsValue';

export function FieldsProvider({ children }) {
  const [defs, setDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDefs = useCallback(() => (
    getFields()
      .then((res) => { setDefs(res.data.data ?? []); setError(null); })
      .catch(() => setError('Could not load extra fields'))
      .finally(() => setLoading(false))
  ), []);

  const reload = useCallback(() => {
    setLoading(true);
    return fetchDefs();
  }, [fetchDefs]);

  useEffect(() => { fetchDefs(); }, [fetchDefs]);

  const value = useMemo(() => buildFieldsValue({ defs, loading, error, reload }), [defs, loading, error, reload]);
  return <FieldsContext.Provider value={value}>{children}</FieldsContext.Provider>;
}
