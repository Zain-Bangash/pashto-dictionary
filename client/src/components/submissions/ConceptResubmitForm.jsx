import { useState } from 'react';
import { updateConcept } from '../../services/api';
import LookupSelect from '../LookupSelect';
import ExtraFieldsInputs from '../fields/ExtraFieldsInputs';
import { inputCls, labelCls, PRIMARY_BTN, CANCEL_BTN } from './styles';

export default function ConceptResubmitForm({ concept, onSave, onCancel }) {
  const [englishGloss, setEnglishGloss] = useState(concept.englishGloss);
  const [partOfSpeech, setPartOfSpeech] = useState(concept.partOfSpeech || '');
  const [extra, setExtra] = useState(concept.extra || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await updateConcept(concept._id, { englishGloss, partOfSpeech, extra });
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
        <LookupSelect
          type="partOfSpeech"
          aria-label="Part of Speech"
          className={inputCls}
          value={partOfSpeech}
          onChange={(e) => setPartOfSpeech(e.target.value)}
          placeholder="— select —"
        />
      </div>
      <ExtraFieldsInputs
        appliesTo="concept"
        idPrefix={`resubmit-${concept._id}`}
        values={extra}
        onChange={(key, value) => setExtra((v) => ({ ...v, [key]: value }))}
        inputClassName={inputCls}
        labelClassName={labelCls}
      />
      {error && <p className="text-xs font-ui text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className={PRIMARY_BTN}
        >
          {saving ? 'Saving…' : 'Save & Resubmit'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={CANCEL_BTN}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
