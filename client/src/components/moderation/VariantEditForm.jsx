import { useState } from 'react';
import api from '../../services/api';
import ConceptSearch from './ConceptSearch';

const editVariant = (id, data) => api.patch(`/api/variants/${id}/edit`, data);

import LookupSelect from '../LookupSelect';
import ExtraFieldsInputs from '../fields/ExtraFieldsInputs';
import FormsEditor from '../forms/FormsEditor';
import { formKindFor, formsPayload } from '../../utils/forms';

// lockedFields: fields an open suggestion proposes; they stay read-only until it is resolved
export default function VariantEditForm({ item, onSave, onCancel, lockedFields = [] }) {
  const locked = (field) => lockedFields.includes(field);
  const lockedSlots = lockedFields.filter((f) => f.startsWith('forms.')).map((f) => f.slice(6));
  const [pashto, setPashto] = useState(item.pashto || '');
  const [phonetic, setPhonetic] = useState(item.phonetic || '');
  const [region, setRegion] = useState(item.region || '');
  const [definition, setDefinition] = useState(item.definition || '');
  const [example, setExample] = useState(item.example || '');
  const [concept, setConcept] = useState(item.concept?._id || item.concept || '');
  const [partOfSpeech, setPartOfSpeech] = useState(item.concept?.partOfSpeech);
  const [extra, setExtra] = useState(item.extra || {});
  const [forms, setForms] = useState(item.forms || []);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await editVariant(item._id, { pashto, phonetic, region, definition, example, concept, extra, forms: formsPayload(forms), note });
      onSave(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save');
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
          disabled={locked('phonetic')}
          title={locked('phonetic') ? 'Proposed in an open suggestion' : undefined}
          value={phonetic}
          onChange={(e) => setPhonetic(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        />
      </div>
      <div>
        <label className="block text-xs font-ui text-muted uppercase tracking-wider mb-1">Region</label>
        <LookupSelect
          type="region"
          aria-label="Region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        />
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
          disabled={locked('example')}
          title={locked('example') ? 'Proposed in an open suggestion' : undefined}
          value={example}
          onChange={(e) => setExample(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        />
      </div>
      <ExtraFieldsInputs
        appliesTo="variant"
        idPrefix={`edit-${item._id}`}
        disabledKeys={lockedFields.filter((f) => f.startsWith('extra.')).map((f) => f.slice(6))}
        values={extra}
        onChange={(key, value) => setExtra((v) => ({ ...v, [key]: value }))}
        inputClassName="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        labelClassName="block text-xs font-ui text-muted uppercase tracking-wider mb-1"
      />
      <FormsEditor
        kind={formKindFor(partOfSpeech)}
        forms={forms}
        onChange={setForms}
        takenSlots={lockedSlots}
        idPrefix={`edit-form-${item._id}`}
        inputClassName="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        labelClassName="block text-xs font-ui text-muted uppercase tracking-wider mb-1"
      />
      <ConceptSearch
        initialGloss={item.concept?.englishGloss || ''}
        onChange={(id, selected) => { setConcept(id); setPartOfSpeech(selected?.partOfSpeech); }}
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
      {error && <p role="alert" className="text-xs font-ui text-red-400">{error}</p>}
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
