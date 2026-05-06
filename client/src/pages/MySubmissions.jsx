import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { updateConcept, updateVariant } from '../services/api';

const STATUS_STYLES = {
  pending:   { color: '#e8c547', border: 'rgba(232,197,71,0.3)',  bg: 'rgba(232,197,71,0.08)' },
  approved:  { color: '#00f5b4', border: 'rgba(0,245,180,0.3)',   bg: 'rgba(0,245,180,0.08)' },
  published: { color: '#00f5b4', border: 'rgba(0,245,180,0.3)',   bg: 'rgba(0,245,180,0.08)' },
  rejected:  { color: '#f87171', border: 'rgba(248,113,113,0.3)', bg: 'rgba(248,113,113,0.08)' },
};

const PART_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];
const REGIONS = ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'];

const inputCls = 'w-full bg-white/[0.06] border border-white/[0.12] rounded-[10px] px-3 py-2 text-sm font-ui text-warm placeholder-white/30 focus:outline-none focus:border-terracotta/60';
const labelCls = 'block text-[11px] font-ui text-muted mb-1';

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className="shrink-0 text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {status}
    </span>
  );
}

function Section({ title, items, renderItem }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="text-xs font-ui font-semibold text-muted uppercase tracking-widest mb-3">{title}</h2>
      <ul className="space-y-3">
        {items.map((item) => renderItem(item))}
      </ul>
    </div>
  );
}

