import { useState } from 'react';
import { editSuggestion } from '../../services/api';
import ExtraFieldsInputs from '../fields/ExtraFieldsInputs';
import FormsEditor from '../forms/FormsEditor';
import { formKindFor, formSlot, formsPayload } from '../../utils/forms';

const INPUT = 'w-full bg-black/40 border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-warm text-sm font-ui outline-none focus:border-mint/50';
const LABEL = 'block text-xs font-ui text-muted uppercase tracking-wider mb-1';

// Staff fix a suggestion in place (fill-only still applies on the server); a note is required and the diff is logged
export default function SuggestionEditForm({ suggestion, onSave, onCancel }) {
  const { proposed = {}, variant } = suggestion;
  const extraKeys = Object.keys(proposed.extra ?? {});
  const [phonetic, setPhonetic] = useState(proposed.phonetic ?? '');
  const [example, setExample]   = useState(proposed.example ?? '');
  const [extra, setExtra]       = useState(proposed.extra ?? {});
  const [forms, setForms]       = useState(proposed.forms ?? []);
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body = { note };
    if (phonetic.trim()) body.phonetic = phonetic;
    if (example.trim()) body.example = example;
    if (forms.length) body.forms = formsPayload(forms);
    const filled = Object.fromEntries(extraKeys.filter((k) => extra[k]?.trim()).map((k) => [k, extra[k]]));
    if (Object.keys(filled).length) body.extra = filled;
    try {
      await editSuggestion(suggestion._id, body);
      onSave();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const id = (name) => `edit-suggestion-${suggestion._id}-${name}`;

  return (
    <form onSubmit={handleSubmit} aria-label="Edit suggestion" className="mt-3 bg-white/[0.03] border border-white/[0.06] rounded-[14px] p-4 space-y-3">
      {proposed.phonetic !== undefined && (
        <div>
          <label htmlFor={id('phonetic')} className={LABEL}>Phonetic</label>
          <input id={id('phonetic')} maxLength={100} value={phonetic} onChange={(e) => setPhonetic(e.target.value)} className={INPUT} />
        </div>
      )}
      {proposed.example !== undefined && (
        <div>
          <label htmlFor={id('example')} className={LABEL}>Example</label>
          <input id={id('example')} maxLength={500} value={example} onChange={(e) => setExample(e.target.value)} className={INPUT} />
        </div>
      )}
      {extraKeys.length > 0 && (
        <ExtraFieldsInputs
          appliesTo="variant"
          idPrefix={id('extra')}
          onlyKeys={extraKeys}
          values={extra}
          onChange={(key, value) => setExtra((v) => ({ ...v, [key]: value }))}
          inputClassName={INPUT}
          labelClassName={LABEL}
        />
      )}
      {proposed.forms?.length > 0 && (
        <FormsEditor
          kind={formKindFor(variant?.concept?.partOfSpeech)}
          forms={forms}
          onChange={setForms}
          takenSlots={(variant?.forms ?? []).map(formSlot)}
          idPrefix={id('form')}
          inputClassName={INPUT}
          labelClassName={LABEL}
        />
      )}
      <div>
        <label htmlFor={id('note')} className={LABEL}>Note (required)</label>
        <input id={id('note')} value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} />
      </div>
      {error && <p role="alert" className="text-xs font-ui text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] text-muted text-xs font-ui font-semibold rounded-[8px] hover:bg-white/[0.08] transition-colors">
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
