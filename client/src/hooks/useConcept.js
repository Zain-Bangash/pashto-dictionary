import { useState, useEffect } from 'react';
import api from '../services/api';

// One published concept with its words; loading is derived from which id the stored result belongs to
export default function useConcept(id) {
  const [result, setResult] = useState({ id: null, concept: null, error: null });

  useEffect(() => {
    let current = true;
    api.get(`/api/concepts/${id}`)
      .then((res) => { if (current) setResult({ id, concept: res.data.data, error: null }); })
      .catch((err) => {
        if (!current) return;
        setResult({ id, concept: null, error: err.response?.status === 404 ? 'Entry not found.' : 'Failed to load entry.' });
      });
    return () => { current = false; };
  }, [id]);

  const fresh = result.id === id;
  return { concept: fresh ? result.concept : null, loading: !fresh, error: fresh ? result.error : null };
}
