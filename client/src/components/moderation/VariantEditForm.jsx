import { useState } from 'react';
import api from '../../services/api';
import ConceptSearch from './ConceptSearch';

const editVariant = (id, data) => api.patch(`/api/variants/${id}/edit`, data);

const REGION_OPTIONS = ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'];

export default function VariantEditForm({ item, onSave, onCancel }) {
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
