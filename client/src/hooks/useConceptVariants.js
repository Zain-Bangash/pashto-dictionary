import { useState, useEffect } from 'react';
import { getConcept, getVariants } from '../services/api';

// Published concepts load their public variants; pending and approved ones load every variant still under review
export default function useConceptVariants(concept) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const published = concept.status === 'published';

  useEffect(() => {
    let cancelled = false;
    const request = published
      ? getConcept(concept._id).then((res) => res.data.data.variants ?? [])
      : getVariants({ conceptId: concept._id, limit: 50 }).then((res) => (res.data.data ?? []).filter((v) => v.status !== 'rejected'));
    request
      .then((list) => { if (!cancelled) setVariants(list); })
      .catch(() => { if (!cancelled) setError('Failed to load variants'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [concept._id, published]);

  return { variants, setVariants, loading, error };
}
