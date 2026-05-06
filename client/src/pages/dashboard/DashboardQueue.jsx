import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// Use api.get/patch/post directly so vi.fn() mocks on api.* work in tests
const suggestConcepts = (q) => api.get(`/api/concepts/suggest?q=${encodeURIComponent(q)}`);
const editConcept = (id, data) => api.patch(`/api/concepts/${id}/edit`, data);
const editVariant = (id, data) => api.patch(`/api/variants/${id}/edit`, data);
const mergeConcepts = (sourceId, body) => api.post(`/api/concepts/${sourceId}/merge`, body);

const POS_OPTIONS = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];
const REGION_OPTIONS = ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'];
const TABS_LIST = ['concepts', 'variants'];

// ---------------------------------------------------------------------------
// Rejection modal
// ---------------------------------------------------------------------------
function RejectModal({ onConfirm, onCancel }) {
  const [note, setNote] = useState('');
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-charcoal border border-white/[0.12] rounded-[20px] p-6 w-full max-w-md mx-4">
        <h2 className="text-warm font-display text-lg font-semibold mb-4">Rejection Reason</h2>
        <label htmlFor="reject-reason" className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">
          Reason for rejection
        </label>
        <textarea
          id="reject-reason"
          placeholder="Reason for rejection"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-2 text-warm text-sm font-ui outline-none focus:border-mint/50 resize-none"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note)}
            disabled={!note.trim()}
            className="px-4 py-2 bg-red-400/10 border border-red-400/30 text-red-400 text-xs font-ui font-semibold rounded-[8px] hover:bg-red-400/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Merge confirmation modal (queue)
// ---------------------------------------------------------------------------
function MergeModal({ sourceItem, targetItem, onConfirm, onCancel }) {
  const [note, setNote] = useState('');
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-charcoal border border-white/[0.12] rounded-[20px] p-6 w-full max-w-md mx-4">
        <h2 className="text-warm font-display text-lg font-semibold mb-2">Confirm Merge</h2>
        <p className="text-sm font-ui text-muted mb-4">
          Move all variants from &ldquo;{sourceItem.englishGloss}&rdquo; into &ldquo;{targetItem.englishGloss}&rdquo; and delete &ldquo;{sourceItem.englishGloss}&rdquo;?
          Variants that would create duplicates will be skipped.
        </p>
        <label htmlFor="merge-note" className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">
          Note
        </label>
        <textarea
          id="merge-note"
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-2 text-warm text-sm font-ui outline-none focus:border-mint/50 resize-none"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note)}
            className="px-4 py-2 bg-mint/10 border border-mint/30 text-mint text-xs font-ui font-semibold rounded-[8px] hover:bg-mint/20 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Concept search dropdown (for variant reassignment)
// ---------------------------------------------------------------------------
function ConceptSearch({ initialGloss, onChange }) {
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

// ---------------------------------------------------------------------------
// Concept inline edit form
// ---------------------------------------------------------------------------
function ConceptEditForm({ item, onSave, onCancel }) {
  const [englishGloss, setEnglishGloss] = useState(item.englishGloss || '');
  const [partOfSpeech, setPartOfSpeech] = useState(item.partOfSpeech || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await editConcept(item._id, { englishGloss, partOfSpeech, note });
      onSave(res.data.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Edit concept" className="mt-3 bg-white/[0.03] border border-white/[0.06] rounded-[14px] p-4 space-y-3">
      <div>
        <label className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">English Gloss</label>
        <input
          aria-label="English Gloss"
          value={englishGloss}
          onChange={(e) => setEnglishGloss(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        />
      </div>
      <div>
        <label className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">Part of Speech</label>
        <select
          aria-label="Part of Speech"
          value={partOfSpeech}
          onChange={(e) => setPartOfSpeech(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        >
          {POS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`edit-note-${item._id}`} className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">Note (required)</label>
        <input
          id={`edit-note-${item._id}`}
          aria-label="Note"
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!note.trim() || saving}
          className="px-3 py-1.5 bg-mint/10 border border-mint/30 text-mint text-xs font-ui font-semibold rounded-[8px] hover:bg-mint/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Variant inline edit form
// ---------------------------------------------------------------------------
function VariantEditForm({ item, onSave, onCancel }) {
  const [pashto, setPashto] = useState(item.pashto || '');
  const [phonetic, setPhonetic] = useState(item.phonetic || '');
  const [region, setRegion] = useState(item.region || '');
  const [definition, setDefinition] = useState(item.definition || '');
  const [example, setExample] = useState(item.example || '');
  const [concept, setConcept] = useState(item.concept?._id || item.concept || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await editVariant(item._id, { pashto, phonetic, region, definition, example, concept, note });
      onSave(res.data.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Edit variant" className="mt-3 bg-white/[0.03] border border-white/[0.06] rounded-[14px] p-4 space-y-3">
      <div>
        <label className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">Pashto</label>
        <input
          aria-label="Pashto"
          value={pashto}
          onChange={(e) => setPashto(e.target.value)}
          dir="rtl"
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-pashto outline-none focus:border-mint/50"
        />
      </div>
      <div>
        <label className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">Phonetic</label>
        <input
          aria-label="Phonetic"
          value={phonetic}
          onChange={(e) => setPhonetic(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        />
      </div>
      <div>
        <label className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">Region</label>
        <select
          aria-label="Region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        >
          {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">Definition</label>
        <input
          aria-label="Definition"
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        />
      </div>
      <div>
        <label className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">Example</label>
        <input
          aria-label="Example"
          value={example}
          onChange={(e) => setExample(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        />
      </div>
      <ConceptSearch
        initialGloss={item.concept?.englishGloss || ''}
        onChange={(id) => setConcept(id)}
      />
      <div>
        <label htmlFor={`edit-variant-note-${item._id}`} className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">Note (required)</label>
        <input
          id={`edit-variant-note-${item._id}`}
          aria-label="Note"
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!note.trim() || saving}
          className="px-3 py-1.5 bg-mint/10 border border-mint/30 text-mint text-xs font-ui font-semibold rounded-[8px] hover:bg-mint/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// SimilarConceptsPanel — fetches suggestions and shows merge button
// ---------------------------------------------------------------------------
function SimilarConceptsPanel({ item, onMergeRequest }) {
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
        <div key={s._id} className="flex items-center justify-between gap-3 px-3 py-2 bg-amber-400/[0.06] border border-amber-400/20 rounded-[10px]">
          <p className="text-xs font-ui text-amber-300">
            Similar concept: &ldquo;{s.englishGloss}&rdquo;
          </p>
          <button
            onClick={() => onMergeRequest(item, s)}
            className="px-2.5 py-1 bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-ui font-semibold rounded-[8px] hover:bg-amber-400/20 transition-colors whitespace-nowrap"
          >
            Merge into this
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function DashboardQueue() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab]                     = useState('concepts');
  const [concepts, setConcepts]           = useState([]);
  const [variants, setVariants]           = useState([]);
  const [conceptsFilter, setConceptsFilter] = useState('pending');
  const [variantsFilter, setVariantsFilter] = useState('pending');
  const [refreshKey, setRefreshKey]         = useState(0);
  const [conceptsCounts, setConceptsCounts] = useState({ pending: 0, approved: 0 });
  const [variantsCounts, setVariantsCounts] = useState({ pending: 0, approved: 0 });
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [actionError, setActionError]       = useState(null);

  // Rejection modal state: { itemId, tab }
  const [rejectModal, setRejectModal] = useState(null);

  // Edit form state: id of item being edited
  const [editingId, setEditingId] = useState(null);

  // Merge modal state: { sourceItem, targetItem }
  const [mergeModal, setMergeModal] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get(`/api/moderation/concepts/queue?status=${conceptsFilter}`),
      api.get(`/api/moderation/variants/queue?status=${variantsFilter}`),
    ])
      .then(([cRes, vRes]) => {
        setConcepts(cRes.data.data || []);
        setVariants(vRes.data.data || []);
        const cm = cRes.data.meta || {};
        const vm = vRes.data.meta || {};
        setConceptsCounts({ pending: cm.pendingCount ?? 0, approved: cm.approvedCount ?? 0 });
        setVariantsCounts({ pending: vm.pendingCount ?? 0, approved: vm.approvedCount ?? 0 });
      })
      .catch(() => setError('Failed to load queue'))
      .finally(() => setLoading(false));
  }, [conceptsFilter, variantsFilter, refreshKey]);

  const items    = tab === 'concepts' ? concepts : variants;
  const setItems = tab === 'concepts' ? setConcepts : setVariants;
  const modelPrefix    = tab === 'concepts' ? 'concepts' : 'variants';
  const activeFilter   = tab === 'concepts' ? conceptsFilter : variantsFilter;
  const setActiveFilter = tab === 'concepts' ? setConceptsFilter : setVariantsFilter;
  const activeCounts   = tab === 'concepts' ? conceptsCounts : variantsCounts;

  // Approve / publish (no modal needed)
  const handleApproveOrPublish = async (id, action) => {
    setActionError(null);
    try {
      await api.patch(`/api/${modelPrefix}/${id}/status`, {
        status: action === 'approve' ? 'approved' : 'published',
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Action failed';
      setActionError(msg);
    }
  };

  // Open reject modal
  const openRejectModal = (itemId) => {
    setRejectModal({ itemId, tab });
  };

  // Confirm rejection
  const handleRejectConfirm = async (note) => {
    const { itemId, tab: modalTab } = rejectModal;
    const prefix = modalTab === 'concepts' ? 'concepts' : 'variants';
    setActionError(null);
    try {
      await api.patch(`/api/${prefix}/${itemId}/status`, {
        status: 'rejected',
        moderatorNote: note,
      });
      setRejectModal(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Action failed';
      setActionError(msg);
      setRejectModal(null);
    }
  };

  // Edit save handlers
  const handleConceptSave = (updatedItem) => {
    setConcepts((prev) => prev.map((c) => (c._id === updatedItem._id ? { ...c, ...updatedItem } : c)));
    setEditingId(null);
  };

  const handleVariantSave = (updatedItem) => {
    setVariants((prev) => prev.map((v) => (v._id === updatedItem._id ? { ...v, ...updatedItem } : v)));
    setEditingId(null);
  };

  // Merge: "Merge into this" clicked from SimilarConceptsPanel
  // targetItem = queue item (stays), sourceItem = suggestion (gets merged+deleted)
  const handleMergeRequest = (targetItem, sourceItem) => {
    setMergeModal({ sourceItem, targetItem });
  };

  const handleMergeConfirm = async (note) => {
    const { sourceItem, targetItem } = mergeModal;
    setActionError(null);
    try {
      await mergeConcepts(sourceItem._id, { targetConceptId: targetItem._id, note });
      setMergeModal(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Merge failed';
      setActionError(msg);
      setMergeModal(null);
    }
  };

  if (loading) return <div className="text-muted font-ui text-sm animate-pulse">Loading…</div>;
  if (error)   return <div className="text-red-400 font-ui text-sm">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-display text-warm mb-6">Moderation Queue</h1>

      {/* Tab toggle */}
      <div className="flex gap-2 mb-4">
        {TABS_LIST.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="font-ui text-xs px-4 py-2 rounded-full capitalize transition-all"
            style={{
              background: tab === t ? 'rgba(0,245,180,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${tab === t ? 'rgba(0,245,180,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: tab === t ? '#00f5b4' : '#666',
            }}
          >
            {t} ({t === 'concepts'
              ? (isAdmin ? conceptsCounts.pending + conceptsCounts.approved : conceptsCounts.pending)
              : (isAdmin ? variantsCounts.pending + variantsCounts.approved : variantsCounts.pending)})
          </button>
        ))}
      </div>

      {/* Status filter — admin only */}
      {isAdmin && (
        <div className="flex gap-2 mb-5">
          {['pending', 'approved'].map((s) => (
            <button
              key={s}
              onClick={() => setActiveFilter(s)}
              className="font-ui text-xs px-3 py-1.5 rounded-full capitalize transition-all"
              style={{
                background: activeFilter === s ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${activeFilter === s ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: activeFilter === s ? '#a78bfa' : '#666',
              }}
            >
              {s} ({activeCounts[s]})
            </button>
          ))}
        </div>
      )}

      {actionError && (
        <div className="mb-4 text-red-400 text-sm font-ui">{actionError}</div>
      )}

      {items.length === 0 ? (
        <p className="text-muted font-ui text-sm">Nothing in the queue.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item._id} className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1 flex-1">
                  {tab === 'concepts' ? (
                    <>
                      <p className="text-warm font-display text-lg font-semibold">{item.englishGloss}</p>
                      <p className="text-sm font-ui text-muted">{item.partOfSpeech}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div dir="rtl" className="font-pashto text-warm text-2xl" style={{ lineHeight: 1.7 }}>
                          {item.pashto}
                        </div>
                        {item.phonetic && (
                          <span className="font-ui text-sm text-muted">/{item.phonetic}/</span>
                        )}
                        <span className="font-ui text-xs px-2 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-muted/70">
                          {item.region}
                        </span>
                      </div>
                      <p className="text-sm font-ui text-muted">{item.definition}</p>
                      {item.example && (
                        <p className="text-xs font-ui text-muted/60 italic">{item.example}</p>
                      )}
                      {item.concept && (
                        <p className="text-xs font-ui text-muted/50">
                          Concept: <span className="text-muted/80">{item.concept.englishGloss}</span>
                          <span className="ml-1.5 px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-[10px]">
                            {item.concept.status}
                          </span>
                        </p>
                      )}
                      {item.submissionNote && (
                        <div className="mt-1 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-[10px]">
                          <p className="text-[10px] font-ui font-semibold text-muted uppercase tracking-wider mb-1">Submitter note</p>
                          <p className="text-xs font-ui text-muted/80 break-words">{item.submissionNote}</p>
                        </div>
                      )}
                    </>
                  )}
                  <p className="text-xs font-ui text-muted/60">
                    by {item.submittedBy?.username}
                    {(item.submittedBy?.village || item.submittedBy?.region) && (
                      <span className="ml-1">
                        ({[item.submittedBy.village, item.submittedBy.region].filter(Boolean).join(', ')})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {item.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApproveOrPublish(item._id, 'approve')}
                        className="px-3 py-1.5 bg-mint/10 border border-mint/30 text-mint text-xs font-ui font-semibold rounded-[8px] hover:bg-mint/20 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => openRejectModal(item._id)}
                        className="px-3 py-1.5 bg-red-400/10 border border-red-400/30 text-red-400 text-xs font-ui font-semibold rounded-[8px] hover:bg-red-400/20 transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {item.status === 'approved' && isAdmin && (
                    <button
                      onClick={() => handleApproveOrPublish(item._id, 'publish')}
                      className="px-3 py-1.5 bg-violet/10 border border-violet/30 text-violet text-xs font-ui font-semibold rounded-[8px] hover:bg-violet/20 transition-colors"
                    >
                      Publish
                    </button>
                  )}
                  <button
                    onClick={() => setEditingId(editingId === item._id ? null : item._id)}
                    className="px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Inline edit form */}
              {editingId === item._id && (
                tab === 'concepts' ? (
                  <ConceptEditForm
                    item={item}
                    onSave={handleConceptSave}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <VariantEditForm
                    item={item}
                    onSave={handleVariantSave}
                    onCancel={() => setEditingId(null)}
                  />
                )
              )}

              {/* Similar concepts panel — Concepts tab only, hidden when merge modal is open */}
              {tab === 'concepts' && !mergeModal && (
                <SimilarConceptsPanel
                  item={item}
                  onMergeRequest={handleMergeRequest}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Rejection modal */}
      {rejectModal && (
        <RejectModal
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectModal(null)}
        />
      )}

      {/* Merge confirmation modal */}
      {mergeModal && (
        <MergeModal
          sourceItem={mergeModal.sourceItem}
          targetItem={mergeModal.targetItem}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergeModal(null)}
        />
      )}
    </div>
  );
}
