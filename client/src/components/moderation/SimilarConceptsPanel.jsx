import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

const suggestConcepts = (q) => api.get(`/api/concepts/suggest?q=${encodeURIComponent(q)}`);

export default function SimilarConceptsPanel({ item, onMergeRequest }) {
  const [similar, setSimilar] = useState([]);
  // Use a ref to track the gloss at mount time so the effect fires only once per item
  const initialGlossRef = useRef(item.englishGloss);

  useEffect(() => {
    const req = suggestConcepts(initialGlossRef.current);
    if (!req) return;
    req.then((res) => {
      const results = (res.data.data || []).filter((s) => s._id !== item._id);
      setSimilar(results);
    }).catch(() => setSimilar([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item._id]);

  if (similar.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {similar.map((s) => (
        <div key={s._id} className="flex items-center justify-between gap-3 px-3 py-2 bg-gold/[0.06] border border-gold/20 rounded-[10px]">
          <p className="text-xs font-ui text-gold">
            Similar concept: &ldquo;{s.englishGloss}&rdquo;
          </p>
          {onMergeRequest && <button
            onClick={() => onMergeRequest(item, s)}
            className="px-2.5 py-1 bg-gold/10 border border-gold/30 text-gold text-xs font-ui font-semibold rounded-[8px] hover:bg-gold/20 transition-colors whitespace-nowrap"
          >
            Merge into this
          </button>}
        </div>
      ))}
    </div>
  );
}