function ConceptEditForm({ concept, onSave, onCancel }) {
  const [englishGloss, setEnglishGloss] = useState(concept.englishGloss);
  const [partOfSpeech, setPartOfSpeech] = useState(concept.partOfSpeech || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await updateConcept(concept._id, { englishGloss, partOfSpeech });
      onSave(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-white/[0.08] pt-4">
      <div>
        <label className={labelCls}>English Gloss</label>
        <input
          className={inputCls}
          value={englishGloss}
          onChange={(e) => setEnglishGloss(e.target.value)}
          required
        />
      </div>
      <div>
        <label className={labelCls}>Part of Speech</label>
        <select
          className={inputCls}
          value={partOfSpeech}
          onChange={(e) => setPartOfSpeech(e.target.value)}
        >
          <option value="">— select —</option>
          {PART_OF_SPEECH.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {error && <p className="text-xs font-ui text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 bg-terracotta text-warm text-xs font-ui font-semibold rounded-[8px] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & Resubmit'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 bg-white/[0.06] text-muted text-xs font-ui rounded-[8px] hover:bg-white/[0.1] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function VariantEditForm({ variant, onSave, onCancel }) {
  const [fields, setFields] = useState({
    pashto: variant.pashto,
    phonetic: variant.phonetic || '',
    region: variant.region || '',
    definition: variant.definition,
    example: variant.example || '',
    submissionNote: variant.submissionNote || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key) {
    return (e) => setFields((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...fields };
      if (!body.phonetic) delete body.phonetic;
      if (!body.region) delete body.region;
      if (!body.example) delete body.example;
      if (!body.submissionNote) delete body.submissionNote;
      const res = await updateVariant(variant._id, body);
      onSave(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-white/[0.08] pt-4">
      <div>
        <label className={labelCls}>Pashto Word</label>
        <input dir="rtl" className={`${inputCls} font-pashto text-lg`} value={fields.pashto} onChange={set('pashto')} required />
      </div>
      <div>
        <label className={labelCls}>Phonetic</label>
        <input className={inputCls} value={fields.phonetic} onChange={set('phonetic')} placeholder="optional" />
      </div>
      <div>
        <label className={labelCls}>Region</label>
        <select className={inputCls} value={fields.region} onChange={set('region')}>
          <option value="">— select —</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Definition</label>
        <input className={inputCls} value={fields.definition} onChange={set('definition')} required />
      </div>
      <div>
        <label className={labelCls}>Example</label>
        <input className={inputCls} value={fields.example} onChange={set('example')} placeholder="optional" />
      </div>
      <div>
        <label className={labelCls}>Submission Note</label>
        <input className={inputCls} value={fields.submissionNote} onChange={set('submissionNote')} placeholder="optional" maxLength={500} />
      </div>
      {error && <p className="text-xs font-ui text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 bg-terracotta text-warm text-xs font-ui font-semibold rounded-[8px] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & Resubmit'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 bg-white/[0.06] text-muted text-xs font-ui rounded-[8px] hover:bg-white/[0.1] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function MySubmissions() {
  const [concepts, setConcepts]   = useState([]);
  const [variants, setVariants]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/api/concepts/my-submissions'),
      api.get('/api/variants/my-submissions'),
    ])
      .then(([cRes, vRes]) => {
        setConcepts(cRes.data.data || []);
        setVariants(vRes.data.data || []);
      })
      .catch(() => {
        setError('Failed to load submissions');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function handleConceptSaved(updated) {
    setConcepts((prev) => prev.map((c) => c._id === updated._id ? updated : c));
    setEditingId(null);
  }

  function handleVariantSaved(updated) {
    setVariants((prev) => prev.map((v) => v._id === updated._id ? updated : v));
    setEditingId(null);
  }

  if (loading) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <p className="text-muted font-ui text-sm animate-pulse">Loading…</p>
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <p className="text-red-400 font-ui text-sm">{error}</p>
    </div>
  );

  const isEmpty = concepts.length === 0 && variants.length === 0;

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-display text-warm">My Submissions</h1>
          <Link
            to="/submit"
            className="px-4 py-2 bg-terracotta text-warm text-sm font-ui font-semibold rounded-[10px] hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 20px rgba(196,119,90,0.35)' }}
          >
            + Submit New
          </Link>
        </div>

        {isEmpty ? (
          <p className="text-muted font-ui text-sm text-center py-20">No submissions yet.</p>
        ) : (
          <div className="space-y-8">
            <Section
              title="Concepts you submitted"
              items={concepts}
              renderItem={(concept) => (
                <li
                  key={concept._id}
                  className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <p className="text-warm font-display text-lg font-semibold">{concept.englishGloss}</p>
                      {concept.partOfSpeech && (
                        <span className="meta-label inline-block">{concept.partOfSpeech}</span>
                      )}
                      {concept.status === 'rejected' && concept.moderatorNote && (
                        <p className="text-xs font-ui text-red-400 mt-1">Note: {concept.moderatorNote}</p>
                      )}
                      {concept.status === 'rejected' && editingId !== concept._id && (
                        <button
                          onClick={() => setEditingId(concept._id)}
                          className="mt-2 self-start text-xs font-ui font-semibold text-terracotta hover:opacity-80 transition-opacity"
                        >
                          Edit &amp; Resubmit
                        </button>
                      )}
                      {editingId === concept._id && (
                        <ConceptEditForm
                          concept={concept}
                          onSave={handleConceptSaved}
                          onCancel={() => setEditingId(null)}
                        />
                      )}
                    </div>
                    <StatusBadge status={concept.status} />
                  </div>
                </li>
              )}
            />

            <Section
              title="Variants you submitted"
              items={variants}
              renderItem={(variant) => (
                <li
                  key={variant._id}
                  className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div dir="rtl" className="font-pashto text-warm text-xl" style={{ lineHeight: 1.7 }}>
                        {variant.pashto}
                      </div>
                      <p className="text-sm font-ui text-muted leading-snug">{variant.definition}</p>
                      {variant.region && (
                        <span className="meta-label inline-block">{variant.region}</span>
                      )}
                      {variant.status === 'rejected' && variant.moderatorNote && (
                        <p className="text-xs font-ui text-red-400 mt-1">Note: {variant.moderatorNote}</p>
                      )}
                      {variant.status === 'rejected' && editingId !== variant._id && (
                        <button
                          onClick={() => setEditingId(variant._id)}
                          className="mt-2 self-start text-xs font-ui font-semibold text-terracotta hover:opacity-80 transition-opacity"
                        >
                          Edit &amp; Resubmit
                        </button>
                      )}
                      {editingId === variant._id && (
                        <VariantEditForm
                          variant={variant}
                          onSave={handleVariantSaved}
                          onCancel={() => setEditingId(null)}
                        />
                      )}
                    </div>
                    <StatusBadge status={variant.status} />
                  </div>
                </li>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
