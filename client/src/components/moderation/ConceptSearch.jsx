import { useState } from 'react';
import api from '../../services/api';

const suggestConcepts = (q) => api.get(`/api/concepts/suggest?q=${encodeURIComponent(q)}`);

export default function ConceptSearch({ initialGloss, onChange }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const handleType = (e) => {
    const q = e.target.value;
    setQuery(q);
    if (!q.trim()) { setSuggestions([]); return; }
    const req = suggestConcepts(q);
    if (!req) return;
    req.then((res) => {
      setSuggestions(res.data.data || []);
    }).catch(() => setSuggestions([]));
  };

  const handleSelect = (s) => {
    setQuery(s.englishGloss);
    setSuggestions([]);
    onChange(s._id);
  };

  return (
    <div className="relative">
      <label className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">Concept</label>
      {initialGloss && !query && (
        <p className="text-xs font-ui text-muted/70 mb-1">Current: {initialGloss}</p>
      )}
      <input
        aria-label="Concept"
        placeholder="Search concept"
        value={query}
        onChange={handleType}
        className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-20 w-full bg-charcoal border border-white/[0.12] rounded-[10px] mt-1 max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s._id}
              onClick={() => handleSelect(s)}
              className="px-3 py-2 text-sm font-ui text-warm hover:bg-white/[0.06] cursor-pointer"
            >
              {s.englishGloss} — ID: {s._id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
