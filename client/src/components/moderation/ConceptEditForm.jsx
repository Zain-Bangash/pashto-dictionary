import { useState } from 'react';
import api from '../../services/api';

const editConcept = (id, data) => api.patch(`/api/concepts/${id}/edit`, data);

import LookupSelect from '../LookupSelect';
import ExtraFieldsInputs from '../fields/ExtraFieldsInputs';
import useAudioRetireConfirm from '../../hooks/useAudioRetireConfirm';

export default function ConceptEditForm({ item, onSave, onCancel }) {
  const [englishGloss, setEnglishGloss] = useState(item.englishGloss || '');
  const [partOfSpeech, setPartOfSpeech] = useState(item.partOfSpeech || '');
  const [extra, setExtra] = useState(item.extra || {});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { send, dialog } = useAudioRetireConfirm();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await send((confirm) => editConcept(item._id, { englishGloss, partOfSpeech, extra, note, ...confirm }));
      if (res) onSave(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save');
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
        <LookupSelect
          type="partOfSpeech"
          aria-label="Part of Speech"
          value={partOfSpeech}
          onChange={(e) => setPartOfSpeech(e.target.value)}
          className="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        />
      </div>
      <ExtraFieldsInputs
        appliesTo="concept"
        idPrefix={`edit-${item._id}`}
        values={extra}
        onChange={(key, value) => setExtra((v) => ({ ...v, [key]: value }))}
        inputClassName="w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50"
        labelClassName="block text-xs font-ui text-muted uppercase tracking-wider mb-1"
      />
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
      {dialog}
    </form>
  );
}
