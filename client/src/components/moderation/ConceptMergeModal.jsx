import { useState } from 'react';
import api from '../../services/api';

// Use api.get directly so vi.fn() mocks on api.* work in tests
const suggestConcepts = (q) => api.get(`/api/concepts/suggest?q=${encodeURIComponent(q)}`);

export default function ConceptMergeModal({ sourceConcept, onConfirm, onCancel }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [targetConcept, setTargetConcept] = useState(null);
  const [note, setNote] = useState('');

  const handleSearch = (e) => {
    const q = e.target.value;
    setQuery(q);
    setTargetConcept(null);
    if (!q.trim()) { setSuggestions([]); return; }
    const req = suggestConcepts(q);
    if (!req) return;
    req.then((res) => {
      setSuggestions((res.data.data || []).filter((s) => s._id !== sourceConcept._id));
    }).catch(() => setSuggestions([]));
  };

  const handleSelect = (s) => {
    setTargetConcept(s);
    setQuery(s.englishGloss);
    setSuggestions([]);
  };

  const handleConfirm = () => {
    if (!targetConcept) return;
    onConfirm(targetConcept._id, note);
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-charcoal border border-white/[0.12] rounded-[20px] p-6 w-full max-w-md mx-4">
        <h2 className="text-warm font-display text-lg font-semibold mb-2">Merge Concept</h2>
        <p className="text-sm font-ui text-muted mb-4">
          Merge &ldquo;{sourceConcept.englishGloss}&rdquo; into another concept.
        </p>

        <div className="relative mb-3">
          <label htmlFor="merge-search" className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">
            Search target concept
          </label>
          <input
            id="merge-search"
            aria-label="Search target concept"
            placeholder="Search concept"
            value={query}
            onChange={handleSearch}
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

        <div className="mb-3">
          <label htmlFor="merge-note" className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">
            Note
          </label>
          <input
            id="merge-note"
            aria-label="Note"
            placeholder="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!targetConcept}
            className="px-4 py-2 bg-mint/10 border border-mint/30 text-mint text-xs font-ui font-semibold rounded-[8px] hover:bg-mint/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
